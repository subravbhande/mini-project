"""
Phase 1 — Data cleaning
Reads every raw Agmarknet CSV in data/raw/, cleans it, canonicalizes
market names, and writes one consolidated file to data/processed/.

Usage:
    python clean_price_data.py
"""

import json
import glob
import os
import pandas as pd

RAW_DIR = "data/raw"
OUT_DIR = "data/processed"
ALIAS_MAP_PATH = "config/market_aliases.json"
OUT_FILE = os.path.join(OUT_DIR, "price_history_clean.csv")


def load_alias_map(path):
    with open(path) as f:
        raw = json.load(f)
    return {k: v for k, v in raw.items() if not k.startswith("_")}


def clean_one_file(path, alias_map, unmapped_markets):
    # Agmarknet exports have a stray first row before the real header
    df = pd.read_csv(path, skiprows=1)

    # Strip comma-formatted price strings -> float
    for col in ["Min Price", "Max Price", "Modal Price"]:
        df[col] = (
            df[col].astype(str).str.replace(",", "", regex=False).astype(float)
        )

    df["Arrival Date"] = pd.to_datetime(df["Arrival Date"], format="%d-%m-%Y")

    # Agmarknet exports market/district names with trailing whitespace
    # ("APMC Kolhapur " with a trailing space) — strip before matching aliases,
    # or every one of these silently fails to match and falls through unmapped.
    df["District"] = df["District"].str.strip()
    df["Market"] = df["Market"].str.strip()

    # Canonicalize market name; flag anything not in the alias map
    def canon(row):
        key = f"{row['District']}|{row['Market']}"
        if key not in alias_map:
            unmapped_markets.add(key)
            return row["Market"]  # fall back to raw name, but it's flagged
        return alias_map[key]

    df["Market"] = df.apply(canon, axis=1)
    df["source_file"] = os.path.basename(path)
    return df


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    alias_map = load_alias_map(ALIAS_MAP_PATH)

    files = glob.glob(os.path.join(RAW_DIR, "*.csv"))
    if not files:
        print(f"No CSVs found in {RAW_DIR}/ — nothing to do.")
        return

    unmapped_markets = set()
    frames = []
    rows_in = 0

    for path in files:
        df = clean_one_file(path, alias_map, unmapped_markets)
        rows_in += len(df)
        frames.append(df)

    combined = pd.concat(frames, ignore_index=True)

    before_dedup = len(combined)
    combined = combined.drop_duplicates(
        subset=["District", "Market", "Commodity", "Variety", "Grade", "Arrival Date"]
    )
    duplicates_dropped = before_dedup - len(combined)

    combined = combined.sort_values(["District", "Market", "Commodity", "Arrival Date"])
    combined.to_csv(OUT_FILE, index=False)

    # ── Summary log — read this every run, don't skip it ──
    print("=" * 60)
    print("CLEANING SUMMARY")
    print("=" * 60)
    print(f"Files processed:      {len(files)}")
    print(f"Rows in (raw total):  {rows_in}")
    print(f"Rows out (clean):     {len(combined)}")
    print(f"Duplicate rows dropped: {duplicates_dropped}")
    print(f"Date range:           {combined['Arrival Date'].min().date()} to {combined['Arrival Date'].max().date()}")
    print(f"Unique markets:       {combined['Market'].nunique()}")
    print(f"Unique crops:         {combined['Commodity'].nunique()}")

    if unmapped_markets:
        print("\n⚠ UNMAPPED MARKETS FOUND — add these to market_aliases.json:")
        for m in sorted(unmapped_markets):
            print(f"    {m}")
    else:
        print("\n✓ All markets matched the alias map.")

    print(f"\nWrote: {OUT_FILE}")


if __name__ == "__main__":
    main()
