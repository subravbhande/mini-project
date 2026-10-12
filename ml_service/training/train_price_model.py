"""
AgriSense — Price Model Training Pipeline
Orchestrates weather preparation, feature engineering, model training,
evaluation, and saving.

Usage:
    python training/train_price_model.py
    python training/train_price_model.py --skip-weather   # if weather already processed
"""

from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from training.prepare_weather_data import main as prepare_weather
from models.price_model import PriceModel

ML_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def print_section(title: str) -> None:
    bar = "=" * 70
    print(f"\n{bar}\n  {title}\n{bar}")


def print_metrics(label: str, metrics: dict) -> None:
    print(f"\n  [{label}]")
    print(f"    MAE  : Rs. {metrics['mae_rs_per_quintal']:>8.2f} / Quintal")
    print(f"    RMSE : Rs. {metrics['rmse_rs_per_quintal']:>8.2f} / Quintal")
    print(f"    MAPE : {metrics['mape_pct']:>7.2f} %")
    print(f"    R²   : {metrics['r2']:>9.4f}")


def run_training(skip_weather: bool = False) -> None:

    # ------------------------------------------------------------------
    # Step 1: Prepare weather data
    # ------------------------------------------------------------------
    print_section("STEP 1 — Weather Data Preparation")
    if skip_weather:
        print("  [Skipped] Using existing processed weather files.")
    else:
        prepare_weather()

    # ------------------------------------------------------------------
    # Step 2: Load data & train model
    # ------------------------------------------------------------------
    print_section("STEP 2 — Load Data & Feature Engineering")
    model = PriceModel()

    print("  Loading price history + weather data...")
    df = model.load_and_prepare_data()

    print(f"  Dataset shape after feature engineering: {df.shape}")
    print(f"  Date range : {df['date'].min().date()} -> {df['date'].max().date()}")
    print(f"  Commodities: {df['Commodity'].unique().tolist()}")
    print(f"  Markets    : {df['Market'].unique().tolist()}")
    print(f"  Districts  : {df['District'].unique().tolist()}")

    # ------------------------------------------------------------------
    # Step 3: Train
    # ------------------------------------------------------------------
    print_section("STEP 3 — Model Training (XGBoost)")
    train_info = model.train(df=df)
    print(f"  Training rows : {train_info['train_rows']}")
    print(f"  Test rows     : {train_info['test_rows']}")
    print(f"  Features used : {train_info['n_features']}")
    print(f"  Train MAE     : Rs. {train_info['train_mae_rs_per_quintal']:.2f} / Quintal")

    # ------------------------------------------------------------------
    # Step 4: Evaluate
    # ------------------------------------------------------------------
    print_section("STEP 4 — Evaluation on Held-Out Test Set")
    eval_results = model.evaluate()

    print(f"\n  Test date range: {eval_results['test_date_range']['start']} -> {eval_results['test_date_range']['end']}")
    print_metrics("OVERALL", eval_results["overall"])

    print("\n  --- By Commodity ---")
    for commodity, m in eval_results["by_commodity"].items():
        print_metrics(commodity, m)

    # ------------------------------------------------------------------
    # Step 5: Feature importance
    # ------------------------------------------------------------------
    print_section("STEP 5 — Top 15 Feature Importances")
    importance = model.get_feature_importance(top_n=15)
    for rank, fi in enumerate(importance, start=1):
        bar = "#" * int(fi["importance"] * 500)
        print(f"  {rank:>2}. {fi['feature']:<35} {fi['importance']:.5f}  {bar}")

    # ------------------------------------------------------------------
    # Step 6: Sample 7-day forecast
    # ------------------------------------------------------------------
    print_section("STEP 6 — Sample 7-Day Price Forecast")

    sample_weather = [
        {"temp_mean": 26.0, "temp_max": 31.0, "temp_min": 21.0,
         "precipitation_sum": 2.5, "humidity_mean": 72.0,
         "weather_code": 51, "evapotranspiration": 4.5},
    ] * 7

    for commodity, market, district in [
        ("Tomato", "Kolhapur", "Kolhapur"),
        ("Onion",  "Sangli",   "Sangli"),
    ]:
        forecast = model.predict(
            commodity=commodity, market=market, district=district,
            horizon_days=7, weather_forecast=sample_weather,
        )
        print(f"\n  {commodity} @ {market}")
        print(f"  {'Date':<12} {'Pred Price':>12} {'Min':>8} {'Max':>8} {'Weather Risk'}")
        print(f"  {'-'*55}")
        for f in forecast.daily_forecasts:
            risk = "[!] " + f.weather_risk_reason[:30] if f.weather_risk_flag else "OK"
            print(
                f"  {f.date:<12} {f.predicted_modal_price:>10.0f}   "
                f"{f.predicted_min_price:>8.0f} {f.predicted_max_price:>8.0f}   {risk}"
            )
        s = forecast.summary
        print(f"\n  Summary: Avg={s['forecast_avg_price']:.0f} Rs/Qtl | "
              f"Trend={s['price_trend']} | "
              f"Weather risk days={s['weather_risk_days']}")

    # ------------------------------------------------------------------
    # Step 7: Save model
    # ------------------------------------------------------------------
    print_section("STEP 7 — Saving Model")
    model.save()

    # Also save evaluation results as JSON
    eval_out = os.path.join(ML_ROOT, "models", "saved", "evaluation_results.json")
    with open(eval_out, "w", encoding="utf-8") as f:
        json.dump(eval_results, f, indent=2)
    print(f"  Evaluation results saved -> {eval_out}")

    print("\n" + "=" * 70)
    print("  Training complete!")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AgriSense Price Model Training")
    parser.add_argument(
        "--skip-weather", action="store_true",
        help="Skip weather preprocessing (use existing processed files)"
    )
    args = parser.parse_args()
    run_training(skip_weather=args.skip_weather)
