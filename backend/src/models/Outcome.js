const mongoose = require('mongoose');

const outcomeSchema = new mongoose.Schema(
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
    actualSaleDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    actualPrice: {
      type: Number,
      required: true,
    },
    actualQuantitySold: {
      type: Number,
      required: true,
    },
    actualRevenue: {
      type: Number,
      required: true,
    },
    userNotes: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Outcome', outcomeSchema);
