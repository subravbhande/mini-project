const mongoose = require('mongoose');

const decisionSchema = new mongoose.Schema(
  {
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CropBatch',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    decision: {
      type: String,
      required: true,
      enum: ['SELL', 'HOLD', 'PARTIAL_SELL'],
    },
    sellFraction: {
      type: Number,
      required: true,
      default: 1.0,
    },
    actByDate: {
      type: String,
      required: true,
    },
    recommendedHoldingDays: {
      type: Number,
      default: 0,
    },
    nrvToday: {
      type: Number,
      required: true,
    },
    nrvBest: {
      type: Number,
      required: true,
    },
    upliftPct: {
      type: Number,
      required: true,
    },
    confidenceLabel: {
      type: String,
      enum: ['High', 'Moderate', 'Low'],
      default: 'Moderate',
    },
    reason: {
      type: String,
      required: true,
    },
    reasonMr: {
      type: String,
      default: '',
    },
    dataAsOf: {
      type: String,
      default: '',
    },
    daysStale: {
      type: Number,
      default: 0,
    },
    stale: {
      type: Boolean,
      default: false,
    },
    rawForecast: {
      type: mongoose.Schema.Types.Mixed,
    },
    rawDecay: {
      type: mongoose.Schema.Types.Mixed,
    },
    rawEconomic: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Decision', decisionSchema);
