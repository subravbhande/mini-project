const CropBatch = require('../models/CropBatch');
const Decision = require('../models/Decision');
const Outcome = require('../models/Outcome');
const mlClient = require('../services/mlClient');

exports.evaluateDirect = async (req, res) => {
  try {
    const { commodity, market, district, quantityQuintals, storageType, harvestDate, liquidityNeed } = req.body;

    if (!commodity || !market) {
      return res.status(400).json({ success: false, message: 'Commodity and market are required.' });
    }

    const mlDecision = await mlClient.getDecision({
      commodity: String(commodity).toLowerCase(),
      market: String(market),
      district: district || undefined,
      initial_quantity_quintals: Number(quantityQuintals || 100),
      storage_type: storageType || 'ambient',
      harvest_date: harvestDate || undefined,
      liquidity_need: liquidityNeed || 'normal',
    });

    res.json({ success: true, data: mlDecision });
  } catch (err) {
    const status = err.response?.status || 500;
    const message = err.response?.data?.detail?.error || err.response?.data?.message || err.message;
    const valid = err.response?.data?.detail?.valid;
    res.status(status).json({ success: false, message, valid });
  }
};

exports.recomputeBatchDecision = async (req, res) => {
  try {
    const batch = await CropBatch.findOne({ _id: req.params.batchId, userId: req.user.id });
    if (!batch) {
      return res.status(404).json({ success: false, message: 'Batch not found.' });
    }

    const mlDecision = await mlClient.getDecision({
      commodity: batch.commodity.toLowerCase(),
      market: batch.market,
      district: batch.district,
      initial_quantity_quintals: batch.quantityQuintals,
      storage_type: batch.storageType,
      harvest_date: batch.harvestDate ? batch.harvestDate.toISOString().slice(0, 10) : undefined,
      liquidity_need: batch.liquidityNeed,
    });

    const decisionRecord = await Decision.create({
      batchId: batch._id,
      userId: req.user.id,
      decision: mlDecision.decision,
      sellFraction: mlDecision.sell_fraction,
      actByDate: mlDecision.act_by_date,
      recommendedHoldingDays: mlDecision.recommended_holding_days,
      nrvToday: mlDecision.nrv_today,
      nrvBest: mlDecision.nrv_best,
      upliftPct: mlDecision.uplift_pct,
      confidenceLabel: mlDecision.confidence_label,
      reason: mlDecision.reason,
      reasonMr: mlDecision.reason_mr,
      dataAsOf: mlDecision.data_as_of,
      daysStale: mlDecision.days_stale,
      stale: mlDecision.stale,
      rawForecast: mlDecision.price_forecast,
      rawDecay: mlDecision.decay_simulation,
      rawEconomic: mlDecision.economic_decision,
    });

    batch.latestDecision = decisionRecord._id;
    await batch.save();

    res.json({ success: true, data: decisionRecord });
  } catch (err) {
    const status = err.response?.status || 500;
    const message = err.response?.data?.detail?.error || err.message;
    res.status(status).json({ success: false, message });
  }
};

exports.getSupportedSeries = async (req, res) => {
  try {
    const series = await mlClient.getSeries();
    res.json({ success: true, data: series });
  } catch (err) {
    // Fallback static list if ML service is temporarily sleeping
    res.json({
      success: true,
      data: {
        count: 6,
        supported_series: [
          { crop: 'tomato', crop_display: 'Tomato', market: 'Kolhapur', district: 'Kolhapur' },
          { crop: 'tomato', crop_display: 'Tomato', market: 'Vadgaonpeth', district: 'Kolhapur' },
          { crop: 'tomato', crop_display: 'Tomato', market: 'Islampur', district: 'Sangli' },
          { crop: 'onion', crop_display: 'Onion', market: 'Kolhapur', district: 'Kolhapur' },
          { crop: 'onion', crop_display: 'Onion', market: 'Vadgaonpeth', district: 'Kolhapur' },
          { crop: 'onion', crop_display: 'Onion', market: 'Sangli-Phale-Bhajipala', district: 'Sangli' },
        ],
      },
    });
  }
};

exports.logOutcome = async (req, res) => {
  try {
    const { batchId, actualSaleDate, actualPrice, actualQuantitySold, actualRevenue, userNotes } = req.body;
    const outcome = await Outcome.create({
      batchId,
      userId: req.user.id,
      actualSaleDate: actualSaleDate || new Date(),
      actualPrice,
      actualQuantitySold,
      actualRevenue: actualRevenue || actualPrice * actualQuantitySold,
      userNotes,
    });

    await CropBatch.findByIdAndUpdate(batchId, { status: 'sold' });

    res.status(201).json({ success: true, data: outcome });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
