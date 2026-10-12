"""
Distress-Sale Timing Advisor — Central Data Access Layer
Provides single unified loading routines for clean weather and price datasets.
"""

from __future__ import annotations

import os
from typing import Optional
import pandas as pd

ML_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_WEATHER_CSV = os.path.join(ML_ROOT, "data", "processed", "weather_history_clean.csv")
DEFAULT_PRICE_CSV = os.path.join(ML_ROOT, "data", "processed", "price_history_filtered.csv")

WEATHER_COLUMN_RENAME = {
    "temperature_2m_mean": "temp_mean",
    "temperature_2m_max": "temp_max",
    "temperature_2m_min": "temp_min",
    "relative_humidity_2m_mean": "humidity_mean",
    "precipitation_sum": "precipitation_sum",
    "rain_sum": "rain_sum",
    "precipitation_hours": "precipitation_hours",
    "weather_code": "weather_code",
    "et0_fao_evapotranspiration": "et0",
}


def load_weather(
    district: Optional[str] = None,
    csv_path: Optional[str] = None,
) -> pd.DataFrame:
    """
    Load clean weather data with standardized column names.
    Single source of truth for both price model and decay simulation.
    """
    path = csv_path or DEFAULT_WEATHER_CSV
    if not os.path.exists(path):
        raise FileNotFoundError(f"Weather history file not found: {path}")

    # Read CSV defensively (utf-8-sig handles any stray BOM)
    df = pd.read_csv(path, encoding="utf-8-sig")

    # Standardize District column casing
    if "District" in df.columns:
        df["District"] = df["District"].astype(str).str.strip().str.capitalize()

    # Parse dates
    df["date"] = pd.to_datetime(df["date"]).dt.tz_localize(None)

    # Rename to canonical names
    rename_cols = {orig: target for orig, target in WEATHER_COLUMN_RENAME.items() if orig in df.columns}
    df = df.rename(columns=rename_cols)

    if district:
        dist = district.strip().capitalize()
        df = df[df["District"] == dist].copy()

    return df.sort_values(["District", "date"]).reset_index(drop=True)


def load_prices(
    csv_path: Optional[str] = None,
) -> pd.DataFrame:
    """
    Load clean filtered price history dataset.
    """
    path = csv_path or DEFAULT_PRICE_CSV
    if not os.path.exists(path):
        raise FileNotFoundError(f"Filtered price history file not found: {path}")

    df = pd.read_csv(path, encoding="utf-8-sig")

    if "Arrival Date" in df.columns and "date" not in df.columns:
        df["date"] = pd.to_datetime(df["Arrival Date"]).dt.tz_localize(None)
    elif "date" in df.columns:
        df["date"] = pd.to_datetime(df["date"]).dt.tz_localize(None)

    # Clean district, market, commodity
    for col in ["District", "Market", "Commodity"]:
        if col in df.columns:
            df[col] = df[col].astype(str).str.strip()

    # Defensively convert numeric columns
    numeric_cols = ["Modal Price", "Min Price", "Max Price", "Arrival Quantity", "modal_price", "arrival_qty"]
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(
                df[col].astype(str).str.replace(",", "", regex=False),
                errors="coerce",
            )

    return df.sort_values(["Commodity", "Market", "date"]).reset_index(drop=True)

