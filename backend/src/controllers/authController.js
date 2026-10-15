const jwt = require('jsonwebtoken');
const User = require('../models/User');

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: JWT_SECRET environment variable is not configured.');
    }
    return 'distress_sale_dev_jwt_secret_only';
  }
  return secret;
};

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, phone: user.phone, district: user.district },
    getJwtSecret(),
    { expiresIn: '30d' }
  );
};

exports.register = async (req, res) => {
  try {
    const { phone, pin, name, district, preferredLanguage } = req.body;
    if (!phone || !pin) {
      return res.status(400).json({ success: false, message: 'Phone and 4-digit PIN are required.' });
    }

    if (!/^\d{4,6}$/.test(String(pin))) {
      return res.status(400).json({ success: false, message: 'PIN must be between 4 and 6 digits.' });
    }

    const existing = await User.findOne({ phone: String(phone).trim() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'An account with this phone number already exists.' });
    }

    const user = await User.create({
      phone: String(phone).trim(),
      pin: String(pin),
      name: name || 'Farmer',
      district: district || 'Kolhapur',
      preferredLanguage: preferredLanguage || 'mr',
    });

    const token = generateToken(user);
    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        district: user.district,
        preferredLanguage: user.preferredLanguage,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { phone, pin } = req.body;
    if (!phone || !pin) {
      return res.status(400).json({ success: false, message: 'Phone and PIN are required.' });
    }

    const user = await User.findOne({ phone: String(phone).trim() });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid phone number or PIN.' });
    }

    const isMatch = await user.comparePin(String(pin));
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid phone number or PIN.' });
    }

    const token = generateToken(user);
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        district: user.district,
        preferredLanguage: user.preferredLanguage,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-pin');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
