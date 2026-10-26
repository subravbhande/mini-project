const axios = require('axios');

/**
 * Send real SMS OTP to Indian mobile numbers via Fast2SMS (Free Tier API)
 * Fast2SMS provides free trial credits on sign-up with no credit card required.
 *
 * @param {string} phone - 10-digit Indian phone number
 * @param {string} otpCode - 6-digit OTP string
 * @param {string} purpose - 'register' | 'reset'
 * @returns {Promise<{success: boolean, simulated?: boolean, message?: string}>}
 */
exports.sendSmsOtp = async (phone, otpCode, purpose = 'register') => {
  const cleanPhone = String(phone || '').trim();
  const apiKey = process.env.FAST2SMS_API_KEY?.trim();

  // If no API key is configured, run in simulation mode with terminal logging
  if (!apiKey || apiKey === 'your_fast2sms_api_key_here') {
    console.log(`[SMS-SIMULATED] No FAST2SMS_API_KEY set. To +91${cleanPhone} (${purpose}): OTP is ${otpCode}`);
    return {
      success: true,
      simulated: true,
      message: 'Simulated SMS logged in backend terminal.',
    };
  }

  try {
    // Fast2SMS Quick OTP route (does not require custom DLT template registration)
    const response = await axios.post(
      'https://www.fast2sms.com/dev/bulkV2',
      {
        variables_values: otpCode,
        route: 'otp',
        numbers: cleanPhone,
      },
      {
        headers: {
          authorization: apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    const isSuccess = response.data?.return === true;
    console.log(`[Fast2SMS] Delivered OTP to +91${cleanPhone}:`, response.data);

    return {
      success: isSuccess,
      simulated: false,
      message: response.data?.message?.[0] || 'SMS sent successfully.',
      data: response.data,
    };
  } catch (err) {
    const errorDetails = err.response?.data || err.message;
    console.error(`[Fast2SMS Error] Failed to send SMS to +91${cleanPhone}:`, errorDetails);

    return {
      success: false,
      simulated: false,
      message: err.response?.data?.message || 'Failed to dispatch SMS via gateway.',
      error: errorDetails,
    };
  }
};
