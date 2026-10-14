import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * Fetch system health status (Database connection + ML model status)
 */
export async function fetchHealth() {
  const res = await api.get("/api/health");
  return res.data;
}

/**
 * Fetch all supported markets from backend
 */
export async function fetchMarkets() {
  const res = await api.get("/api/price/markets");
  return res.data.data;
}

/**
 * Submit farmer query and get price forecast.
 * @param {Object} params
 * @param {string} params.commodity
 * @param {string} params.market
 * @param {string} params.district
 * @param {number} params.quantity_quintals
 * @param {number} params.horizon_days
 */
export async function fetchPriceForecast(params) {
  const res = await api.post("/api/price/forecast", params);
  return res.data.data;
}

/**
 * Direct evaluation of distress sale timing decision (Price + Decay + NRV Optimization)
 * @param {Object} params
 */
export async function evaluateTimingDecision(params) {
  const res = await api.post("/api/decision/evaluate", params);
  return res.data.data;
}

export default api;
