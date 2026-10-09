"""
Verification and demo script for the AgriSense Crop Decay Model.
Runs test scenarios for Tomato and Onion across Kolhapur and Sangli
using historical weather from data/processed/weather_history_clean.csv.

Usage:
    python training/test_decay_model.py
"""

import os
import sys

# Ensure ml_service is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.decay_model import DecayModel


def print_simulation_table(result):
    print("=" * 80)
    print(f"CROP: {result.crop.upper()} | DISTRICT: {result.district} | STORAGE: {result.storage_name}")
    print(f"Initial Qty: {result.initial_quantity_quintals} Qtl | Horizon: {result.horizon_days} Days | Safe Holding Limit: {result.safe_holding_days} Days")
    print("-" * 80)
    header = (
        f"{'Day':<4} {'Date':<11} {'Temp':<6} {'RH%':<6} {'Loss/d%':<8} "
        f"{'Qty(Qtl)':<9} {'CumLoss%':<10} {'QualityDisc%':<13} {'ValMult':<8} {'Risk':<9}"
    )
    print(header)
    print("-" * 80)
    for s in result.daily_schedule:
        row = (
            f"{s.day:<4} {s.date:<11} {s.temp_c:<6.1f} {s.humidity_pct:<6.1f} "
            f"{s.daily_total_loss_pct:<8.2f} {s.retained_weight_quintals:<9.2f} "
            f"{s.cumulative_weight_loss_pct:<10.2f} {s.quality_discount_pct:<13.2f} "
            f"{s.effective_value_multiplier:<8.4f} {s.risk_level:<9}"
        )
        print(row)
    print("-" * 80)
    summary = result.summary
    print(f"Final Retained: {summary['final_sellable_weight_quintals']} Qtl ({summary['total_physical_loss_pct']}% physical loss)")
    print(f"Quality Discount: {summary['final_quality_discount_pct']}% | Value Multiplier: {summary['final_value_multiplier']}")
    print(f"Holding Risk: {summary['final_risk_level']} | Decision Signal: {summary['holding_recommendation']}")
    print("=" * 80 + "\n")


def main():
    model = DecayModel()

    # Test date from weather data: e.g., 2026-06-04 (hot/pre-monsoon summer)
    start_date = "2026-06-04"

    # --- Scenario 1: Tomato in Kolhapur — Ambient vs ZECC vs Cold Storage ---
    kolhapur_weather = model.load_weather_from_clean_dataset(
        district="Kolhapur", start_date=start_date, horizon_days=7
    )

    print("\n" + "#" * 80)
    print("  SCENARIOS: TOMATO DECAY (KOLHAPUR, 7 DAYS)")
    print("#" * 80 + "\n")

    res_ambient_tomato = model.simulate(
        crop="tomato",
        initial_quantity_quintals=50.0,
        storage_type="ambient",
        district="Kolhapur",
        start_date=start_date,
        horizon_days=7,
        weather_forecast=kolhapur_weather,
    )
    print_simulation_table(res_ambient_tomato)

    res_zecc_tomato = model.simulate(
        crop="tomato",
        initial_quantity_quintals=50.0,
        storage_type="zecc",
        district="Kolhapur",
        start_date=start_date,
        horizon_days=7,
        weather_forecast=kolhapur_weather,
    )
    print_simulation_table(res_zecc_tomato)

    # --- Scenario 2: Onion in Sangli — Ambient vs Ventilated Kanda Chawl ---
    sangli_weather = model.load_weather_from_clean_dataset(
        district="Sangli", start_date=start_date, horizon_days=14
    )

    print("\n" + "#" * 80)
    print("  SCENARIOS: ONION DECAY (SANGLI, 14 DAYS)")
    print("#" * 80 + "\n")

    res_ambient_onion = model.simulate(
        crop="onion",
        initial_quantity_quintals=100.0,
        storage_type="ambient",
        district="Sangli",
        start_date=start_date,
        horizon_days=14,
        weather_forecast=sangli_weather,
    )
    print_simulation_table(res_ambient_onion)

    res_chawl_onion = model.simulate(
        crop="onion",
        initial_quantity_quintals=100.0,
        storage_type="ventilated_chawl",
        district="Sangli",
        start_date=start_date,
        horizon_days=14,
        weather_forecast=sangli_weather,
    )
    print_simulation_table(res_chawl_onion)


if __name__ == "__main__":
    main()
