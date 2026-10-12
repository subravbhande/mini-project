"""
AgriSense ML Bridge -- called by Node.js via child_process.
Reads JSON from stdin, runs price prediction, writes JSON to stdout.

Input JSON:
  {
    "commodity": "Tomato",
    "market": "Kolhapur",
    "district": "Kolhapur",
    "quantity_quintals": 50,
    "start_date": "2026-10-13",   (optional)
    "horizon_days": 7,            (optional, default 7)
    "weather_forecast": [...]     (optional)
  }

Output JSON: PriceForecast + farmer_summary
"""
import sys
import json
import os
import contextlib

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Redirect intermediate model logs to stderr so stdout is 100% clean JSON for Node.js
with contextlib.redirect_stdout(sys.stderr):
    from models.price_model import PriceModel

    # Load model instance
    model = PriceModel.load()

    # Read stdin payload
    raw_input = sys.stdin.read()
    payload = json.loads(raw_input)

    commodity       = payload["commodity"]
    market          = payload["market"]
    district        = payload["district"]
    quantity        = float(payload.get("quantity_quintals", 0) or 0)
    start_date      = payload.get("start_date")
    horizon_days    = int(payload.get("horizon_days", 7))
    weather         = payload.get("weather_forecast")

    forecast = model.predict(
        commodity=commodity,
        market=market,
        district=district,
        start_date=start_date,
        horizon_days=horizon_days,
        weather_forecast=weather,
    )

    result = forecast.to_dict()

    # Add farmer-friendly summary
    daily = result.get("daily_forecasts", [])
    if daily:
        best_day   = max(daily, key=lambda d: d["predicted_modal_price"])
        worst_day  = min(daily, key=lambda d: d["predicted_modal_price"])
        avg_price  = result["summary"]["forecast_avg_price"]

        farmer_summary = {
            "best_sell_date":          best_day["date"],
            "best_sell_price":         best_day["predicted_modal_price"],
            "worst_sell_date":         worst_day["date"],
            "worst_sell_price":        worst_day["predicted_modal_price"],
            "price_trend":             result["summary"]["price_trend"],
            "weather_risk_days":       result["summary"]["weather_risk_days"],
            "recommendation":          (
                "SELL_NOW" if result["summary"]["price_trend"] == "DOWN"
                else "HOLD_FOR_BEST_PRICE" if result["summary"]["price_trend"] == "UP"
                else "SELL_ANYTIME"
            ),
        }

        if quantity > 0:
            farmer_summary["estimated_earnings_best_day"]  = round(best_day["predicted_modal_price"]  * quantity, 2)
            farmer_summary["estimated_earnings_today"]     = round(daily[0]["predicted_modal_price"]   * quantity, 2)
            farmer_summary["estimated_earnings_avg"]       = round(avg_price                           * quantity, 2)
            farmer_summary["quantity_quintals"]            = quantity

        result["farmer_summary"] = farmer_summary

# Emit pure JSON to stdout
sys.stdout.write(json.dumps(result))
sys.stdout.flush()
