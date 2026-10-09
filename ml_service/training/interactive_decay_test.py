"""
AgriSense — Interactive Decay Model CLI Tester
Allows testing decay with custom arguments or interactive prompts.

Usage:
    python training/interactive_decay_test.py --crop tomato --storage ambient --district Kolhapur --days 7 --qty 50
    python training/interactive_decay_test.py --crop onion --storage ventilated_chawl --district Sangli --days 14 --qty 100
    python training/interactive_decay_test.py --interactive
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.decay_model import DecayModel


def run_test(crop, storage, district, days, qty, date_str=None):
    model = DecayModel()

    weather = []
    if date_str:
        weather = model.load_weather_from_clean_dataset(
            district=district, start_date=date_str, horizon_days=days
        )

    res = model.simulate(
        crop=crop,
        initial_quantity_quintals=qty,
        storage_type=storage,
        district=district,
        start_date=date_str,
        horizon_days=days,
        weather_forecast=weather if weather else None,
    )

    print("\n" + "=" * 82)
    print(f"  AGRISENSE DECAY SIMULATION: {res.crop.upper()}")
    print("=" * 82)
    print(f"District: {res.district:<15} | Storage Facility: {res.storage_name}")
    print(f"Initial Quantity: {res.initial_quantity_quintals:.1f} Qtl  | Holding Horizon: {res.horizon_days} Days")
    print(f"Safe Holding Limit: {res.safe_holding_days} Days  | Critical Loss Cutoff: {res.critical_threshold_pct:.1f}%")
    print("-" * 82)
    header = (
        f"{'Day':<4} {'Date':<11} {'Temp':<6} {'RH%':<6} {'Loss/d%':<8} "
        f"{'Sellable(Qtl)':<14} {'CumLoss%':<10} {'QualityDisc%':<13} {'Risk':<9}"
    )
    print(header)
    print("-" * 82)

    for s in res.daily_schedule:
        risk_tag = s.risk_level
        print(
            f"{s.day:<4} {s.date:<11} {s.temp_c:<6.1f} {s.humidity_pct:<6.1f} "
            f"{s.daily_total_loss_pct:<8.2f} {s.retained_weight_quintals:<14.2f} "
            f"{s.cumulative_weight_loss_pct:<10.2f} {s.quality_discount_pct:<13.2f} {risk_tag:<9}"
        )

    print("-" * 82)
    s = res.summary
    print(f"SUMMARY:")
    print(f"  • Retained Weight     : {s['final_sellable_weight_quintals']:.2f} Quintals (from {res.initial_quantity_quintals:.1f} Qtl)")
    print(f"  • Physical Loss       : {s['total_physical_loss_pct']:.2f}%")
    print(f"  • Quality Discount    : {s['final_quality_discount_pct']:.2f}% (APMC grade downgrade)")
    print(f"  • Commercial Value Multiplier : {s['final_value_multiplier']:.4f}")
    print(f"  • Final Risk Level    : {s['final_risk_level']}")
    print(f"  • Decision Signal     : {s['holding_recommendation']}")
    print("=" * 82 + "\n")


def main():
    parser = argparse.ArgumentParser(description="AgriSense Decay Model Tester")
    parser.add_argument("--crop", choices=["tomato", "onion"], default="tomato", help="Commodity")
    parser.add_argument(
        "--storage",
        choices=["ambient", "ventilated_chawl", "zecc", "cold_storage"],
        default="ambient",
        help="Storage type",
    )
    parser.add_argument("--district", choices=["Kolhapur", "Sangli"], default="Kolhapur", help="District")
    parser.add_argument("--days", type=int, default=7, help="Horizon days (e.g. 7, 10, 14)")
    parser.add_argument("--qty", type=float, default=50.0, help="Initial quantity in Quintals")
    parser.add_argument("--date", type=str, default="2026-06-04", help="Start date (YYYY-MM-DD)")
    parser.add_argument("--interactive", action="store_true", help="Prompt user for inputs")

    args = parser.parse_args()

    if args.interactive:
        print("\n--- Interactive AgriSense Decay Test ---")
        crop = input("Select crop [tomato/onion] (default: tomato): ").strip() or "tomato"
        district = input("District [Kolhapur/Sangli] (default: Kolhapur): ").strip() or "Kolhapur"
        if crop.lower() == "onion":
            storage = input("Storage [ambient/ventilated_chawl/cold_storage] (default: ventilated_chawl): ").strip() or "ventilated_chawl"
            default_days = 14
        else:
            storage = input("Storage [ambient/zecc/cold_storage] (default: ambient): ").strip() or "ambient"
            default_days = 7
        days_in = input(f"Horizon days (default: {default_days}): ").strip()
        days = int(days_in) if days_in else default_days
        qty_in = input("Initial quantity in Quintals (default: 50): ").strip()
        qty = float(qty_in) if qty_in else 50.0
        date_in = input("Start date YYYY-MM-DD (default: 2026-06-04): ").strip() or "2026-06-04"
        run_test(crop, storage, district, days, qty, date_in)
    else:
        run_test(args.crop, args.storage, args.district, args.days, args.qty, args.date)


if __name__ == "__main__":
    main()
