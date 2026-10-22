const express = require("express");
const router  = express.Router();
const mlClient = require("../services/mlClient");
const weatherService = require("../services/weatherService");

/**
 * POST /api/price/forecast
 * Farmer submits crop details -> gets 7-day price forecast + earnings estimate
 *
 * Request body:
 * {
 *   "commodity": "Tomato",           (required)
 *   "market": "Kolhapur",            (required)
 *   "district": "Kolhapur",          (required)
 *   "quantity_quintals": 50,         (optional - for earnings calc)
 *   "horizon_days": 7,               (optional, default 7)
 *   "start_date": "2026-10-13"       (optional, default tomorrow)
 * }
 */
router.post("/forecast", async (req, res) => {
  const {
    commodity,
    market,
    district,
    quantity_quintals,
    horizon_days,
    start_date,
    weather_forecast,
  } = req.body;

  if (!commodity || !market || !district) {
    return res.status(400).json({
      success: false,
      error: "Required fields: commodity, market, district",
    });
  }

  const validCommodities = ["Tomato", "Onion"];
  if (!validCommodities.includes(commodity)) {
    return res.status(400).json({
      success: false,
      error: `commodity must be one of: ${validCommodities.join(", ")}`,
    });
  }

  try {
    // Automatically retrieve real-time 5-day weather forecast from OpenWeatherMap if not supplied
    let liveWeather = weather_forecast;
    if (!liveWeather || !Array.isArray(liveWeather) || liveWeather.length === 0) {
      try {
        liveWeather = await weatherService.get5DayForecast(district);
      } catch (wErr) {
        console.warn("[PriceForecast] Weather forecast auto-fetch non-fatal:", wErr.message);
      }
    }

    const forecast = await mlClient.getPriceForecast({
      commodity,
      market,
      district,
      quantity_quintals: quantity_quintals ? parseFloat(quantity_quintals) : 0,
      horizon_days: parseInt(horizon_days) || 5,
      start_date: start_date || null,
      weather_forecast: (liveWeather && liveWeather.length > 0) ? liveWeather : null,
    });

    res.json({ success: true, data: forecast });
  } catch (err) {
    console.error("[PriceForecast Error]", err.message);
    const statusCode = err.response?.status || 500;
    const errorMsg = err.response?.data?.detail?.error || err.message || "Failed to generate price forecast.";
    res.status(statusCode).json({ success: false, error: errorMsg });
  }
});

/**
 * GET /api/price/markets
 * Returns all supported commodity-market combinations
 */
router.get("/markets", (req, res) => {
  res.json({
    success: true,
    data: {
      commodities: ["Tomato", "Onion"],
      markets: {
        Tomato: [
          { market: "Kolhapur", district: "Kolhapur" },
          { market: "Islampur", district: "Sangli" },
          { market: "Vadgaonpeth", district: "Kolhapur" },
        ],
        Onion: [
          { market: "Kolhapur", district: "Kolhapur" },
          { market: "Vadgaonpeth", district: "Kolhapur" },
          { market: "Sangli-Phale-Bhajipala", district: "Sangli" },
        ],
      },
    },
  });
});

/**
 * POST /api/price/sync
 * Manually trigger daily price sync from data.gov.in and reload the model.
 */
router.post("/sync", async (req, res) => {
  try {
    const { runDailyPriceSync } = require("../jobs/dailyPriceSyncJob");
    const result = await runDailyPriceSync({
      apiKey: req.body?.api_key || process.env.DATA_GOV_IN_API_KEY,
      forceSeed: Boolean(req.body?.force_seed),
    });
    res.json({ success: true, data: result });
  } catch (err) {
    console.error("[PriceSync Error]", err.message);
    res.status(500).json({ success: false, error: err.message || "Failed to sync daily prices." });
  }
});

/**
 * GET /api/price/sync/status
 * Check current price dataset freshness, staleness, and last sync metadata.
 */
router.get("/sync/status", async (req, res) => {
  try {
    const status = await mlClient.getSyncStatus();
    res.json({ success: true, data: status });
  } catch (err) {
    console.error("[PriceSyncStatus Error]", err.message);
    res.status(500).json({ success: false, error: err.message || "Failed to retrieve sync status." });
  }
});

/**
 * GET /api/price/weather/current
 * Live current weather for Kolhapur or Sangli from OpenWeatherMap
 */
router.get("/weather/current", async (req, res) => {
  const district = req.query.district || "Kolhapur";
  try {
    const data = await weatherService.getCurrentWeather(district);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/price/weather/forecast
 * 5-day daily meteorological forecast for Kolhapur or Sangli
 */
router.get("/weather/forecast", async (req, res) => {
  const district = req.query.district || "Kolhapur";
  try {
    const data = await weatherService.get5DayForecast(district);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/price/weather/sync
 * Manually trigger daily weather sync and update MongoDB weather_cache
 */
router.post("/weather/sync", async (req, res) => {
  try {
    const result = await weatherService.syncDailyWeather();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
