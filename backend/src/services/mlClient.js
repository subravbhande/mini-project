const axios = require('axios');
const { getPriceForecast: fallbackPriceForecast, getTimingDecision: fallbackTimingDecision } = require('./mlService');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

const client = axios.create({
  baseURL: ML_SERVICE_URL,
  timeout: 12000,
  headers: {
    'Content-Type': 'application/json',
  },
});

function isConnectionError(err) {
  if (!err) return false;
  const code = err.code;
  const msg = err.message || '';
  return (
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'ETIMEDOUT' ||
    code === 'EAI_AGAIN' ||
    code === 'ERR_NETWORK' ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('connect') ||
    msg.includes('Network Error')
  );
}

const mlClient = {
  getHealth: async () => {
    try {
      const res = await client.get('/health', { timeout: 2000 });
      return { status: 'online', data: res.data };
    } catch (err) {
      return {
        status: 'offline',
        fallbackAvailable: true,
        error: err.code || err.message,
      };
    }
  },

  getSeries: async () => {
    try {
      const res = await client.get('/series', { timeout: 3000 });
      return res.data;
    } catch (err) {
      console.warn(`[ML Client] /series unavailable at ${ML_SERVICE_URL} (${err.code || err.message}). Using local fallback.`);
      return {
        count: 6,
        supported_series: [
          { crop: 'tomato', crop_display: 'Tomato', market: 'Kolhapur', district: 'Kolhapur' },
          { crop: 'tomato', crop_display: 'Tomato', market: 'Vadgaonpeth', district: 'Kolhapur' },
          { crop: 'tomato', crop_display: 'Tomato', market: 'Islampur', district: 'Sangli' },
          { crop: 'onion', crop_display: 'Onion', market: 'Kolhapur', district: 'Kolhapur' },
          { crop: 'onion', crop_display: 'Onion', market: 'Vadgaonpeth', district: 'Kolhapur' },
          { crop: 'onion', crop_display: 'Onion', market: 'Sangli-Phale-Bhajipala', district: 'Sangli' },
        ],
      };
    }
  },

  getPriceForecast: async (params) => {
    try {
      const res = await client.post('/price/forecast', params);
      return res.data;
    } catch (err) {
      if (isConnectionError(err)) {
        console.warn(`[ML Client] FastAPI HTTP service unavailable at ${ML_SERVICE_URL} (${err.message}). Using local Python CLI model fallback...`);
        return await fallbackPriceForecast(params);
      }
      throw err;
    }
  },

  simulateDecay: async (params) => {
    const res = await client.post('/decay/simulate', params);
    return res.data;
  },

  getDecision: async (params) => {
    try {
      const res = await client.post('/decide', params);
      return res.data;
    } catch (err) {
      if (isConnectionError(err)) {
        console.warn(`[ML Client] FastAPI HTTP service unavailable at ${ML_SERVICE_URL} (${err.message}). Using local Python CLI decision fallback...`);
        return await fallbackTimingDecision(params);
      }
      throw err;
    }
  },

  syncDailyPrices: async (params = {}) => {
    const res = await client.post('/price/sync', params);
    return res.data;
  },

  getSyncStatus: async () => {
    const res = await client.get('/price/sync/status', { timeout: 3000 });
    return res.data;
  },

  syncDailyWeather: async (params = {}) => {
    const res = await client.post('/weather/sync', params);
    return res.data;
  },

  getWeatherCurrent: async (district = 'Kolhapur') => {
    const res = await client.get('/weather/current', { params: { district } });
    return res.data;
  },

  getWeatherForecast: async (district = 'Kolhapur') => {
    const res = await client.get('/weather/forecast', { params: { district } });
    return res.data;
  },

  syncAll: async (params = {}) => {
    const res = await client.post('/sync/all', params);
    return res.data;
  },

  getFeedbackMetrics: async () => {
    const res = await client.get('/feedback/metrics', { timeout: 3000 });
    return res.data;
  },

  evaluateFeedback: async (params = {}) => {
    const res = await client.post('/feedback/evaluate', null, { params });
    return res.data;
  },

  triggerFeedbackRetrain: async () => {
    const res = await client.post('/feedback/retrain');
    return res.data;
  },
};

module.exports = mlClient;
