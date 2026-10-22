/**
 * Distress-Sale Timing Advisor — Automated Daily Price Sync Job
 * Uses node-cron to fetch fresh daily APMC prices every day from data.gov.in
 * and update the model dataset and in-memory price forecaster.
 */

const cron = require('node-cron');
const { spawn } = require('child_process');
const path = require('path');
const mlClient = require('../services/mlClient');
const { syncDailyWeather } = require('../services/weatherService');

const ML_ROOT = path.join(__dirname, '../../../ml_service');
const PYTHON_PATH = process.env.PYTHON_PATH || 'C:\\Python314\\python.exe';
const CRON_SCHEDULE = process.env.PRICE_SYNC_CRON || '0 6 * * *'; // Everyday at 6:00 AM

/**
 * Execute daily price and weather sync.
 * Tries ML microservice HTTP endpoint first; falls back to direct script invocation.
 */
async function runDailyPriceSync(options = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[DailyPriceSync] Starting daily price and weather sync at ${timestamp}...`);

  // Trigger weather sync concurrently
  syncDailyWeather().catch((err) => console.warn('[DailyPriceSync] Weather sync warning:', err.message));

  const apiKey = options.apiKey || process.env.DATA_GOV_IN_API_KEY;

  // 1. Try FastAPI ML Microservice
  try {
    const response = await mlClient.syncDailyPrices({
      api_key: apiKey,
      force_seed: Boolean(options.forceSeed),
    });
    console.log('[DailyPriceSync] Successfully synced daily prices via ML service:', JSON.stringify(response.sync || response));
    
    // Trigger daily feedback loop evaluation (evaluate yesterday's predictions against today's actuals)
    try {
      const feedbackRes = await mlClient.evaluateFeedback({ retrain_if_drift: true });
      console.log('[DailyPriceSync] Daily feedback loop evaluated:', JSON.stringify(feedbackRes.data || feedbackRes));
    } catch (fErr) {
      console.warn('[DailyPriceSync] Feedback evaluation non-fatal:', fErr.message);
    }

    return { success: true, mode: 'http_service', result: response };
  } catch (err) {
    console.warn(`[DailyPriceSync] ML service HTTP sync unavailable (${err.message}). Attempting Python CLI fallback...`);
  }

  // 2. Fallback to direct Python script execution
  return new Promise((resolve) => {
    const scriptPath = path.join(ML_ROOT, 'training', 'fetch_daily_prices.py');
    const args = [scriptPath];
    if (apiKey) {
      args.push('--key', apiKey);
    }
    if (options.forceSeed) {
      args.push('--seed-latest');
    }

    const proc = spawn(PYTHON_PATH, args, { cwd: ML_ROOT });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.stderr.on('data', (d) => (stderr += d.toString()));

    proc.on('close', (code) => {
      if (code === 0) {
        console.log('[DailyPriceSync] CLI price sync completed successfully.');
        
        // Trigger Python feedback loop via CLI
        try {
          const fbProc = spawn(PYTHON_PATH, ['-c', 'from models.feedback_loop import evaluate_daily_feedback; evaluate_daily_feedback()'], { cwd: ML_ROOT });
          fbProc.on('close', () => console.log('[DailyPriceSync] CLI feedback loop completed.'));
        } catch (e) {
          console.warn('[DailyPriceSync] CLI feedback notice:', e.message);
        }

        resolve({ success: true, mode: 'cli_fallback', output: stdout });
      } else {
        console.error(`[DailyPriceSync] CLI price sync failed with code ${code}: ${stderr}`);
        resolve({ success: false, mode: 'cli_fallback', error: stderr });
      }
    });
  });
}

/**
 * Initialize background cron job.
 */
function initDailyPriceSyncJob() {
  console.log(`[DailyPriceSync] Initializing daily price sync cron with schedule: "${CRON_SCHEDULE}"`);

  cron.schedule(CRON_SCHEDULE, async () => {
    console.log('[DailyPriceSync] Cron triggered daily price refresh...');
    try {
      await runDailyPriceSync();
    } catch (e) {
      console.error('[DailyPriceSync] Unhandled error during cron price sync:', e);
    }
  });

  // Also do a soft background check 5 seconds after server startup
  setTimeout(async () => {
    try {
      const status = await mlClient.getSyncStatus();
      console.log(`[DailyPriceSync] Data status: Latest price date=${status?.data_status?.latest_price_date}, Days stale=${status?.data_status?.days_stale}`);
      if (status?.data_status?.stale) {
        console.log('[DailyPriceSync] Price dataset is currently stale. Triggering startup price sync...');
        await runDailyPriceSync();
      }
    } catch (e) {
      console.debug('[DailyPriceSync] Startup status check non-fatal:', e.message);
    }
  }, 5000);
}

module.exports = {
  initDailyPriceSyncJob,
  runDailyPriceSync,
};
