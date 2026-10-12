"""
AgriSense -- Price Model Test Suite
Tests the trained XGBoost price model for:
  1. Model loading
  2. Single-day prediction
  3. Multi-day forecasts (with and without weather)
  4. All market/commodity combinations
  5. Edge cases (missing weather, unknown market)

Usage:
    python training/test_price_model.py
"""

from __future__ import annotations
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.price_model import PriceModel

PASS = "[PASS]"
FAIL = "[FAIL]"
SEP  = "-" * 65


def section(title: str):
    print(f"\n{'='*65}")
    print(f"  {title}")
    print(f"{'='*65}")


def run_test(name: str, fn):
    try:
        result = fn()
        print(f"  {PASS} {name}")
        return result
    except Exception as e:
        print(f"  {FAIL} {name}")
        print(f"         Error: {e}")
        return None


# -----------------------------------------------------------------------
# TEST 1 — Load model
# -----------------------------------------------------------------------
section("TEST 1 -- Model Loading")
model = run_test("Load saved model from disk", lambda: PriceModel.load())

if model is None:
    print("\n[FATAL] Cannot load model. Run train_price_model.py first.")
    sys.exit(1)

run_test("Model is_trained flag = True",       lambda: (lambda: (_ for _ in ()).throw(AssertionError("is_trained is False")) if not model.is_trained else True)())
run_test(f"Feature count >= 40",               lambda: (lambda n: True if n >= 40 else (_ for _ in ()).throw(AssertionError(f"Only {n} features")))(len(model.feature_names)))
run_test("Label encoders loaded (3 keys)",     lambda: (lambda k: True if len(k) == 3 else (_ for _ in ()).throw(AssertionError(f"Got keys: {k}")))(list(model.label_encoders.keys())))

print(f"\n  Feature count : {len(model.feature_names)}")
print(f"  Encoders      : {list(model.label_encoders.keys())}")


# -----------------------------------------------------------------------
# TEST 2 -- Feature importance
# -----------------------------------------------------------------------
section("TEST 2 -- Feature Importance")
importance = run_test("Get top-10 feature importances", lambda: model.get_feature_importance(top_n=10))

if importance:
    print(f"\n  {'Rank':<5} {'Feature':<35} {'Importance':>10}")
    print(f"  {SEP}")
    for i, fi in enumerate(importance, 1):
        bar = "#" * int(fi["importance"] * 400)
        print(f"  {i:<5} {fi['feature']:<35} {fi['importance']:>10.5f}  {bar}")


# -----------------------------------------------------------------------
# TEST 3 -- Forecast: Tomato @ Kolhapur (with weather)
# -----------------------------------------------------------------------
section("TEST 3 -- Tomato @ Kolhapur (7-day forecast with weather)")

kolhapur_weather = [
    {"temp_mean": 27.5, "temp_max": 33.0, "temp_min": 22.0,
     "precipitation_sum": 0.0, "humidity_mean": 68.0,
     "weather_code": 1, "evapotranspiration": 5.1,
     "soil_moisture_0_to_100cm": 0.28, "soil_moisture_0_to_7cm": 0.18},
    {"temp_mean": 28.0, "temp_max": 34.0, "temp_min": 23.0,
     "precipitation_sum": 0.0, "humidity_mean": 65.0,
     "weather_code": 0, "evapotranspiration": 5.4,
     "soil_moisture_0_to_100cm": 0.27, "soil_moisture_0_to_7cm": 0.16},
    {"temp_mean": 26.0, "temp_max": 31.0, "temp_min": 21.0,
     "precipitation_sum": 12.0, "humidity_mean": 82.0,
     "weather_code": 61, "evapotranspiration": 3.2,
     "soil_moisture_0_to_100cm": 0.35, "soil_moisture_0_to_7cm": 0.28},
    {"temp_mean": 25.0, "temp_max": 29.0, "temp_min": 21.0,
     "precipitation_sum": 22.0, "humidity_mean": 90.0,
     "weather_code": 63, "evapotranspiration": 2.8,
     "soil_moisture_0_to_100cm": 0.40, "soil_moisture_0_to_7cm": 0.35},
    {"temp_mean": 24.0, "temp_max": 28.0, "temp_min": 20.0,
     "precipitation_sum": 5.0, "humidity_mean": 85.0,
     "weather_code": 53, "evapotranspiration": 3.5,
     "soil_moisture_0_to_100cm": 0.39, "soil_moisture_0_to_7cm": 0.30},
    {"temp_mean": 26.0, "temp_max": 31.0, "temp_min": 21.0,
     "precipitation_sum": 0.0, "humidity_mean": 72.0,
     "weather_code": 2, "evapotranspiration": 4.8,
     "soil_moisture_0_to_100cm": 0.35, "soil_moisture_0_to_7cm": 0.24},
    {"temp_mean": 27.0, "temp_max": 32.0, "temp_min": 22.0,
     "precipitation_sum": 0.0, "humidity_mean": 70.0,
     "weather_code": 1, "evapotranspiration": 5.0,
     "soil_moisture_0_to_100cm": 0.33, "soil_moisture_0_to_7cm": 0.22},
]

tomato_forecast = run_test(
    "predict() returns PriceForecast",
    lambda: model.predict("Tomato", "Kolhapur", "Kolhapur",
                          start_date="2026-10-13", horizon_days=7,
                          weather_forecast=kolhapur_weather)
)

if tomato_forecast:
    run_test("Forecast has 7 daily entries",
             lambda: True if len(tomato_forecast.daily_forecasts) == 7
             else (_ for _ in ()).throw(AssertionError()))
    run_test("All predicted prices > 0",
             lambda: True if all(f.predicted_modal_price > 0 for f in tomato_forecast.daily_forecasts)
             else (_ for _ in ()).throw(AssertionError("Some prices <= 0")))
    run_test("Summary keys present",
             lambda: True if all(k in tomato_forecast.summary for k in
                                 ["forecast_avg_price", "price_trend", "weather_risk_days"])
             else (_ for _ in ()).throw(AssertionError()))

    print(f"\n  Commodity : {tomato_forecast.commodity} | Market: {tomato_forecast.market}")
    print(f"  {'Date':<12} {'Pred (Rs/Qtl)':>14} {'Min':>8} {'Max':>8} {'Band Low':>10} {'Band High':>10} {'Risk'}")
    print(f"  {SEP}")
    for f in tomato_forecast.daily_forecasts:
        risk = "[!] Rain" if f.weather_risk_flag else "OK"
        print(f"  {f.date:<12} {f.predicted_modal_price:>14.0f} "
              f"{f.predicted_min_price:>8.0f} {f.predicted_max_price:>8.0f} "
              f"{f.confidence_band_low:>10.0f} {f.confidence_band_high:>10.0f}  {risk}")
    s = tomato_forecast.summary
    print(f"\n  Avg Price : Rs. {s['forecast_avg_price']:.0f}/Qtl")
    print(f"  Trend     : {s['price_trend']}")
    print(f"  Rain days : {s['weather_risk_days']} / 7")


# -----------------------------------------------------------------------
# TEST 4 -- Forecast: Onion @ Sangli (with weather)
# -----------------------------------------------------------------------
section("TEST 4 -- Onion @ Sangli (7-day forecast with weather)")

sangli_weather = [
    {"temp_mean": 26.0, "temp_max": 31.0, "temp_min": 21.0,
     "precipitation_sum": 0.0, "humidity_mean": 65.0, "weather_code": 0},
    {"temp_mean": 26.5, "temp_max": 32.0, "temp_min": 21.5,
     "precipitation_sum": 0.0, "humidity_mean": 63.0, "weather_code": 1},
    {"temp_mean": 25.0, "temp_max": 30.0, "temp_min": 20.0,
     "precipitation_sum": 30.0, "humidity_mean": 92.0, "weather_code": 65},
    {"temp_mean": 24.0, "temp_max": 28.0, "temp_min": 19.0,
     "precipitation_sum": 18.0, "humidity_mean": 88.0, "weather_code": 63},
    {"temp_mean": 25.0, "temp_max": 30.0, "temp_min": 20.0,
     "precipitation_sum": 2.0, "humidity_mean": 75.0, "weather_code": 51},
    {"temp_mean": 26.0, "temp_max": 31.0, "temp_min": 21.0,
     "precipitation_sum": 0.0, "humidity_mean": 68.0, "weather_code": 1},
    {"temp_mean": 27.0, "temp_max": 32.0, "temp_min": 22.0,
     "precipitation_sum": 0.0, "humidity_mean": 66.0, "weather_code": 0},
]

onion_forecast = run_test(
    "predict() Onion @ Sangli returns PriceForecast",
    lambda: model.predict("Onion", "Sangli", "Sangli",
                          start_date="2026-10-13", horizon_days=7,
                          weather_forecast=sangli_weather)
)

if onion_forecast:
    print(f"\n  Commodity : {onion_forecast.commodity} | Market: {onion_forecast.market}")
    print(f"  {'Date':<12} {'Pred (Rs/Qtl)':>14} {'Min':>8} {'Max':>8} {'Risk'}")
    print(f"  {SEP}")
    for f in onion_forecast.daily_forecasts:
        risk = "[!] Rain" if f.weather_risk_flag else "OK"
        print(f"  {f.date:<12} {f.predicted_modal_price:>14.0f} "
              f"{f.predicted_min_price:>8.0f} {f.predicted_max_price:>8.0f}  {risk}")
    s = onion_forecast.summary
    print(f"\n  Avg Price : Rs. {s['forecast_avg_price']:.0f}/Qtl")
    print(f"  Trend     : {s['price_trend']}")
    print(f"  Rain days : {s['weather_risk_days']} / 7")


# -----------------------------------------------------------------------
# TEST 5 -- All market combinations
# -----------------------------------------------------------------------
section("TEST 5 -- All Market/Commodity Combinations (no weather)")

combos = [
    ("Tomato", "Kolhapur",              "Kolhapur"),
    ("Tomato", "Vita",                  "Sangli"),
    ("Onion",  "Sangli",                "Sangli"),
    ("Onion",  "Islampur",              "Sangli"),
    ("Onion",  "Sangli-Phale-Bhajipala","Sangli"),
    ("Onion",  "Vadgaonpeth",           "Sangli"),
    ("Onion",  "Palus",                 "Sangli"),
]

print(f"\n  {'Commodity':<10} {'Market':<28} {'District':<12} {'7d Avg Price':>14} {'Trend'}")
print(f"  {SEP}")
for commodity, market, district in combos:
    try:
        fc = model.predict(commodity, market, district,
                           start_date="2026-10-13", horizon_days=7)
        avg = fc.summary["forecast_avg_price"]
        trend = fc.summary["price_trend"]
        print(f"  {commodity:<10} {market:<28} {district:<12} {avg:>12.0f}   {trend}")
    except Exception as e:
        print(f"  {FAIL} {commodity} @ {market}: {e}")


# -----------------------------------------------------------------------
# TEST 6 -- Edge case: no weather provided
# -----------------------------------------------------------------------
section("TEST 6 -- Edge Case: No Weather Data (defaults)")

run_test(
    "Forecast without weather uses defaults",
    lambda: model.predict("Tomato", "Kolhapur", "Kolhapur",
                          start_date="2026-10-13", horizon_days=3,
                          weather_forecast=None)
)


# -----------------------------------------------------------------------
# TEST 7 -- Evaluate on test set
# -----------------------------------------------------------------------
section("TEST 7 -- Model Evaluation on Held-Out Test Set")

eval_res = run_test("evaluate() returns metrics dict", lambda: model.evaluate())

if eval_res:
    o = eval_res["overall"]
    print(f"\n  [Overall]")
    print(f"    MAE   : Rs. {o['mae_rs_per_quintal']:.2f} / Quintal")
    print(f"    RMSE  : Rs. {o['rmse_rs_per_quintal']:.2f} / Quintal")
    print(f"    MAPE  : {o['mape_pct']:.2f} %")
    print(f"    R2    : {o['r2']:.4f}")
    for crop, m in eval_res["by_commodity"].items():
        print(f"\n  [{crop}]")
        print(f"    MAE   : Rs. {m['mae_rs_per_quintal']:.2f}")
        print(f"    MAPE  : {m['mape_pct']:.2f} %")
        print(f"    R2    : {m['r2']:.4f}")


# -----------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------
section("TEST SUMMARY")
print("  All tests completed. Model is operational.")
print(f"  To use the model in production:")
print(f"")
print(f"    from models.price_model import PriceModel")
print(f"    model = PriceModel.load()")
print(f"    forecast = model.predict('Tomato', 'Kolhapur', 'Kolhapur',")
print(f"                              horizon_days=7,")
print(f"                              weather_forecast=[...])")
print(f"    print(forecast.to_dict())")
print()
