const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('../client/node_modules/playwright');

const PORT = 4173;
const DIST_DIR = path.resolve(__dirname, '../client/dist');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
};

// 1. Static file server for client/dist
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  let filePath = path.join(DIST_DIR, reqPath);
  if (!fs.existsSync(filePath)) {
    // SPA fallback
    filePath = path.join(DIST_DIR, 'index.html');
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  } catch (e) {
    res.writeHead(404);
    res.end('Not found');
  }
});

async function run() {
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`Server listening on http://localhost:${PORT}`);

  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
  });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 950 },
    deviceScaleFactor: 2, // High resolution retina screenshot
  });

  const page = await context.newPage();

  // Mock API endpoints
  await page.route('**/api/health', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'healthy', database: 'connected', ml_service: 'online' }),
    });
  });

  await page.route('**/api/price/markets', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          markets: {
            Tomato: [
              { market: 'Kolhapur', district: 'Kolhapur' },
              { market: 'Vadgaonpeth', district: 'Kolhapur' },
              { market: 'Islampur', district: 'Sangli' },
            ],
            Onion: [
              { market: 'Sangli-Phale-Bhajipala', district: 'Sangli' },
              { market: 'Kolhapur', district: 'Kolhapur' },
              { market: 'Vadgaonpeth', district: 'Kolhapur' },
            ],
          },
        },
      }),
    });
  });

  const todayStr = new Date().toISOString().slice(0, 10);
  const actByDateStr = new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10);

  const holdDecisionPayload = {
    success: true,
    data: {
      commodity: 'Onion',
      market: 'Sangli-Phale-Bhajipala',
      district: 'Sangli',
      decision: 'HOLD',
      sell_fraction: 0.0,
      act_by_date: actByDateStr,
      recommended_holding_days: 3,
      nrv_today: 79000,
      nrv_best: 82680,
      uplift_pct: 4.66,
      confidence_label: 'High',
      break_even_price_best_day: 1610.54,
      break_even_pct_best_day: 1.93,
      reason: `Holding for 3 day(s) until ${actByDateStr} yields an estimated net gain of ₹3,680 (+4.66% NRV). Produce quality in Ventilated Chawl remains safe.`,
      reason_mr: `कांदा चाळीत प्रत सुरक्षित असून ३ दिवस माल राखून ${actByDateStr} पर्यंत विक्री केल्यास निव्वळ ₹3,680 (+4.66%) अतिरिक्त नफा मिळण्याची शक्यता आहे.`,
      data_as_of: todayStr,
      last_observed_price: 1580,
      days_stale: 0,
      stale: false,
      warnings: [],
      price_forecast: {
        commodity: 'Onion',
        market: 'Sangli-Phale-Bhajipala',
        district: 'Sangli',
        summary: {
          last_observed_price: 1580,
          forecast_avg_price: 1635,
          overall_trend: 'RISING',
          price_trend: 'UP',
          weather_risk_days: 0,
        },
        daily_forecasts: [
          { day: 1, date: new Date(Date.now() + 86400000 * 1).toISOString().slice(0, 10), predicted_modal_price: 1615, predicted_min_price: 1540, predicted_max_price: 1690, weather_risk_flag: false },
          { day: 2, date: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10), predicted_modal_price: 1650, predicted_min_price: 1580, predicted_max_price: 1720, weather_risk_flag: false },
          { day: 3, date: actByDateStr, predicted_modal_price: 1680, predicted_min_price: 1610, predicted_max_price: 1750, weather_risk_flag: false },
          { day: 4, date: new Date(Date.now() + 86400000 * 4).toISOString().slice(0, 10), predicted_modal_price: 1655, predicted_min_price: 1580, predicted_max_price: 1720, weather_risk_flag: false },
          { day: 5, date: new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10), predicted_modal_price: 1630, predicted_min_price: 1560, predicted_max_price: 1700, weather_risk_flag: false },
        ],
      },
      decay_simulation: {
        crop: 'onion',
        daily_schedule: [
          { day: 1, daily_weight_loss_pct: 0.52, quality_discount_pct: 0, risk_level: 'LOW' },
          { day: 2, daily_weight_loss_pct: 0.52, quality_discount_pct: 0.5, risk_level: 'LOW' },
          { day: 3, daily_weight_loss_pct: 0.55, quality_discount_pct: 1.0, risk_level: 'LOW' },
          { day: 4, daily_weight_loss_pct: 0.58, quality_discount_pct: 1.8, risk_level: 'LOW' },
          { day: 5, daily_weight_loss_pct: 0.60, quality_discount_pct: 2.5, risk_level: 'MEDIUM' },
        ],
      },
      economic_decision: {
        decision: 'HOLD',
        sell_fraction: 0.0,
        act_by_date: actByDateStr,
        recommended_holding_days: 3,
        nrv_today: 79000,
        nrv_best: 82680,
        uplift_pct: 4.66,
        confidence_label: 'High',
        break_even_price_best_day: 1610.54,
        break_even_pct_best_day: 1.93,
        reason: `Holding for 3 day(s) until ${actByDateStr} yields an estimated net gain of ₹3,680 (+4.66% NRV).`,
        reason_mr: `कांदा चाळीत प्रत सुरक्षित असून ३ दिवस माल राखून ${actByDateStr} पर्यंत विक्री केल्यास निव्वळ ₹3,680 (+4.66%) अतिरिक्त नफा मिळण्याची शक्यता आहे.`,
        daily_schedule: [
          { day: 1, date: new Date(Date.now() + 86400000 * 1).toISOString().slice(0, 10), predicted_price: 1615, retained_weight_quintals: 49.56, effective_value_multiplier: 0.985, decay_risk_level: 'LOW', cumulative_storage_cost: 20, net_realizable_value: 79850, uplift_vs_today_pct: 1.08, break_even_price: 1595.0, break_even_uplift_pct: 0.95 },
          { day: 2, date: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10), predicted_price: 1650, retained_weight_quintals: 49.13, effective_value_multiplier: 0.975, decay_risk_level: 'LOW', cumulative_storage_cost: 40, net_realizable_value: 81220, uplift_vs_today_pct: 2.81, break_even_price: 1602.0, break_even_uplift_pct: 1.39 },
          { day: 3, date: actByDateStr, predicted_price: 1680, retained_weight_quintals: 48.70, effective_value_multiplier: 0.965, decay_risk_level: 'LOW', cumulative_storage_cost: 60, net_realizable_value: 82680, uplift_vs_today_pct: 4.66, break_even_price: 1610.54, break_even_uplift_pct: 1.93 },
          { day: 4, date: new Date(Date.now() + 86400000 * 4).toISOString().slice(0, 10), predicted_price: 1655, retained_weight_quintals: 48.27, effective_value_multiplier: 0.942, decay_risk_level: 'LOW', cumulative_storage_cost: 80, net_realizable_value: 80900, uplift_vs_today_pct: 2.41, break_even_price: 1625.0, break_even_uplift_pct: 2.85 },
          { day: 5, date: new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10), predicted_price: 1630, retained_weight_quintals: 47.85, effective_value_multiplier: 0.920, decay_risk_level: 'MEDIUM', cumulative_storage_cost: 100, net_realizable_value: 79150, uplift_vs_today_pct: 0.19, break_even_price: 1642.0, break_even_uplift_pct: 3.92 },
        ],
      },
    },
  };

  await page.route('**/api/decision/evaluate', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(holdDecisionPayload),
    });
  });

  await page.route('**/api/price/forecast', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(holdDecisionPayload),
    });
  });

  console.log('Navigating to http://localhost:' + PORT);
  await page.goto(`http://localhost:${PORT}`);
  await page.waitForLoadState('networkidle');

  // Click Onion card
  console.log('Selecting Onion...');
  const onionCard = await page.locator('button:has-text("कांदा"), button:has-text("Onion")').first();
  if (await onionCard.isVisible()) {
    await onionCard.click();
  }

  // Click Submit button to evaluate advisory
  console.log('Submitting query...');
  const submitBtn = await page.locator('button[type="submit"]').first();
  await submitBtn.click();

  // Wait for the HOLD advisory result card to appear
  console.log('Waiting for HOLD advisory result badge...');
  await page.waitForSelector('text=HOLD', { timeout: 10000 });
  await page.waitForTimeout(1000); // Wait for recharts animations

  const outFigure = path.resolve(__dirname, '../docs/figures/hold_condition_screenshot.png');
  const outArtifact = 'C:/Users/subra/.gemini/antigravity/brain/3dfc4df3-2891-4732-993b-3b0649dacb63/hold_condition_screenshot.png';

  console.log('Capturing screenshot...');
  await page.screenshot({ path: outFigure, fullPage: true });
  fs.copyFileSync(outFigure, outArtifact);

  console.log(`Saved screenshot to: ${outFigure} and ${outArtifact}`);

  await browser.close();
  server.close();
}

run().catch((err) => {
  console.error('Error running script:', err);
  process.exit(1);
});
