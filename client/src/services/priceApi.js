import axios from "axios";

const LIVE_BACKEND_URL = "https://agrisense-backend-7pza.onrender.com";

let configuredUrl = import.meta.env.VITE_API_URL || "";
if (configuredUrl.includes("ml-service")) {
  configuredUrl = LIVE_BACKEND_URL;
}

// Check if running on localhost / 127.0.0.1
const isLocalhost =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "");

const BASE_URL =
  configuredUrl ||
  (!isLocalhost ? LIVE_BACKEND_URL : "http://localhost:5000");

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 35000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach JWT token from localStorage if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("agrisense_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Automatic fallback from unreachable local backend (port 5000) to cloud backend
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (
      config &&
      !config._fallbackTried &&
      config.baseURL === "http://localhost:5000" &&
      (!error.response || error.code === "ERR_NETWORK" || error.code === "ECONNREFUSED")
    ) {
      console.warn(
        "[API] Localhost backend unreachable. Seamlessly retrying request against live cloud backend:",
        LIVE_BACKEND_URL
      );
      config._fallbackTried = true;
      config.baseURL = LIVE_BACKEND_URL;
      return api(config);
    }
    return Promise.reject(error);
  }
);

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
 * Submit farmer query and get price forecast (Public).
 */
export async function fetchPriceForecast(params) {
  const res = await api.post("/api/price/forecast", params);
  return res.data.data;
}

/**
 * Direct evaluation of distress sale timing decision (Public).
 */
export async function evaluateTimingDecision(params) {
  const res = await api.post("/api/decision/evaluate", params);
  return res.data.data;
}

/* =========================================================================
   Farmer Authentication & OTP APIs
   ========================================================================= */

export async function sendOtpApi(phone, purpose = "register") {
  const res = await api.post("/api/auth/send-otp", { phone, purpose });
  return res.data;
}

export async function verifyOtpApi(phone, otp, purpose = "register") {
  const res = await api.post("/api/auth/verify-otp", { phone, otp, purpose });
  return res.data;
}

export async function registerApi(payload) {
  const res = await api.post("/api/auth/register", payload);
  return res.data;
}

export async function loginApi(phone, pin) {
  const res = await api.post("/api/auth/login", { phone, pin });
  return res.data;
}

export async function resetPinApi(payload) {
  const res = await api.post("/api/auth/reset-pin", payload);
  return res.data;
}

export async function fetchCurrentUserApi() {
  const res = await api.get("/api/auth/me");
  return res.data.user;
}

export async function updateProfileApi(payload) {
  const res = await api.put("/api/auth/profile", payload);
  return res.data.user;
}

/* =========================================================================
   Harvest Batches, Outcomes & Financial Insights
   ========================================================================= */

export async function fetchUserBatchesApi() {
  const res = await api.get("/api/batch");
  return res.data.data || [];
}

export async function createBatchApi(payload) {
  const res = await api.post("/api/batch", payload);
  return res.data;
}

export async function fetchBatchDetailsApi(batchId) {
  const res = await api.get(`/api/batch/${batchId}`);
  return res.data;
}

export async function deleteBatchApi(batchId) {
  const res = await api.delete(`/api/batch/${batchId}`);
  return res.data;
}

export async function recordSaleOutcomeApi(payload) {
  const res = await api.post("/api/decision/outcome", payload);
  return res.data;
}

export async function fetchHistorySummaryApi() {
  const res = await api.get("/api/batch/stats/summary");
  return res.data?.data || res.data || {};
}

export default api;
