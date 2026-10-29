const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const smsService = require('../services/smsService');

const getJwtSecret = () => {
  return process.env.JWT_SECRET || 'agrisense_secure_jwt_secret_distress_sale_2026';
};

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, phone: user.phone, district: user.district, name: user.name },
    getJwtSecret(),
    { expiresIn: '30d' }
  );
};

const generateVerificationToken = (phone, purpose) => {
  return jwt.sign(
    { phone, purpose, verified: true },
    getJwtSecret(),
    { expiresIn: '15m' }
  );
};

/**
 * Send 6-Digit OTP for Registration or Password/PIN Reset
 * In development, returns devOtp for zero-friction local testing.
 */
exports.sendOtp = async (req, res) => {
  try {
    const { phone, purpose = 'register' } = req.body;
    const cleanPhone = String(phone || '').trim();

    if (!/^\d{10}$/.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        message: 'कृपया वैध १० अंकी मोबाईल नंबर टाका (Please enter a valid 10-digit mobile number).',
      });
    }

    if (!['register', 'reset'].includes(purpose)) {
      return res.status(400).json({ success: false, message: 'Invalid OTP purpose.' });
    }

    const existingUser = await User.findOne({ phone: cleanPhone });

    if (purpose === 'register' && existingUser && existingUser.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'या मोबाईल नंबरवर आधीच खाते आहे. कृपया लॉगिन करा (Account already exists. Please login).',
      });
    }

    if (purpose === 'reset' && (!existingUser || !existingUser.isVerified)) {
      return res.status(404).json({
        success: false,
        message: 'या मोबाईल नंबरचे खाते सापडले नाही (No account found for this mobile number).',
      });
    }

    // Generate random 6-digit OTP
    const otpCode = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    if (existingUser) {
      existingUser.otp = { code: otpCode, expiresAt, purpose };
      await existingUser.save();
    } else {
      // Create pending registration user
      await User.create({
        phone: cleanPhone,
        pin: '0000', // temporary placeholder, will be replaced on register
        name: 'Farmer',
        isVerified: false,
        otp: { code: otpCode, expiresAt, purpose },
      });
    }

    // Dispatch SMS through SMS Gateway (Fast2SMS free tier or simulated)
    const smsResult = await smsService.sendSmsOtp(cleanPhone, otpCode, purpose);

    // In dev mode, log to terminal and include in response for zero friction testing
    console.log(`[OTP Service] OTP for ${cleanPhone} (${purpose}): ${otpCode} | Gateway status: ${smsResult.simulated ? 'SIMULATED' : (smsResult.success ? 'SENT' : 'FAILED')}`);

    return res.json({
      success: true,
      message: smsResult.simulated
        ? 'OTP तयार केला गेला आहे (OTP generated).'
        : 'OTP मोबाईलवर पाठवला गेला आहे (OTP sent to mobile).',
      phone: cleanPhone,
      purpose,
      smsDelivered: !smsResult.simulated && smsResult.success,
      devOtp: (process.env.NODE_ENV !== 'production' || smsResult.simulated || !smsResult.success) ? otpCode : undefined,
    });
  } catch (err) {
    console.error('[sendOtp error]', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Verify OTP
 */
exports.verifyOtp = async (req, res) => {
  try {
    const { phone, otp, purpose = 'register' } = req.body;
    const cleanPhone = String(phone || '').trim();
    const cleanOtp = String(otp || '').trim();

    if (!cleanPhone || !cleanOtp) {
      return res.status(400).json({ success: false, message: 'Phone and OTP are required.' });
    }

    const user = await User.findOne({ phone: cleanPhone });
    if (!user || !user.otp || !user.otp.code) {
      return res.status(400).json({
        success: false,
        message: 'OTP पाठवला गेला नाही किंवा कालबाह्य झाला आहे (OTP not found or expired).',
      });
    }

    if (new Date() > new Date(user.otp.expiresAt)) {
      return res.status(400).json({
        success: false,
        message: 'हा OTP कालबाह्य झाला आहे. कृपया नवीन OTP मागवा (OTP has expired. Please request a new one).',
      });
    }

    if (user.otp.code !== cleanOtp) {
      return res.status(400).json({
        success: false,
        message: 'चुकीचा OTP टाकला आहे (Invalid OTP entered).',
      });
    }

    // Generate short-lived verification token
    const verificationToken = generateVerificationToken(cleanPhone, purpose);

    // If already a reset purpose, keep OTP valid until reset completes or clear here
    return res.json({
      success: true,
      message: 'OTP यशस्वीरीत्या पडताळला (OTP verified successfully).',
      verificationToken,
    });
  } catch (err) {
    console.error('[verifyOtp error]', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Complete Registration
 */
exports.register = async (req, res) => {
  try {
    const { phone, pin, name, district, preferredMarket, preferredLanguage, verificationToken, otp, firebaseVerified } = req.body;
    const cleanPhone = String(phone || '').trim();

    if (!cleanPhone || !pin) {
      return res.status(400).json({ success: false, message: 'Phone and PIN are required.' });
    }

    if (!/^\d{4,6}$/.test(String(pin))) {
      return res.status(400).json({
        success: false,
        message: 'पिन ४ ते ६ अंकी असावा (PIN must be 4 to 6 digits).',
      });
    }

    const user = await User.findOne({ phone: cleanPhone });

    // Validate verification token, Firebase verification, or direct OTP check
    let verified = Boolean(firebaseVerified);
    if (!verified && verificationToken) {
      try {
        const decoded = jwt.verify(verificationToken, getJwtSecret());
        if (decoded.phone === cleanPhone) verified = true;
      } catch (tokErr) {
        // Fall back to direct OTP check below
      }
    }

    if (!verified && otp && user && user.otp && user.otp.code === String(otp).trim()) {
      if (new Date() <= new Date(user.otp.expiresAt)) {
        verified = true;
      }
    }

    // In local development, if neither token nor OTP was sent, allow if isVerified or OTP matches
    if (!verified && process.env.NODE_ENV !== 'production' && (!otp && !verificationToken)) {
      verified = true;
    }

    if (!verified) {
      return res.status(400).json({
        success: false,
        message: 'मोबाईल नंबरची पडताळणी झाली नाही (Phone number not verified via OTP).',
      });
    }

    // Set fields
    if (user) {
      user.pin = String(pin);
      user.name = (name || user.name || 'Farmer').trim();
      user.district = district || user.district || 'Kolhapur';
      user.preferredMarket = preferredMarket || user.preferredMarket || 'Kolhapur';
      user.preferredLanguage = preferredLanguage || user.preferredLanguage || 'mr';
      user.isVerified = true;
      user.otp = undefined;
      await user.save();

      const token = generateToken(user);
      return res.status(201).json({
        success: true,
        message: 'नोंदणी यशस्वी झाली (Registration successful)!',
        token,
        user: {
          id: user._id,
          phone: user.phone,
          name: user.name,
          district: user.district,
          preferredMarket: user.preferredMarket,
          preferredLanguage: user.preferredLanguage,
        },
      });
    } else {
      const newUser = await User.create({
        phone: cleanPhone,
        pin: String(pin),
        name: (name || 'Farmer').trim(),
        district: district || 'Kolhapur',
        preferredMarket: preferredMarket || 'Kolhapur',
        preferredLanguage: preferredLanguage || 'mr',
        isVerified: true,
      });

      const token = generateToken(newUser);
      return res.status(201).json({
        success: true,
        message: 'नोंदणी यशस्वी झाली (Registration successful)!',
        token,
        user: {
          id: newUser._id,
          phone: newUser.phone,
          name: newUser.name,
          district: newUser.district,
          preferredMarket: newUser.preferredMarket,
          preferredLanguage: newUser.preferredLanguage,
        },
      });
    }
  } catch (err) {
    console.error('[register error]', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Login with Phone + PIN
 */
exports.login = async (req, res) => {
  try {
    const { phone, pin } = req.body;
    const cleanPhone = String(phone || '').trim();

    if (!cleanPhone || !pin) {
      return res.status(400).json({
        success: false,
        message: 'मोबाईल नंबर आणि पिन आवश्यक आहे (Phone and PIN are required).',
      });
    }

    const user = await User.findOne({ phone: cleanPhone });
    if (!user || !user.isVerified) {
      return res.status(401).json({
        success: false,
        message: 'हा मोबाईल नंबर नोंदणीकृत नाही. कृपया प्रथम नोंदणी करा (Account not found. Please register).',
      });
    }

    const isMatch = await user.comparePin(String(pin));
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'चुकीचा पिन टाकला आहे (Invalid PIN entered).',
      });
    }

    const token = generateToken(user);
    res.json({
      success: true,
      message: 'लॉगिन यशस्वी (Login successful)!',
      token,
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        district: user.district,
        preferredMarket: user.preferredMarket,
        preferredLanguage: user.preferredLanguage,
      },
    });
  } catch (err) {
    console.error('[login error]', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Reset PIN via Verified OTP
 */
exports.resetPin = async (req, res) => {
  try {
    const { phone, newPin, verificationToken, otp, firebaseVerified } = req.body;
    const cleanPhone = String(phone || '').trim();

    if (!cleanPhone || !newPin) {
      return res.status(400).json({ success: false, message: 'Phone and new PIN are required.' });
    }

    if (!/^\d{4,6}$/.test(String(newPin))) {
      return res.status(400).json({
        success: false,
        message: 'नवीन पिन ४ ते ६ अंकी असावा (New PIN must be 4 to 6 digits).',
      });
    }

    const user = await User.findOne({ phone: cleanPhone });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'खाते सापडले नाही (User not found).',
      });
    }

    let verified = Boolean(firebaseVerified);
    if (!verified && verificationToken) {
      try {
        const decoded = jwt.verify(verificationToken, getJwtSecret());
        if (decoded.phone === cleanPhone) verified = true;
      } catch (e) {
        // Try direct otp below
      }
    }

    if (!verified && otp && user.otp && user.otp.code === String(otp).trim()) {
      if (new Date() <= new Date(user.otp.expiresAt)) {
        verified = true;
      }
    }

    if (!verified) {
      return res.status(400).json({
        success: false,
        message: 'OTP पडताळणी अयशस्वी झाली (OTP verification failed).',
      });
    }

    user.pin = String(newPin);
    user.otp = undefined;
    await user.save();

    const token = generateToken(user);
    return res.json({
      success: true,
      message: 'पिन यशस्वीरीत्या बदलला (PIN reset successfully)!',
      token,
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        district: user.district,
        preferredMarket: user.preferredMarket,
        preferredLanguage: user.preferredLanguage,
      },
    });
  } catch (err) {
    console.error('[resetPin error]', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get Current User Profile
 */
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-pin -otp');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Update Profile Preferences
 */
exports.updateProfile = async (req, res) => {
  try {
    const { name, district, preferredMarket, preferredLanguage } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (name) user.name = String(name).trim();
    if (district) user.district = district;
    if (preferredMarket) user.preferredMarket = preferredMarket;
    if (preferredLanguage) user.preferredLanguage = preferredLanguage;

    await user.save();

    res.json({
      success: true,
      message: 'माहिती अद्ययावत केली (Profile updated successfully)!',
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        district: user.district,
        preferredMarket: user.preferredMarket,
        preferredLanguage: user.preferredLanguage,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
