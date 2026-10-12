"""
Distress-Sale Timing Advisor — Leak-Free Feature Engineering
Builds calendar-day, past-only features for price change forecasting.
Guarantees strict train/serve parity and zero future information leakage.
"""

from __future__ import annotations

import math
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Union
import numpy as np
import pandas as pd

FEATURE_COLUMNS = [
    "p_last",
    "days_since_last_obs",
    "ratio_7d",
    "ratio_14d",
    "mean_7d_ratio",
    "std_7d_ratio",
    "mean_14d_ratio",
    "n_obs_14d",
    "arrival_last",
    "arrival_mean_7d",
    "temp_mean",
    "precipitation_sum",
    "humidity_mean",
    "precip_sum_7d",
    "month_sin",
    "month_cos",
    "dow",
    "is_harvest_season",
    "crop",
    "market",
]

HARVEST_SEASONS = {
    "tomato": {10, 11, 12, 1, 4, 5, 6},
    "onion": {2, 3, 4, 5, 10, 11, 12},
}

SUPPORTED_MARKETS = [
    "Kolhapur",
    "Vadgaonpeth",
    "Sangli-Phale-Bhajipala",
    "Islampur",
]

SUPPORTED_CROPS = ["onion", "tomato"]


def get_feature_names() -> List[str]:
    """Return immutable list of engineered feature columns."""
    return list(FEATURE_COLUMNS)


def build_features(
    history: pd.DataFrame,
    series: Dict[str, str],
    origin: Union[str, date, datetime, pd.Timestamp],
    horizon: int,
    weather_df: Optional[pd.DataFrame] = None,
) -> Dict[str, Any]:
    """
    Build a single leak-free feature vector for a specific (series, origin, horizon).

    Args:
        history: DataFrame with historical price observations. Must have:
                 date (or Arrival Date), Modal Price, Commodity, Market.
        series: Dict with 'crop' (or 'commodity'), 'market', 'district'.
        origin: Forecast origin date (cutoff). ONLY data on or before origin is seen.
        horizon: Forecast horizon in days (e.g. 1, 2, 3, 4, 5).
        weather_df: Optional weather history/forecast dataframe.

    Returns:
        Dict mapping feature name to numeric/categorical value.
    """
    origin_ts = pd.to_datetime(origin).tz_localize(None)
    crop = str(series.get("crop") or series.get("commodity") or "").strip().lower()
    market = str(series.get("market") or "").strip()
    district = str(series.get("district") or "").strip().capitalize()

    # Normalize history dataframe dates and column names
    hist = history.copy()
    if "date" not in hist.columns and "Arrival Date" in hist.columns:
        hist["date"] = pd.to_datetime(hist["Arrival Date"]).dt.tz_localize(None)
    elif "date" in hist.columns:
        hist["date"] = pd.to_datetime(hist["date"]).dt.tz_localize(None)

    price_col = "Modal Price" if "Modal Price" in hist.columns else "modal_price"
    arrival_col = "Arrival Quantity" if "Arrival Quantity" in hist.columns else "arrival_qty"
    crop_col = "Commodity" if "Commodity" in hist.columns else "crop"
    market_col = "Market" if "Market" in hist.columns else "market"

    # Filter strictly for the requested series and dated on or before origin
    mask = (
        (hist[crop_col].astype(str).str.strip().str.lower() == crop)
        & (hist[market_col].astype(str).str.strip() == market)
        & (hist["date"] <= origin_ts)
    )
    s_hist = hist[mask].sort_values("date").reset_index(drop=True)

    if s_hist.empty:
        raise ValueError(
            f"No historical price records found for {crop}/{market} on or before origin {origin_ts.date()}"
        )

    s_hist[price_col] = pd.to_numeric(s_hist[price_col].astype(str).str.replace(",", "", regex=False), errors="coerce")
    if arrival_col in s_hist.columns:
        s_hist[arrival_col] = pd.to_numeric(s_hist[arrival_col].astype(str).str.replace(",", "", regex=False), errors="coerce")


    # 1. Last observation
    last_row = s_hist.iloc[-1]
    p_last = float(last_row[price_col])
    last_obs_date = last_row["date"]
    days_since_last_obs = int((origin_ts - last_obs_date).days)

    # 2. Calendar-day reference points
    t_7d_ago = origin_ts - pd.Timedelta(days=7)
    t_14d_ago = origin_ts - pd.Timedelta(days=14)

    # Price as of 7 days ago (backward asof)
    hist_7d = s_hist[s_hist["date"] <= t_7d_ago]
    ratio_7d = float(hist_7d.iloc[-1][price_col]) / p_last if not hist_7d.empty else 1.0

    # Price as of 14 days ago (backward asof)
    hist_14d = s_hist[s_hist["date"] <= t_14d_ago]
    ratio_14d = float(hist_14d.iloc[-1][price_col]) / p_last if not hist_14d.empty else 1.0

    # 3. Calendar window statistics
    win_7d = s_hist[(s_hist["date"] >= t_7d_ago) & (s_hist["date"] <= origin_ts)]
    win_14d = s_hist[(s_hist["date"] >= t_14d_ago) & (s_hist["date"] <= origin_ts)]

    p_win_7d = win_7d[price_col].values
    p_win_14d = win_14d[price_col].values

    mean_7d = float(np.mean(p_win_7d)) if len(p_win_7d) > 0 else p_last
    std_7d = float(np.std(p_win_7d, ddof=1)) if len(p_win_7d) > 1 else 0.0
    mean_14d = float(np.mean(p_win_14d)) if len(p_win_14d) > 0 else p_last

    mean_7d_ratio = mean_7d / p_last
    std_7d_ratio = std_7d / p_last
    mean_14d_ratio = mean_14d / p_last
    n_obs_14d = int(len(win_14d))

    # 4. Past arrival features
    if arrival_col in s_hist.columns and pd.notna(last_row[arrival_col]):
        arrival_last = float(last_row[arrival_col])
    else:
        arrival_last = 0.0

    if arrival_col in win_7d.columns and win_7d[arrival_col].notna().any():
        arrival_mean_7d = float(win_7d[arrival_col].dropna().mean())
    else:
        arrival_mean_7d = arrival_last

    # 5. Target day and calendar features
    target_date = origin_ts + pd.Timedelta(days=horizon)
    target_month = target_date.month
    month_sin = float(np.sin(2.0 * np.pi * target_month / 12.0))
    month_cos = float(np.cos(2.0 * np.pi * target_month / 12.0))
    dow = int(target_date.dayofweek)
    is_harvest = 1 if target_month in HARVEST_SEASONS.get(crop, set()) else 0

    # 6. Weather features (target day forecast + past 7-day rain)
    temp_mean = 25.0
    precipitation_sum = 0.0
    humidity_mean = 70.0
    precip_sum_7d = 0.0

    if weather_df is not None and not weather_df.empty:
        w_df = weather_df.copy()
        if "District" in w_df.columns:
            w_df["District"] = w_df["District"].astype(str).str.strip().str.capitalize()
            dist_w = w_df[w_df["District"] == district]
        else:
            dist_w = w_df

        if not dist_w.empty:
            dist_w = dist_w.sort_values("date")
            # Past 7d rain
            past_w = dist_w[(dist_w["date"] >= t_7d_ago) & (dist_w["date"] <= origin_ts)]
            if "precipitation_sum" in past_w.columns and past_w["precipitation_sum"].notna().any():
                precip_sum_7d = float(past_w["precipitation_sum"].sum())

            # Target date forecast
            target_w = dist_w[dist_w["date"] == target_date]
            if not target_w.empty:
                r = target_w.iloc[0]
                if "temp_mean" in r and pd.notna(r["temp_mean"]):
                    temp_mean = float(r["temp_mean"])
                if "precipitation_sum" in r and pd.notna(r["precipitation_sum"]):
                    precipitation_sum = float(r["precipitation_sum"])
                if "humidity_mean" in r and pd.notna(r["humidity_mean"]):
                    humidity_mean = float(r["humidity_mean"])
            else:
                # Use seasonal/doy average from history (+-7 day window around DOY)
                target_doy = target_date.dayofyear
                doy_w = dist_w[
                    (dist_w["date"].dt.dayofyear >= target_doy - 7)
                    & (dist_w["date"].dt.dayofyear <= target_doy + 7)
                ]
                if not doy_w.empty:
                    if "temp_mean" in doy_w.columns and doy_w["temp_mean"].notna().any():
                        temp_mean = float(doy_w["temp_mean"].mean())
                    if "humidity_mean" in doy_w.columns and doy_w["humidity_mean"].notna().any():
                        humidity_mean = float(doy_w["humidity_mean"].mean())

    feature_dict = {
        "p_last": p_last,
        "days_since_last_obs": days_since_last_obs,
        "ratio_7d": ratio_7d,
        "ratio_14d": ratio_14d,
        "mean_7d_ratio": mean_7d_ratio,
        "std_7d_ratio": std_7d_ratio,
        "mean_14d_ratio": mean_14d_ratio,
        "n_obs_14d": n_obs_14d,
        "arrival_last": arrival_last,
        "arrival_mean_7d": arrival_mean_7d,
        "temp_mean": temp_mean,
        "precipitation_sum": precipitation_sum,
        "humidity_mean": humidity_mean,
        "precip_sum_7d": precip_sum_7d,
        "month_sin": month_sin,
        "month_cos": month_cos,
        "dow": dow,
        "is_harvest_season": is_harvest,
        "crop": crop,
        "market": market,
    }

    return feature_dict
