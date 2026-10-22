const axios = require('axios');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

const client = axios.create({
  baseURL: ML_SERVICE_URL,
  timeout: 12000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const mlClient = {
  getHealth: async () => {
    try {
      const res = await client.get('/health');
      return { status: 'online', data: res.data };
    } catch (err) {
      return {
        status: 'offline',
        fallbackAvailable: false,
        error: err.code || err.message,
      };
    }
  },

  getSeries: async () => {
    try {
      const res = await client.get('/series');
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
    const res = await client.post('/price/forecast', params);
    return res.data;
  },

  simulateDecay: async (params) => {
    const res = await client.post('/decay/simulate', params);
    return res.data;
  },

  getDecision: async (params) => {
    const res = await client.post('/decide', params);
    return res.data;
  },

  syncDailyPrices: async (params = {}) => {
    const res = await client.post('/price/sync', params);
    return res.data;
  },

  getSyncStatus: async () => {
    const res = await client.get('/price/sync/status');
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
    const res = await client.get('/feedback/metrics');
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

