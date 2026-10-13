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
    horizon_days    = int(payload.get("horizon_days", 5) or 5)
    horizon_days    = min(max(horizon_days, 1), 5)
    weather         = payload.get("weather_forecast")

    forecast = model.predict(
        commodity=commodity,
        market=market,
        district=district,
        as_of=start_date if (start_date and str(start_date).strip()) else None,
        horizon_days=horizon_days,
        weather_forecast=weather,
    )

    result = forecast.to_dict()

    # Add farmer-friendly summary and UI compatibility fields
    daily = result.get("daily_forecasts", [])
    if daily:
        for d in daily:
            d["predicted_min_price"] = d.get("typical_daily_spread_min") or d.get("confidence_band_low") or round(d["predicted_modal_price"] * 0.95, 2)
            d["predicted_max_price"] = d.get("typical_daily_spread_max") or d.get("confidence_band_high") or round(d["predicted_modal_price"] * 1.05, 2)
            if "weather" not in d:
                d["weather"] = {
                    "temp_max_c": 31,
                    "precipitation_mm": 25 if d.get("weather_risk_flag") else 0,
                }

        best_day   = max(daily, key=lambda d: d["predicted_modal_price"])
        worst_day  = min(daily, key=lambda d: d["predicted_modal_price"])
        avg_price  = round(sum(d["predicted_modal_price"] for d in daily) / len(daily), 2)

        summary_obj = result.get("summary", {})
        overall_trend = summary_obj.get("overall_trend", "STABLE")
        price_trend = "UP" if overall_trend == "RISING" else ("DOWN" if overall_trend == "FALLING" else "STABLE")
        weather_risk_dates = [d["date"] for d in daily if d.get("weather_risk_flag")]

        summary_obj["forecast_avg_price"] = avg_price
        summary_obj["price_trend"] = price_trend
        summary_obj["weather_risk_days"] = len(weather_risk_dates)
        result["summary"] = summary_obj

        farmer_summary = {
            "best_sell_date":          best_day["date"],
            "best_sell_price":         best_day["predicted_modal_price"],
            "worst_sell_date":         worst_day["date"],
            "worst_sell_price":        worst_day["predicted_modal_price"],
            "price_trend":             price_trend,
            "weather_risk_days":       weather_risk_dates,
            "recommendation":          (
                "SELL_NOW" if price_trend == "DOWN"
                else "HOLD_FOR_BEST_PRICE" if price_trend == "UP"
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
