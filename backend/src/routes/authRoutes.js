const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');

// Ensure database is connected before handling auth requests
const ensureDb = async (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    try {
      await connectDB();
    } catch (e) {
      // Catch and check readyState below
    }
  }
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      message: 'डेटाबेस तात्पुरता अनुपलब्ध आहे. कृपया काही सेकंदांनंतर पुन्हा प्रयत्न करा (Database temporarily unavailable. Please retry shortly).',
    });
  }
  next();
};

router.use(ensureDb);

router.post('/send-otp', authController.sendOtp);
router.post('/verify-otp', authController.verifyOtp);
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/reset-pin', authController.resetPin);
router.get('/me', auth, authController.getMe);
router.put('/profile', auth, authController.updateProfile);

module.exports = router;
