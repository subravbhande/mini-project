"""
Phase 1 — Series filtering
Drops (District, Market, Commodity) series that are too sparse to
contribute usefully to the pooled model, using the coverage report
from coverage_report.py.

A series is dropped if EITHER:
  - it has fewer than MIN_ROWS total observations (not enough signal
    to learn from, even pooled), OR
  - its single largest gap exceeds MAX_GAP_DAYS (a gap that long means
    lag/rolling features computed across it are fabricated, not real
    history)

Coverage % alone is not used as the cutoff — row count and gap size
are what actually determine whether lag/rolling features are trustworthy;
a series can have low coverage but still be usable if it has decent
row count and no catastrophic gaps (that's why Islampur-Tomato at 38.5%
survives while Palus-Tomato at 22.5% doesn't — the deciding factor is
row count + gap size, not the coverage % itself).

Usage:
    python filter_series.py
"""

import os
import pandas as pd

IN_PRICE_FILE = "data/processed/price_history_clean.csv"
IN_COVERAGE_FILE = "data/processed/coverage_report.csv"
OUT_PRICE_FILE = "data/processed/price_history_filtered.csv"
OUT_DROPPED_FILE = "data/processed/dropped_series.csv"

MIN_ROWS = 100
MAX_GAP_DAYS = 30


def main():
    if not (os.path.exists(IN_PRICE_FILE) and os.path.exists(IN_COVERAGE_FILE)):
        print("Run clean_price_data.py and coverage_report.py first.")
        return

    price = pd.read_csv(IN_PRICE_FILE, parse_dates=["Arrival Date"])
    coverage = pd.read_csv(IN_COVERAGE_FILE)

    coverage["keep"] = (coverage["Rows"] >= MIN_ROWS) & (coverage["Max Gap (days)"] <= MAX_GAP_DAYS)

    kept = coverage[coverage["keep"]]
    dropped = coverage[~coverage["keep"]]

    # Filter price data to only kept (District, Market, Commodity) combos
    keep_keys = set(zip(kept["District"], kept["Market"], kept["Commodity"]))
    mask = price.apply(
        lambda r: (r["District"], r["Market"], r["Commodity"]) in keep_keys, axis=1
    )
    filtered = price[mask]

    filtered.to_csv(OUT_PRICE_FILE, index=False)
    dropped.to_csv(OUT_DROPPED_FILE, index=False)

    print("=" * 70)
    print(f"FILTERING SUMMARY (min_rows={MIN_ROWS}, max_gap_days={MAX_GAP_DAYS})")
    print("=" * 70)
    print(f"Series kept:    {len(kept)} / {len(coverage)}")
    print(f"Rows kept:      {len(filtered)} / {len(price)}")

    print("\n✓ KEPT:")
    for _, r in kept.sort_values("Coverage %", ascending=False).iterrows():
        print(f"    {r['District']} / {r['Market']} / {r['Commodity']} — {r['Rows']} rows, {r['Coverage %']}% coverage, max gap {r['Max Gap (days)']}d")

    print("\n✗ DROPPED:")
    for _, r in dropped.sort_values("Coverage %").iterrows():
        reason = []
        if r["Rows"] < MIN_ROWS:
            reason.append(f"only {r['Rows']} rows")
        if r["Max Gap (days)"] > MAX_GAP_DAYS:
            reason.append(f"{r['Max Gap (days)']}d gap")
        print(f"    {r['District']} / {r['Market']} / {r['Commodity']} — {', '.join(reason)}")

    print(f"\nWrote: {OUT_PRICE_FILE}")
    print(f"Wrote: {OUT_DROPPED_FILE}")


if __name__ == "__main__":
    main()
