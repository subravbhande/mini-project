"""
Phase 1 — Coverage & gap analysis
Reads the cleaned price data and reports, per (District, Market, Commodity):
  - row count, date span, coverage %, max gap size
Flags series below COVERAGE_THRESHOLD so you know before Phase 2 which
markets can't support their own standalone model.

Usage:
    python coverage_report.py
"""

import os
import pandas as pd

IN_FILE = "data/processed/price_history_clean.csv"
OUT_FILE = "data/processed/coverage_report.csv"
COVERAGE_THRESHOLD = 40.0  # percent — below this, flag as sparse


def main():
    if not os.path.exists(IN_FILE):
        print(f"{IN_FILE} not found — run clean_price_data.py first.")
        return

    df = pd.read_csv(IN_FILE, parse_dates=["Arrival Date"])

    rows = []
    for (district, market, crop), g in df.groupby(["District", "Market", "Commodity"]):
        g = g.sort_values("Arrival Date")
        span_days = (g["Arrival Date"].max() - g["Arrival Date"].min()).days + 1
        coverage_pct = round(len(g) / span_days * 100, 1)
        gaps = g["Arrival Date"].diff().dt.days.dropna()
        max_gap = int(gaps.max()) if len(gaps) else 0

        rows.append({
            "District": district,
            "Market": market,
            "Commodity": crop,
            "Rows": len(g),
            "Start Date": g["Arrival Date"].min().date(),
            "End Date": g["Arrival Date"].max().date(),
            "Span Days": span_days,
            "Coverage %": coverage_pct,
            "Max Gap (days)": max_gap,
            "Sparse": coverage_pct < COVERAGE_THRESHOLD,
        })

    report = pd.DataFrame(rows).sort_values("Coverage %")
    report.to_csv(OUT_FILE, index=False)

    print("=" * 70)
    print("COVERAGE REPORT")
    print("=" * 70)
    print(report.to_string(index=False))

    sparse = report[report["Sparse"]]
    print(f"\n{len(sparse)} of {len(report)} series below {COVERAGE_THRESHOLD}% coverage:")
    for _, r in sparse.iterrows():
        print(f"    {r['District']} / {r['Market']} / {r['Commodity']} — {r['Coverage %']}%, max gap {r['Max Gap (days)']}d")

    print(f"\nWrote: {OUT_FILE}")


if __name__ == "__main__":
    main()
