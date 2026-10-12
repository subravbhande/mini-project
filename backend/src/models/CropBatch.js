const mongoose = require('mongoose');

const cropBatchSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    commodity: {
      type: String,
      required: true,
      enum: ['Tomato', 'Onion', 'tomato', 'onion'],
    },
    district: {
      type: String,
      required: true,
      enum: ['Kolhapur', 'Sangli'],
    },
    market: {
      type: String,
      required: true,
    },
    variety: {
      type: String,
      default: 'Other',
    },
    quantityQuintals: {
      type: Number,
      required: true,
      min: [0.1, 'Quantity must be at least 0.1 Quintals'],
    },
    harvestDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    storageType: {
      type: String,
      required: true,
      enum: ['ambient', 'ventilated_chawl', 'zecc', 'cold_storage'],
      default: 'ambient',
    },
    liquidityNeed: {
      type: String,
      enum: ['immediate', 'normal', 'low'],
      default: 'normal',
    },
    status: {
      type: String,
      enum: ['active', 'sold', 'archived'],
      default: 'active',
    },
    latestDecision: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Decision',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CropBatch', cropBatchSchema);
