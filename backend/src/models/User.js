const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: [/^\d{10}$/, 'Phone number must be a valid 10-digit number'],
    },
    pin: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      trim: true,
      default: 'Farmer',
    },
    district: {
      type: String,
      enum: ['Kolhapur', 'Sangli'],
      default: 'Kolhapur',
    },
    preferredLanguage: {
      type: String,
      enum: ['mr', 'en'],
      default: 'mr',
    },
    preferredMarket: {
      type: String,
      trim: true,
      default: 'Kolhapur',
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    otp: {
      code: { type: String },
      expiresAt: { type: Date },
      purpose: { type: String, enum: ['register', 'reset'] },
    },
  },
  { timestamps: true }
);

// Hash PIN before saving (Mongoose 8+/9+ async middleware returns promise without next)
userSchema.pre('save', async function () {
  if (!this.isModified('pin')) return;
  const salt = await bcrypt.genSalt(10);
  this.pin = await bcrypt.hash(this.pin, salt);
});

// Compare PIN method
userSchema.methods.comparePin = async function (enteredPin) {
  return bcrypt.compare(enteredPin, this.pin);
};

module.exports = mongoose.model('User', userSchema);
