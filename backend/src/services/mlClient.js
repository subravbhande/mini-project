const axios = require('axios');
const { getPriceForecast: runPythonPriceForecast } = require('./mlService');

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
        fallbackAvailable: true,
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
        count: 7,
        supported_series: [
          { crop: 'tomato', crop_display: 'Tomato', market: 'Kolhapur', district: 'Kolhapur' },
          { crop: 'tomato', crop_display: 'Tomato', market: 'Vadgaonpeth', district: 'Kolhapur' },
          { crop: 'tomato', crop_display: 'Tomato', market: 'Islampur', district: 'Sangli' },
          { crop: 'onion', crop_display: 'Onion', market: 'Kolhapur', district: 'Kolhapur' },
          { crop: 'onion', crop_display: 'Onion', market: 'Vadgaonpeth', district: 'Kolhapur' },
          { crop: 'onion', crop_display: 'Onion', market: 'Sangli', district: 'Sangli' },
          { crop: 'onion', crop_display: 'Onion', market: 'Sangli-Phale-Bhajipala', district: 'Sangli' },
        ],
      };
    }
  },

  getPriceForecast: async (params) => {
    try {
      // 1. Try high-performance HTTP ML service
      const res = await client.post('/price/forecast', params);
      return res.data;
    } catch (err) {
      // 2. If HTTP microservice is unreachable, fall back to Python process
      const isConnectionIssue = err.code === 'ECONNREFUSED' ||
        err.code === 'ETIMEDOUT' ||
        err.code === 'ENOTFOUND' ||
        !err.response;

      if (isConnectionIssue) {
        console.warn(`[ML Client] HTTP microservice offline at ${ML_SERVICE_URL} (${err.code || err.message}). Seamlessly engaging Python fallback.`);
        return await runPythonPriceForecast(params);
      }
      throw err;
    }
  },

  simulateDecay: async (params) => {
    const res = await client.post('/decay/simulate', params);
    return res.data;
  },

  getDecision: async (params) => {
    const res = await client.post('/decide', params);
    return res.data;
  },
};

module.exports = mlClient;

