/**
 * AgriSense — Feedback Loop API Routes
 * Exposes model accuracy tracking, prediction evaluation vs verified actuals,
 * rolling calibration bias, and continuous learning triggers.
 */

const express = require('express');
const router = express.Router();
const mlClient = require('../services/mlClient');

/**
 * GET /api/feedback/summary
 * Returns model accuracy overview (MAPE, MAE, coverage rate, calibration bias, recent evaluations)
 */
router.get('/summary', async (req, res) => {
  try {
    const metrics = await mlClient.getFeedbackMetrics();
    res.json({ success: true, data: metrics.data || metrics });
  } catch (err) {
    console.error('[FeedbackRoutes] Error retrieving feedback summary:', err.message);
    res.status(500).json({ success: false, error: err.message || 'Failed to retrieve feedback metrics.' });
  }
});

/**
 * POST /api/feedback/evaluate
 * Triggers feedback evaluation: matches predictions with verified market arrivals
 */
router.post('/evaluate', async (req, res) => {
  try {
    const retrainIfDrift = req.body?.retrain_if_drift !== false;
    const result = await mlClient.evaluateFeedback({ retrain_if_drift: retrainIfDrift });
    res.json({ success: true, data: result.data || result });
  } catch (err) {
    console.error('[FeedbackRoutes] Error triggering evaluation:', err.message);
    res.status(500).json({ success: false, error: err.message || 'Failed to execute feedback evaluation.' });
  }
});

/**
 * POST /api/feedback/retrain
 * Manually trigger model retraining with newest daily market and weather data
 */
router.post('/retrain', async (req, res) => {
  try {
    const result = await mlClient.triggerFeedbackRetrain();
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[FeedbackRoutes] Error triggering model retrain:', err.message);
    res.status(500).json({ success: false, error: err.message || 'Failed to retrain model.' });
  }
});

module.exports = router;
