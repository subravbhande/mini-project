const axios = require('axios');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

const client = axios.create({
  baseURL: ML_SERVICE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const mlClient = {
  getHealth: async () => {
    const res = await client.get('/health');
    return res.data;
  },

  getSeries: async () => {
    const res = await client.get('/series');
    return res.data;
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
};

module.exports = mlClient;
