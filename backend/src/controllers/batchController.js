const CropBatch = require('../models/CropBatch');
const Decision = require('../models/Decision');
const mlClient = require('../services/mlClient');

exports.getBatches = async (req, res) => {
  try {
    const batches = await CropBatch.find({ userId: req.user.id })
      .populate('latestDecision')
      .sort({ createdAt: -1 });
    res.json({ success: true, count: batches.length, data: batches });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createBatch = async (req, res) => {
  try {
    const { commodity, district, market, variety, quantityQuintals, harvestDate, storageType, liquidityNeed } = req.body;

    if (!commodity || !district || !market || !quantityQuintals) {
      return res.status(400).json({
        success: false,
        message: 'Commodity, district, market, and quantity are required.',
      });
    }

    // Create the batch record
    const batch = await CropBatch.create({
      userId: req.user.id,
      commodity,
      district,
      market,
      variety: variety || 'Standard',
      quantityQuintals: Number(quantityQuintals),
      harvestDate: harvestDate || new Date(),
      storageType: storageType || 'ambient',
      liquidityNeed: liquidityNeed || 'normal',
    });

    // Request initial timing decision from ML Service
    try {
      const mlDecision = await mlClient.getDecision({
        commodity: batch.commodity.toLowerCase(),
        market: batch.market,
        district: batch.district,
        initial_quantity_quintals: batch.quantityQuintals,
        storage_type: batch.storageType,
        harvest_date: batch.harvestDate ? batch.harvestDate.toISOString().slice(0, 10) : undefined,
        liquidity_need: batch.liquidityNeed,
      });

      // Save initial decision record
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

      return res.status(201).json({
        success: true,
        data: batch,
        decision: decisionRecord,
      });
    } catch (mlErr) {
      console.warn('ML Service decision call deferred/failed:', mlErr.message);
      return res.status(201).json({
        success: true,
        data: batch,
        warning: 'Batch saved, but ML timing evaluation is currently pending.',
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getBatchById = async (req, res) => {
  try {
    const batch = await CropBatch.findOne({ _id: req.params.id, userId: req.user.id })
      .populate('latestDecision');
    if (!batch) {
      return res.status(404).json({ success: false, message: 'Crop batch not found.' });
    }

    const history = await Decision.find({ batchId: batch._id }).sort({ createdAt: -1 });

    res.json({ success: true, data: batch, decisionHistory: history });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteBatch = async (req, res) => {
  try {
    const batch = await CropBatch.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!batch) {
      return res.status(404).json({ success: false, message: 'Crop batch not found.' });
    }
    await Decision.deleteMany({ batchId: batch._id });
    res.json({ success: true, message: 'Batch removed successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getHistorySummary = async (req, res) => {
  try {
    const userId = req.user.id;
    const Outcome = require('../models/Outcome');

    const batches = await CropBatch.find({ userId });
    const outcomes = await Outcome.find({ userId }).populate('batchId');

    const totalBatches = batches.length;
    const activeBatches = batches.filter((b) => b.status === 'active').length;
    const soldBatches = batches.filter((b) => b.status === 'sold').length;

    let totalRealizedRevenue = 0;
    let totalRealizedUplift = 0;
    let profitableSalesCount = 0;

    for (const out of outcomes) {
      totalRealizedRevenue += (out.actualRevenue || 0);

      const batchId = out.batchId?._id || out.batchId;
      if (batchId) {
        const decision = await Decision.findOne({ batchId }).sort({ createdAt: 1 });
        if (decision) {
          const baselineRev = decision.nrvToday || 0;
          const uplift = (out.actualRevenue || 0) - baselineRev;
          totalRealizedUplift += uplift;
          if (uplift >= 0) profitableSalesCount++;
        }
      }
    }

    res.json({
      success: true,
      data: {
        totalBatches,
        activeBatches,
        soldBatches,
        totalRealizedRevenue: Math.round(totalRealizedRevenue),
        totalRealizedUplift: Math.round(totalRealizedUplift),
        profitableSalesCount,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

