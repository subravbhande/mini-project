"""
AgriSense ML Bridge -- called by Node.js via child_process.
Reads JSON from stdin, runs price prediction or timing decision, writes JSON to stdout.

Input JSON:
  {
    "mode": "forecast" | "decide",
    "commodity": "Tomato",
    "market": "Kolhapur",
    "district": "Kolhapur",
    "quantity_quintals": 50,
    "storage_type": "ambient",       (for decide mode)
    "liquidity_need": "normal",      (for decide mode)
    "start_date": "2026-10-13",      (optional)
    "horizon_days": 5,               (optional, default 5)
    "weather_forecast": [...]        (optional)
  }

Output JSON: PriceForecast OR DecisionResult
"""
import sys
import json
import os
import contextlib
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Redirect intermediate model logs to stderr so stdout is 100% clean JSON for Node.js
with contextlib.redirect_stdout(sys.stderr):
    from models.price_model import PriceModel
    from models.decay_model import DecayModel
    from app.decision_engine import evaluate_decision

    # Read stdin payload
    raw_input = sys.stdin.read()
    payload = json.loads(raw_input)

    mode = payload.get("mode", "forecast")
    if "storage_type" in payload and mode != "forecast":
        mode = "decide"

    commodity = payload["commodity"]
    market = payload["market"]
    district = payload.get("district")
    quantity = float(payload.get("quantity_quintals") or payload.get("initial_quantity_quintals") or 50.0)
    start_date = payload.get("start_date") or payload.get("as_of")
    horizon_days = int(payload.get("horizon_days", 5) or 5)
    horizon_days = min(max(horizon_days, 1), 5)
    weather = payload.get("weather_forecast")

    price_model = PriceModel.load()

    if mode == "decide":
        decay_model = DecayModel()
        storage_type = payload.get("storage_type", "ambient")
        harvest_date = payload.get("harvest_date")
        liquidity_need = payload.get("liquidity_need", "normal")

        # 1. Price Prediction
        price_res = price_model.predict(
            commodity=commodity,
            market=market,
            district=district,
            as_of=start_date if (start_date and str(start_date).strip()) else None,
            horizon_days=horizon_days,
            weather_forecast=weather,
        )
        price_dict = price_res.to_dict()

        # Add min/max price and weather to daily forecasts
        daily = price_dict.get("daily_forecasts", [])
        if daily:
            for d in daily:
                d["predicted_min_price"] = d.get("typical_daily_spread_min") or d.get("confidence_band_low") or round(d["predicted_modal_price"] * 0.95, 2)
                d["predicted_max_price"] = d.get("typical_daily_spread_max") or d.get("confidence_band_high") or round(d["predicted_modal_price"] * 1.05, 2)
                if "weather" not in d:
                    d["weather"] = {
                        "temp_max_c": 31,
                        "precipitation_mm": 25 if d.get("weather_risk_flag") else 0,
                    }

        # 2. Decay Simulation
        decay_res = decay_model.simulate(
            crop=commodity,
            initial_quantity_quintals=quantity,
            storage_type=storage_type,
            district=price_res.district,
            harvest_date=harvest_date,
            as_of=start_date if (start_date and str(start_date).strip()) else None,
            horizon_days=horizon_days,
            weather_forecast=weather,
        )
        decay_dict = decay_res.to_dict()

        # 3. Storage Cost Rate & Value Multiplier
        storage_meta = decay_model.storage_types.get(decay_res.storage_type, {})
        storage_cost_rate = float(storage_meta.get("cost_per_quintal_per_day", 0.0))
        effective_query_date = str(start_date or date.today())[:10]
        decay_summary = decay_dict.get("summary", {})
        eff_mult_today = float(decay_summary.get("effective_value_multiplier_today", 1.0))

        # 4. Economic Optimization
        economic_res = evaluate_decision(
            price_forecast_schedule=price_dict["daily_forecasts"],
            decay_schedule=decay_dict["daily_schedule"],
            initial_quantity_quintals=quantity,
            storage_cost_per_quintal_per_day=storage_cost_rate,
            liquidity_need=liquidity_need,
            base_price_today=price_dict["summary"]["last_observed_price"],
            as_of_date=effective_query_date,
            current_value_multiplier_today=eff_mult_today,
        )

        result = {
            "commodity": price_res.commodity,
            "market": price_res.market,
            "district": price_res.district,
            "decision": economic_res.decision,
            "sell_fraction": economic_res.sell_fraction,
            "act_by_date": economic_res.act_by_date,
            "recommended_holding_days": economic_res.recommended_holding_days,
            "nrv_today": round(economic_res.nrv_today, 2),
            "nrv_best": round(economic_res.nrv_best, 2),
            "uplift_pct": round(economic_res.uplift_pct, 2),
            "confidence_label": economic_res.confidence_label,
            "break_even_price_best_day": round(economic_res.break_even_price_best_day, 2),
            "break_even_pct_best_day": round(economic_res.break_even_pct_best_day, 2),
            "reason": economic_res.reason,
            "reason_mr": economic_res.reason_mr,
            "data_as_of": price_res.data_as_of,
            "last_observed_price": round(float(price_dict.get("summary", {}).get("last_observed_price", 0.0)), 2),
            "days_stale": price_res.days_stale,
            "stale": price_res.stale,
            "warnings": decay_res.warnings,
            "price_forecast": price_dict,
            "decay_simulation": decay_dict,
            "economic_decision": economic_res.to_dict(),
        }

    else:
        # Standard price forecast
        forecast = price_model.predict(
            commodity=commodity,
            market=market,
            district=district,
            as_of=start_date if (start_date and str(start_date).strip()) else None,
            horizon_days=horizon_days,
            weather_forecast=weather,
        )

        result = forecast.to_dict()

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
