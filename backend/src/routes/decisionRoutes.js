const express = require('express');
const router = express.Router();
const decisionController = require('../controllers/decisionController');
const auth = require('../middleware/auth');

// Public route to populate supported series in dropdowns
router.get('/series', decisionController.getSupportedSeries);

// Direct ad-hoc timing evaluation
router.post('/evaluate', decisionController.evaluateDirect);

// Authenticated routes
router.post('/batch/:batchId/recompute', auth, decisionController.recomputeBatchDecision);
router.post('/outcome', auth, decisionController.logOutcome);

module.exports = router;
