import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

/** Fetch all supported markets from backend */
export async function fetchMarkets() {
  const res = await axios.get(`${BASE_URL}/api/price/markets`);
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
  const res = await axios.post(`${BASE_URL}/api/price/forecast`, params);
  return res.data.data;
}
