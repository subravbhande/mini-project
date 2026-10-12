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
  },
  { timestamps: true }
);

// Hash PIN before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('pin')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.pin = await bcrypt.hash(this.pin, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Compare PIN method
userSchema.methods.comparePin = async function (enteredPin) {
  return bcrypt.compare(enteredPin, this.pin);
};

module.exports = mongoose.model('User', userSchema);
