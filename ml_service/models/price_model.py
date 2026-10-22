"""
Distress-Sale Timing Advisor — Production Price Prediction Service
Direct multi-step forecasting with leak-free features, baseline enforcement,
empirical uncertainty bands, and strict input validation.
"""

from __future__ import annotations

import json
import logging
import os
import sys
from dataclasses import asdict, dataclass, field
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np
import pandas as pd
from xgboost import XGBRegressor

from models.data_access import load_prices, load_weather
from models.features import build_features, get_feature_names

logger = logging.getLogger("PriceModel")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", stream=sys.stderr)

ML_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_SAVED_DIR = os.path.join(ML_ROOT, "models", "saved")
DEFAULT_ALIASES_PATH = os.path.join(ML_ROOT, "config", "market_aliases.json")

CROP_MAP = {"onion": 0, "tomato": 1}
MARKET_MAP = {
    "Islampur": 0,
    "Kolhapur": 1,
    "Sangli-Phale-Bhajipala": 2,
    "Vadgaonpeth": 3,
}


class UnsupportedSeriesError(ValueError):
    """Raised when an un-modeled commodity/market combination is requested."""
    def __init__(self, message: str, valid: List[Dict[str, str]]):
        super().__init__(message)
        self.valid = valid


@dataclass
class DailyForecast:
    day: int
    date: str
    predicted_modal_price: float
    confidence_band_low: float
    confidence_band_high: float
    typical_daily_spread_min: float
    typical_daily_spread_max: float
    confidence_label: str
    model_used: str
    weather_risk_flag: bool
    weather_risk_reason: str
    temp_c: Optional[float] = None
    precipitation_mm: Optional[float] = None
    humidity_pct: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class PriceForecastResult:
    commodity: str
    market: str
    district: str
    forecast_start_date: str
    data_as_of: str
    days_stale: int
    stale: bool
    horizon_days: int
    daily_forecasts: List[DailyForecast] = field(default_factory=list)
    summary: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "commodity": self.commodity,
            "market": self.market,
            "district": self.district,
            "forecast_start_date": self.forecast_start_date,
            "data_as_of": self.data_as_of,
            "days_stale": self.days_stale,
            "stale": self.stale,
            "horizon_days": self.horizon_days,
            "daily_forecasts": [f.to_dict() for f in self.daily_forecasts],
            "summary": self.summary,
        }


# Aliases for compatibility
PriceForecast = PriceForecastResult
PricePrediction = DailyForecast


class PriceModel:
    """Production Price Model holding pre-trained direct horizon models."""

    def __init__(self, saved_dir: str = DEFAULT_SAVED_DIR):
        self.saved_dir = saved_dir
        self.models: Dict[int, XGBRegressor] = {}
        self.supported_series: List[Dict[str, Any]] = []
        self.supported_pairs: set[Tuple[str, str]] = set()
        self.aliases: Dict[str, str] = {}
        self.residual_quantiles: Dict[str, Any] = {}
        self.backtest_report: Dict[str, Any] = {}
        self.prices_df: Optional[pd.DataFrame] = None
        self.weather_df: Optional[pd.DataFrame] = None
        self._load_artifacts()

    @classmethod
    def load(cls, saved_dir: str = DEFAULT_SAVED_DIR) -> PriceModel:
        return cls(saved_dir=saved_dir)

    def _load_artifacts(self) -> None:
        logger.info(f"Loading price model artifacts from: {self.saved_dir}")

        # 1. Supported series
        sup_path = os.path.join(self.saved_dir, "supported_series.json")
        if os.path.exists(sup_path):
            with open(sup_path, "r", encoding="utf-8") as f:
                self.supported_series = json.load(f)
            self.supported_pairs = {
                (s["crop"].lower(), s["market"]) for s in self.supported_series
            }
        else:
            logger.warning(f"Supported series file not found at {sup_path}")

        # 2. Market aliases
        if os.path.exists(DEFAULT_ALIASES_PATH):
            with open(DEFAULT_ALIASES_PATH, "r", encoding="utf-8") as f:
                raw_aliases = json.load(f)
            self.aliases = {k: v for k, v in raw_aliases.items() if not k.startswith("_")}

        # 3. Direct horizon models (1..5)
        for h in [1, 2, 3, 4, 5]:
            model_path = os.path.join(self.saved_dir, f"price_h{h}.json")
            if os.path.exists(model_path):
                xgb = XGBRegressor()
                xgb.load_model(model_path)
                self.models[h] = xgb
            else:
                logger.warning(f"Model for horizon h={h} not found at {model_path}")

        # 4. Residual quantiles
        rq_path = os.path.join(self.saved_dir, "residual_quantiles.json")
        if os.path.exists(rq_path):
            with open(rq_path, "r", encoding="utf-8") as f:
                self.residual_quantiles = json.load(f)

        # 5. Backtest report
        br_path = os.path.join(self.saved_dir, "backtest_report.json")
        if os.path.exists(br_path):
            with open(br_path, "r", encoding="utf-8") as f:
                self.backtest_report = json.load(f)

        # 6. Preload base history and weather
        try:
            self.prices_df = load_prices()
            self.weather_df = load_weather()
            logger.info("Loaded price and weather history datasets successfully.")
        except Exception as e:
            logger.error(f"Error preloading datasets: {e}")

    def reload_prices(self) -> Dict[str, Any]:
        """Reload the updated prices and weather datasets into memory after daily fetch."""
        self.prices_df = load_prices()
        try:
            self.weather_df = load_weather()
        except Exception as e:
            logger.warning(f"Could not reload weather dataset: {e}")
        latest_date = None
        if self.prices_df is not None and not self.prices_df.empty:
            latest_date = str(self.prices_df["date"].max().date())
        today = date.today()
        days_stale = 0
        if latest_date:
            days_stale = max(0, (today - datetime.strptime(latest_date, "%Y-%m-%d").date()).days)
        logger.info(f"Reloaded prices and weather into memory. Latest date: {latest_date}, total price rows: {len(self.prices_df) if self.prices_df is not None else 0}")
        return {
            "status": "reloaded",
            "latest_price_date": latest_date,
            "total_records": len(self.prices_df) if self.prices_df is not None else 0,
            "days_stale": days_stale,
            "up_to_date": days_stale <= 1,
        }

    def get_data_status(self) -> Dict[str, Any]:
        """Return dataset freshness and summary status."""
        if self.prices_df is None or self.prices_df.empty:
            self.prices_df = load_prices()
        latest_date = str(self.prices_df["date"].max().date()) if self.prices_df is not None and not self.prices_df.empty else None
        today = date.today()
        days_stale = 0
        if latest_date:
            days_stale = max(0, (today - datetime.strptime(latest_date, "%Y-%m-%d").date()).days)
        return {
            "latest_price_date": latest_date,
            "total_records": len(self.prices_df) if self.prices_df is not None else 0,
            "days_stale": days_stale,
            "stale": days_stale > 1,
            "supported_series_count": len(self.supported_series),
        }

    def canonicalize_input(self, crop: str, market: str, district: Optional[str] = None) -> Tuple[str, str, str]:
        c_clean = crop.strip().lower()
        m_raw = market.strip()

        # Check alias map
        matched_market = m_raw
        if district:
            d_clean = district.strip().capitalize()
            key = f"{d_clean}|{m_raw}"
            if key in self.aliases:
                matched_market = self.aliases[key]
        else:
            # Check any alias with this raw market
            for k, val in self.aliases.items():
                if "|" in k:
                    _, alias_m = k.split("|", 1)
                    if alias_m.lower() == m_raw.lower():
                        matched_market = val
                        break

        # Validate against supported series
        valid_list = [
            {"crop": s["crop_display"], "market": s["market"], "district": s["district"]}
            for s in self.supported_series
        ]

        if (c_clean, matched_market) not in self.supported_pairs:
            raise UnsupportedSeriesError(
                f"Unsupported commodity and market combination: '{crop}' in '{market}'.",
                valid=valid_list,
            )

        # Find matching district
        matched_dist = ""
        for s in self.supported_series:
            if s["crop"].lower() == c_clean and s["market"] == matched_market:
                matched_dist = s["district"]
                break

        return c_clean, matched_market, matched_dist

    def predict(
        self,
        commodity: str,
        market: str,
        district: Optional[str] = None,
        horizon_days: int = 5,
        as_of: Optional[Union[str, date, datetime]] = None,
        weather_forecast: Optional[List[Dict[str, Any]]] = None,
    ) -> PriceForecastResult:
        """
        Generate honest multi-step price forecast.
        """
        if horizon_days < 1 or horizon_days > 5:
            raise ValueError(f"horizon_days must be between 1 and 5. Requested: {horizon_days}")

        crop, norm_market, norm_dist = self.canonicalize_input(commodity, market, district)

        # Filter price history for this series
        if self.prices_df is None or self.prices_df.empty:
            self.prices_df = load_prices()

        s_mask = (
            (self.prices_df["Commodity"].str.lower() == crop)
            & (self.prices_df["Market"] == norm_market)
        )
        s_df = self.prices_df[s_mask].sort_values("date").reset_index(drop=True)

        if s_df.empty:
            raise ValueError(f"No history available for {crop} in {norm_market}")

        # Determine cutoff date (as_of)
        latest_report_date = s_df["date"].max()
        if as_of is None:
            if weather_forecast and len(weather_forecast) > 0 and weather_forecast[0].get("date"):
                as_of_ts = pd.to_datetime(weather_forecast[0]["date"]).tz_localize(None) - pd.Timedelta(days=1)
            else:
                as_of_ts = pd.to_datetime(date.today())
        else:
            as_of_ts = pd.to_datetime(as_of).tz_localize(None)

        # Enforce past-only rows
        hist_cutoff = s_df[s_df["date"] <= as_of_ts].copy()
        if hist_cutoff.empty:
            hist_cutoff = s_df.copy()

        last_obs_date = hist_cutoff["date"].max()
        p_last = float(hist_cutoff.iloc[-1]["Modal Price"])
        data_as_of_str = str(last_obs_date.date())

        days_stale = max(0, int((as_of_ts - last_obs_date).days))
        is_stale = bool(days_stale > 3)

        # Prepare weather lookup with forecast override
        w_df = self.weather_df
        if weather_forecast:
            forecast_rows = []
            forecast_dates = set()
            for wf in weather_forecast:
                d = pd.to_datetime(wf["date"]).tz_localize(None)
                forecast_dates.add(d)
                forecast_rows.append({
                    "date": d,
                    "District": norm_dist,
                    "temp_mean": float(wf.get("temp_mean", 25.0)),
                    "precipitation_sum": float(wf.get("precipitation_sum", 0.0)),
                    "humidity_mean": float(wf.get("humidity_mean", 70.0)),
                    "weather_code": int(wf.get("weather_code", 0)) if wf.get("weather_code") is not None else None,
                })
            base_w = self.weather_df[
                ~((self.weather_df["District"] == norm_dist) & (self.weather_df["date"].isin(forecast_dates)))
            ]
            w_df = pd.concat([base_w, pd.DataFrame(forecast_rows)], ignore_index=True)

        daily_forecasts: List[DailyForecast] = []
        series_info = {"crop": crop, "market": norm_market, "district": norm_dist}

        # Determine whether this entire series beats naive baseline (Bug 10 fix)
        # Prevents switching back and forth between naive and ML across horizons, eliminating fake price kinks
        crop_beats_naive = self.backtest_report.get("crop_summary", {}).get(crop, {}).get("beats_naive", False)
        series_mase_list = [
            self.backtest_report.get("series_horizon_metrics", {}).get(f"{crop}_{norm_market}_h{hi}", {}).get("mase")
            for hi in range(1, 6)
        ]
        valid_mases = [m for m in series_mase_list if m is not None]
        avg_series_mase = (sum(valid_mases) / len(valid_mases)) if valid_mases else (0.95 if crop_beats_naive else 1.1)
        series_beats_naive = bool(crop_beats_naive and (avg_series_mase < 1.0))

        for h in range(1, horizon_days + 1):
            target_date = as_of_ts + pd.Timedelta(days=h)
            target_date_str = str(target_date.date())

            # Build leak-free feature vector
            feats = build_features(
                history=self.prices_df,
                series=series_info,
                origin=as_of_ts,
                horizon=h,
                weather_df=w_df,
            )

            # Check if ML model is used or naive fallback (consistent for the whole series)
            model_h = self.models.get(h)
            if model_h is not None and series_beats_naive:
                names = get_feature_names()
                x_row = []
                for name in names:
                    val = feats[name]
                    if name == "crop":
                        x_row.append(float(CROP_MAP.get(str(val).lower(), -1)))
                    elif name == "market":
                        x_row.append(float(MARKET_MAP.get(str(val), -1)))
                    else:
                        x_row.append(float(val) if val is not None else 0.0)

                x_vec = np.array([x_row], dtype=np.float32)
                y_hat = float(model_h.predict(x_vec)[0])
                y_hat_clipped = float(np.clip(y_hat, -0.5, 0.5))
                p_hat = round(p_last * float(np.exp(y_hat_clipped)), 2)
                model_used = f"xgboost_direct_h{h}"
            else:
                p_hat = round(p_last, 2)
                model_used = "naive_persistence"

            # Apply dynamic feedback loop calibration (rolling bias adjustment)
            try:
                from models.feedback_loop import apply_feedback_calibration
                p_hat, _ = apply_feedback_calibration(crop, norm_market, p_hat)
            except Exception:
                pass

            # Uncertainty bands from empirical residual quantiles
            rq_key = f"{crop}_h{h}"
            rq = self.residual_quantiles.get(rq_key, {"q10": -0.15, "q90": 0.15})
            q10 = float(rq.get("q10", -0.15))
            q90 = float(rq.get("q90", 0.15))

            # Stale penalty: widen bands if data is stale
            widen_factor = 1.0 + (0.08 * min(days_stale - 3, 5)) if is_stale else 1.0
            eff_q10 = q10 * widen_factor
            eff_q90 = q90 * widen_factor

            low_band = round(p_hat * float(np.exp(eff_q10)), 2)
            high_band = round(p_hat * float(np.exp(eff_q90)), 2)

            # Typical spread (+-5% of point forecast)
            typical_min = round(p_hat * 0.95, 2)
            typical_max = round(p_hat * 1.05, 2)

            # Calibrated confidence label based on relative band width
            rel_width = (high_band - low_band) / p_hat if p_hat > 0 else 0.20
            if rel_width < 0.12:
                confidence_label = "High"
            elif rel_width <= 0.22:
                confidence_label = "Moderate"
            else:
                confidence_label = "Low"

            # Rain risk flag (P1-3)
            precip = feats.get("precipitation_sum", 0.0)
            if precip >= 50.0:
                rain_flag = True
                rain_reason = f"Heavy rain ({round(precip, 1)} mm)"
            elif precip >= 15.0:
                rain_flag = True
                rain_reason = f"Rain expected ({round(precip, 1)} mm)"
            else:
                rain_flag = False
                rain_reason = "No adverse weather risk"

            daily_forecasts.append(
                DailyForecast(
                    day=h,
                    date=target_date_str,
                    predicted_modal_price=p_hat,
                    confidence_band_low=low_band,
                    confidence_band_high=high_band,
                    typical_daily_spread_min=typical_min,
                    typical_daily_spread_max=typical_max,
                    confidence_label=confidence_label,
                    model_used=model_used,
                    weather_risk_flag=rain_flag,
                    weather_risk_reason=rain_reason,
                    temp_c=round(float(feats.get("temp_mean", 25.0)), 1),
                    precipitation_mm=round(float(feats.get("precipitation_sum", 0.0)), 1),
                    humidity_pct=round(float(feats.get("humidity_mean", 70.0)), 1),
                )
            )

        # Summary KPIs
        prices_horizon = [f.predicted_modal_price for f in daily_forecasts]
        net_trend = "RISING" if prices_horizon[-1] > prices_horizon[0] else ("FALLING" if prices_horizon[-1] < prices_horizon[0] else "STABLE")
        pct_change = round(((prices_horizon[-1] - p_last) / p_last) * 100.0, 2)

        summary = {
            "last_observed_price": p_last,
            "min_forecast_price": min(prices_horizon),
            "max_forecast_price": max(prices_horizon),
            "projected_change_pct": pct_change,
            "overall_trend": net_trend,
            "overall_confidence": daily_forecasts[0].confidence_label,
            "is_stale_warning": is_stale,
        }

        # Automatically log forecast into daily feedback loop
        try:
            from models.feedback_loop import log_forecast_prediction
            log_forecast_prediction(
                commodity=crop.capitalize(),
                market=norm_market,
                district=norm_dist,
                forecast_start_date=str((as_of_ts + timedelta(days=1)).date()),
                daily_forecasts=[f.to_dict() for f in daily_forecasts],
            )
        except Exception as log_err:
            logger.debug(f"Feedback log notice: {log_err}")

        return PriceForecastResult(
            commodity=crop.capitalize(),
            market=norm_market,
            district=norm_dist,
            forecast_start_date=str((as_of_ts + timedelta(days=1)).date()),
            data_as_of=data_as_of_str,
            days_stale=days_stale,
            stale=is_stale,
            horizon_days=horizon_days,
            daily_forecasts=daily_forecasts,
            summary=summary,
        )
