const express = require('express');
const router = express.Router();
const batchController = require('../controllers/batchController');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', batchController.getBatches);
router.post('/', batchController.createBatch);
router.get('/stats/summary', batchController.getHistorySummary);
router.get('/:id', batchController.getBatchById);
router.delete('/:id', batchController.deleteBatch);

module.exports = router;
