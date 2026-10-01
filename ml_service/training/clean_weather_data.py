"""
Phase 1 — Weather data cleaning
Reads per-district Open-Meteo exports from data/raw/weather/ and produces
one consolidated weather_history_clean.csv with District, date, and all
weather features including daily-averaged humidity.

Expects filenames like 'kolhapur_weather_dataset.xlsx' / '.csv' —
the district name is taken from the filename (text before '_weather').

Handles BOTH formats you may have:
  (a) .xlsx export with only daily columns (no humidity) — original format
  (b) .csv export from the hourly+daily combined re-pull URL — has a
      daily block and an hourly block in the same file

Usage:
    python clean_weather_data.py
"""

import glob
import os
import re
import pandas as pd

RAW_DIR = "data/raw/weather"
OUT_DIR = "data/processed"
OUT_FILE = os.path.join(OUT_DIR, "weather_history_clean.csv")

# Strip the "(unit)" suffix Open-Meteo puts on column headers, e.g.
# "temperature_2m_mean (°C)" -> "temperature_2m_mean"
def strip_units(col):
    return re.sub(r"\s*\(.*?\)\s*$", "", str(col)).strip()


def district_from_filename(path):
    name = os.path.basename(path).lower()
    name = name.split("_weather")[0]
    return name.capitalize()


def load_xlsx_daily_only(path):
    """Original .xlsx format: meta row, blank row, header row, then data."""
    raw = pd.read_excel(path, header=None)
    header_row_idx = raw[raw[0] == "time"].index[0]
    header = raw.iloc[header_row_idx].tolist()
    data = raw.iloc[header_row_idx + 1:].reset_index(drop=True)
    data.columns = [strip_units(c) for c in header]
    data["time"] = pd.to_datetime(data["time"])
    data["relative_humidity_2m_mean"] = None  # not available in this format
    return data


def load_csv_daily_and_hourly(path):
    """
    Combined re-pull format: an 'hourly' CSV block and a 'daily' CSV block
    in the same file, each with its own header line starting with "time".
    Open-Meteo does not guarantee block order (humidity/hourly can come
    before or after daily) — detect each block BY CONTENT, not position.
    """
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    header_indices = [i for i, l in enumerate(lines) if l.strip().startswith("time")]
    if len(header_indices) < 2:
        raise ValueError(f"Expected daily + hourly blocks in {path}, found {len(header_indices)} header(s).")

    # Only 2 blocks expected; slice each from its header to the next header (or EOF)
    bounds = header_indices + [len(lines)]
    blocks = ["".join(lines[bounds[i]:bounds[i + 1]]) for i in range(len(header_indices))]

    import io
    parsed = [pd.read_csv(io.StringIO(b)) for b in blocks]

    daily = next((df for df in parsed if any("temperature" in c for c in df.columns)), None)
    hourly = next((df for df in parsed if any("relative_humidity_2m" in c for c in df.columns) and "temperature" not in "".join(df.columns)), None)

    if daily is None or hourly is None:
        raise ValueError(f"Could not identify both daily and hourly blocks in {path} — found columns: {[df.columns.tolist() for df in parsed]}")

    daily.columns = [strip_units(c) for c in daily.columns]
    hourly.columns = [strip_units(c) for c in hourly.columns]

    daily["time"] = pd.to_datetime(daily["time"])
    hourly["time"] = pd.to_datetime(hourly["time"])

    # Average hourly humidity to one value per day
    hourly["date"] = hourly["time"].dt.date
    humidity_daily = hourly.groupby("date")["relative_humidity_2m"].mean().reset_index()
    humidity_daily.columns = ["date", "relative_humidity_2m_mean"]
    humidity_daily["date"] = pd.to_datetime(humidity_daily["date"])

    daily = daily.merge(humidity_daily, left_on="time", right_on="date", how="left")
    daily = daily.drop(columns=["date"])
    return daily


def load_one_file(path):
    if path.lower().endswith(".xlsx"):
        return load_xlsx_daily_only(path)
    elif path.lower().endswith(".csv"):
        return load_csv_daily_and_hourly(path)
    else:
        raise ValueError(f"Unsupported file type: {path}")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    files = glob.glob(os.path.join(RAW_DIR, "*.xlsx")) + glob.glob(os.path.join(RAW_DIR, "*.csv"))

    if not files:
        print(f"No weather files found in {RAW_DIR}/ — nothing to do.")
        return

    frames = []
    for path in files:
        district = district_from_filename(path)
        df = load_one_file(path)
        df["District"] = district
        df = df.rename(columns={"time": "date"})
        frames.append(df)
        missing_humidity = df["relative_humidity_2m_mean"].isna().sum()
        print(f"{os.path.basename(path)} -> District={district}, rows={len(df)}, missing humidity={missing_humidity}")

    combined = pd.concat(frames, ignore_index=True)
    combined = combined.sort_values(["District", "date"])
    combined.to_csv(OUT_FILE, index=False)

    print("=" * 60)
    print("WEATHER CLEANING SUMMARY")
    print("=" * 60)
    print(f"Districts: {combined['District'].unique().tolist()}")
    print(f"Date range: {combined['date'].min().date()} to {combined['date'].max().date()}")
    print(f"Total rows: {len(combined)}")
    print(f"Wrote: {OUT_FILE}")


if __name__ == "__main__":
    main()
