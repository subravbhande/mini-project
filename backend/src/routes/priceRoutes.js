const express = require("express");
const router  = express.Router();
const { getPriceForecast } = require("../services/mlService");

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
    const forecast = await getPriceForecast({
      commodity,
      market,
      district,
      quantity_quintals: quantity_quintals ? parseFloat(quantity_quintals) : 0,
      horizon_days: parseInt(horizon_days) || 7,
      start_date: start_date || null,
      weather_forecast: weather_forecast || null,
    });

    res.json({ success: true, data: forecast });
  } catch (err) {
    console.error("[PriceForecast Error]", err.message);
    res.status(500).json({ success: false, error: err.message });
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
          { market: "Sangli", district: "Sangli" },
          { market: "Kolhapur", district: "Kolhapur" },
          { market: "Vadgaonpeth", district: "Kolhapur" },
          { market: "Sangli-Phale-Bhajipala", district: "Sangli" },
        ],
      },
    },
  });
});

module.exports = router;
