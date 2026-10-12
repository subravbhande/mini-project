"""
AgriSense — Weather Data Preparation Script
Parses the stacked-table raw weather CSVs (hourly humidity + daily stats),
merges them into a single clean daily weather file per district, and outputs
to data/processed/ for use by the price prediction training pipeline.

Usage:
    python training/prepare_weather_data.py
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import csv
from datetime import datetime
from typing import Dict, List, Tuple

ML_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

RAW_WEATHER = {
    "Kolhapur": os.path.join(ML_ROOT, "data", "raw", "weather", "kolhapur_weather_dataset.csv"),
    "Sangli":   os.path.join(ML_ROOT, "data", "raw", "weather", "sangli_weather_dataset.csv"),
}

PROCESSED_DIR = os.path.join(ML_ROOT, "data", "processed")


# ---------------------------------------------------------------------------
# Parsing helpers
# ---------------------------------------------------------------------------

def _parse_stacked_csv(filepath: str) -> Tuple[Dict[str, float], Dict[str, Dict]]:
    """
    The raw weather CSV has two stacked tables separated by blank lines:

    Table 1 — Hourly humidity:
        time,relative_humidity_2m (%)
        2025-11-07T00:00,95
        ...

    Table 2 — Daily aggregates (after another blank + header line):
        time,temperature_2m_mean (?C),...

    Returns:
        hourly_humidity  : {date_str -> mean_humidity_float}
        daily_stats      : {date_str -> {col: value, ...}}
    """
    hourly_rows: List[Dict] = []
    daily_rows:  List[Dict] = []

    with open(filepath, "r", encoding="utf-8") as f:
        lines = f.readlines()

    # Skip the metadata block (first 2 lines: lat/lon row + blank)
    # Find header lines that start with "time,"
    table_starts: List[int] = []
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.lower().startswith("time,"):
            table_starts.append(i)

    if len(table_starts) < 1:
        raise ValueError(f"Could not find any 'time,' header in {filepath}")

    # ---- Table 1: hourly humidity ----
    t1_start = table_starts[0]
    t1_header = [h.strip() for h in lines[t1_start].strip().split(",")]

    t1_end = table_starts[1] if len(table_starts) > 1 else len(lines)
    for line in lines[t1_start + 1 : t1_end]:
        stripped = line.strip()
        if not stripped or stripped.lower().startswith("time"):
            continue
        parts = stripped.split(",")
        if len(parts) < 2:
            continue
        row = dict(zip(t1_header, parts))
        hourly_rows.append(row)

    # ---- Table 2: daily aggregates ----
    if len(table_starts) >= 2:
        t2_start = table_starts[1]
        t2_header = [h.strip() for h in lines[t2_start].strip().split(",")]
        for line in lines[t2_start + 1 :]:
            stripped = line.strip()
            if not stripped:
                continue
            parts = stripped.split(",")
            if len(parts) < 2:
                continue
            row = dict(zip(t2_header, parts))
            daily_rows.append(row)

    # ---- Aggregate hourly humidity to daily mean ----
    humidity_by_date: Dict[str, List[float]] = {}
    humidity_col = next((c for c in t1_header if "humidity" in c.lower()), None)

    for row in hourly_rows:
        time_str = row.get("time", "")
        date_str = time_str[:10]  # "2025-11-07T00:00" -> "2025-11-07"
        if not date_str or date_str == "time":
            continue
        try:
            val = float(row.get(humidity_col or "", 0))
            humidity_by_date.setdefault(date_str, []).append(val)
        except (ValueError, TypeError):
            continue

    hourly_humidity: Dict[str, float] = {
        d: round(sum(vals) / len(vals), 2)
        for d, vals in humidity_by_date.items()
        if vals
    }

    # ---- Index daily stats by date ----
    daily_stats: Dict[str, Dict] = {}
    for row in daily_rows:
        date_str = str(row.get("time", "")).strip()[:10]
        if not date_str or date_str == "time":
            continue
        clean = {}
        for k, v in row.items():
            if k == "time":
                continue
            try:
                clean[k.strip()] = float(v)
            except (ValueError, TypeError):
                clean[k.strip()] = None
        daily_stats[date_str] = clean

    return hourly_humidity, daily_stats


def _safe_float(value, default: float = 0.0) -> float:
    try:
        v = float(value)
        return v if v == v else default  # NaN check
    except (TypeError, ValueError):
        return default


# ---------------------------------------------------------------------------
# Main processing
# ---------------------------------------------------------------------------

def prepare_district_weather(district: str, raw_path: str, out_path: str) -> int:
    """Parse, merge, and write a clean daily weather CSV for one district."""

    print(f"\n[{district}] Parsing: {raw_path}")
    hourly_humidity, daily_stats = _parse_stacked_csv(raw_path)

    print(f"  Hourly humidity dates : {len(hourly_humidity)}")
    print(f"  Daily stats dates     : {len(daily_stats)}")

    # Union of all dates found
    all_dates = sorted(set(hourly_humidity.keys()) | set(daily_stats.keys()))

    # Column order for output
    fieldnames = [
        "date", "district",
        "temp_mean", "temp_max", "temp_min",
        "precipitation_sum", "rain_sum", "precipitation_hours",
        "evapotranspiration", "weather_code",
        "soil_moisture_0_to_100cm", "soil_moisture_0_to_7cm",
        "soil_moisture_7_to_28cm", "soil_moisture_28_to_100cm",
        "humidity_mean",
    ]

    rows_written = 0
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for date_str in all_dates:
            stats = daily_stats.get(date_str, {})

            # Map raw column names (may contain units) to clean names
            def get_stat(key_fragment: str, default: float = 0.0) -> float:
                for k, v in stats.items():
                    if key_fragment.lower() in k.lower():
                        return _safe_float(v, default)
                return default

            row = {
                "date":                    date_str,
                "district":                district,
                "temp_mean":               get_stat("temperature_2m_mean"),
                "temp_max":                get_stat("temperature_2m_max"),
                "temp_min":                get_stat("temperature_2m_min"),
                "precipitation_sum":       get_stat("precipitation_sum"),
                "rain_sum":                get_stat("rain_sum"),
                "precipitation_hours":     get_stat("precipitation_hours"),
                "evapotranspiration":      get_stat("et0_fao"),
                "weather_code":            get_stat("weather_code"),
                "soil_moisture_0_to_100cm": get_stat("soil_moisture_0_to_100cm"),
                "soil_moisture_0_to_7cm":  get_stat("soil_moisture_0_to_7cm"),
                "soil_moisture_7_to_28cm": get_stat("soil_moisture_7_to_28cm"),
                "soil_moisture_28_to_100cm": get_stat("soil_moisture_28_to_100cm"),
                "humidity_mean":           hourly_humidity.get(date_str, 0.0),
            }
            writer.writerow(row)
            rows_written += 1

    print(f"  Written {rows_written} daily rows -> {out_path}")
    return rows_written


def main():
    os.makedirs(PROCESSED_DIR, exist_ok=True)

    total = 0
    for district, raw_path in RAW_WEATHER.items():
        if not os.path.exists(raw_path):
            print(f"[WARN] Raw weather file not found: {raw_path}")
            continue

        out_filename = f"{district.lower()}_daily_weather.csv"
        out_path = os.path.join(PROCESSED_DIR, out_filename)
        n = prepare_district_weather(district, raw_path, out_path)
        total += n

    print(f"\n[Done] Total daily weather records written: {total}")
    print(f"       Output directory: {PROCESSED_DIR}")


if __name__ == "__main__":
    main()
