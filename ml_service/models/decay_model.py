"""
Distress-Sale Timing Advisor — Post-Harvest Crop Decay & Shelf-Life Model
Scientifically models physiological weight loss, fungal/pathological spoilage,
and commercial quality downgrades for Tomato and Onion based on temperature,
humidity, storage type, and elapsed crop age since harvest.
"""

from __future__ import annotations

import json
import logging
import math
import os
import sys
from dataclasses import asdict, dataclass, field
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np
import pandas as pd

from models.data_access import load_weather

logger = logging.getLogger("DecayModel")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", stream=sys.stderr)

ML_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_CONFIG_PATH = os.path.join(ML_ROOT, "config", "crop_decay_profiles.json")


@dataclass
class DailyDecayStep:
    day: int
    date: str
    temp_c: float
    humidity_pct: float
    precipitation_mm: float
    weather_assumed: bool
    daily_weight_loss_pct: float
    daily_spoilage_loss_pct: float
    daily_total_loss_pct: float
    retained_weight_quintals: float
    cumulative_weight_loss_pct: float
    quality_discount_pct: float
    effective_value_multiplier: float
    risk_level: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class DecaySimulationResult:
    crop: str
    district: str
    storage_type: str
    storage_name: str
    initial_quantity_quintals: float
    as_of: str
    harvest_date: str
    crop_age_days_at_start: int
    horizon_days: int
    safe_holding_days: int
    shelf_life_cutoff_day: Optional[int]
    horizon_capped: bool
    critical_threshold_pct: float
    warnings: List[str]
    daily_schedule: List[DailyDecayStep]
    summary: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class DecayModel:
    """Scientific post-harvest crop decay and shelf-life simulation model."""

    def __init__(self, config_path: str = DEFAULT_CONFIG_PATH):
        self.config_path = config_path
        self._load_config()
        self.weather_history = load_weather()

    def _load_config(self) -> None:
        if not os.path.exists(self.config_path):
            raise FileNotFoundError(f"Decay config not found at: {self.config_path}")
        with open(self.config_path, "r", encoding="utf-8") as f:
            self.config = json.load(f)
        self.crops = self.config.get("crops", {})
        self.storage_types = self.config.get("storage_types", {})
        self.defaults = self.config.get("simulation_defaults", {})

    def get_supported_crops(self) -> List[str]:
        return list(self.crops.keys())

    def get_supported_storage_types(self) -> List[str]:
        return list(self.storage_types.keys())

    def _canonicalize_crop(self, crop: str) -> str:
        c = crop.strip().lower()
        if c in self.crops:
            return c
        for k, v in self.crops.items():
            if v.get("display_name", "").lower() == c:
                return k
        raise ValueError(
            f"Unsupported crop '{crop}'. Supported crops: {list(self.crops.keys())}"
        )

    def _validate_storage(self, storage_type: str, crop: str) -> Tuple[str, List[str]]:
        s = storage_type.strip().lower()
        warnings = []
        if s not in self.storage_types:
            raise ValueError(
                f"Unknown storage type '{storage_type}'. Supported storage types: {list(self.storage_types.keys())}"
            )

        storage_meta = self.storage_types[s]
        allowed_crops = storage_meta.get("applicable_crops")
        if allowed_crops and crop not in allowed_crops:
            warnings.append(
                f"Storage type '{s}' is not recommended for {crop}. Replaced with 'ambient'."
            )
            s = "ambient"

        return s, warnings

    def _get_quality_discount(
        self, crop_cfg: Dict[str, Any], total_age_days: int, mitigation_factor: float
    ) -> float:
        """Computes commercial quality discount factor for produce age."""
        curve = crop_cfg.get("quality_discount_curve", [])
        if not curve or total_age_days <= 0:
            return 0.0

        if total_age_days <= curve[0]["day"]:
            base_discount = curve[0]["discount"] * (total_age_days / curve[0]["day"])
        elif total_age_days >= curve[-1]["day"]:
            base_discount = curve[-1]["discount"]
        else:
            base_discount = 0.0
            for i in range(len(curve) - 1):
                d1, d2 = curve[i], curve[i + 1]
                if d1["day"] <= total_age_days <= d2["day"]:
                    ratio = (total_age_days - d1["day"]) / (d2["day"] - d1["day"])
                    base_discount = d1["discount"] + ratio * (d2["discount"] - d1["discount"])
                    break

        effective_discount = base_discount * math.sqrt(mitigation_factor)
        return min(max(effective_discount, 0.0), 0.95)

    def _determine_risk_level(self, crop: str, cumulative_loss_pct: float) -> str:
        """Categorize physical loss into strictly LOW, MODERATE, or HIGH."""
        if crop == "tomato":
            if cumulative_loss_pct < 5.0:
                return "LOW"
            elif cumulative_loss_pct < 12.0:
                return "MODERATE"
            else:
                return "HIGH"
        else:  # Onion
            if cumulative_loss_pct < 3.0:
                return "LOW"
            elif cumulative_loss_pct < 8.0:
                return "MODERATE"
            else:
                return "HIGH"

    def _get_weather_for_date(
        self,
        district: str,
        target_date: date,
        weather_forecast: Optional[List[Dict[str, Any]]] = None,
    ) -> Tuple[float, float, float, bool]:
        """
        Get weather for a specific date:
        1. From weather_forecast list if target_date matches
        2. From historical weather table if date <= dataset max
        3. Beyond forecast window, from historical day-of-year average (±7 day window)
        """
        target_date_str = target_date.strftime("%Y-%m-%d")

        # 1. Check provided forecast list
        if weather_forecast:
            for wf in weather_forecast:
                wf_date = str(wf.get("date", ""))[:10]
                if wf_date == target_date_str:
                    temp = wf.get("temp_mean") or wf.get("temperature_2m_mean") or 25.0
                    hum = wf.get("humidity_mean") or wf.get("relative_humidity_2m_mean") or 70.0
                    precip = wf.get("precipitation_sum") or wf.get("rain_sum") or 0.0
                    return float(temp), float(hum), float(precip), False

        # 2. Check historical table
        dist_clean = district.strip().capitalize()
        target_ts = pd.Timestamp(target_date)
        match = self.weather_history[
            (self.weather_history["District"] == dist_clean)
            & (self.weather_history["date"] == target_ts)
        ]
        if not match.empty:
            r = match.iloc[0]
            temp = float(r["temp_mean"])
            hum = float(r["humidity_mean"]) if pd.notna(r["humidity_mean"]) else 70.0
            precip = float(r["precipitation_sum"]) if pd.notna(r["precipitation_sum"]) else 0.0
            return temp, hum, precip, False

        # 3. Beyond history: day-of-year seasonal average (±7 day window)
        doy = target_ts.dayofyear
        doy_matches = self.weather_history[
            (self.weather_history["District"] == dist_clean)
            & (self.weather_history["date"].dt.dayofyear >= doy - 7)
            & (self.weather_history["date"].dt.dayofyear <= doy + 7)
        ]
        if not doy_matches.empty:
            temp = float(doy_matches["temp_mean"].mean())
            hum = float(doy_matches["humidity_mean"].dropna().mean()) if doy_matches["humidity_mean"].notna().any() else 70.0
            precip = float(doy_matches["precipitation_sum"].mean()) if doy_matches["precipitation_sum"].notna().any() else 0.0
            return round(temp, 1), round(hum, 1), round(precip, 1), True

        # Fallback default
        return 25.0, 70.0, 0.0, True

    def simulate(
        self,
        crop: str,
        initial_quantity_quintals: float = 100.0,
        storage_type: str = "ambient",
        district: str = "Kolhapur",
        harvest_date: Optional[Union[str, date, datetime]] = None,
        as_of: Optional[Union[str, date, datetime]] = None,
        horizon_days: Optional[int] = None,
        weather_forecast: Optional[List[Dict[str, Any]]] = None,
    ) -> DecaySimulationResult:
        """
        Runs complete post-harvest decay simulation with shelf-life cutoff,
        crop age replay, and environment controls.
        """
        crop_key = self._canonicalize_crop(crop)
        storage_key, warnings = self._validate_storage(storage_type, crop_key)

        crop_cfg = self.crops[crop_key]
        storage_cfg = self.storage_types[storage_key]

        # Parse as_of date (default: today)
        if as_of is None:
            as_of_date = date.today()
        elif isinstance(as_of, (datetime, pd.Timestamp)):
            as_of_date = as_of.date()
        elif isinstance(as_of, date):
            as_of_date = as_of
        else:
            as_of_date = datetime.strptime(str(as_of)[:10], "%Y-%m-%d").date()

        # Parse harvest_date (default: as_of)
        if harvest_date is None:
            h_date = as_of_date
        elif isinstance(harvest_date, (datetime, pd.Timestamp)):
            h_date = harvest_date.date()
        elif isinstance(harvest_date, date):
            h_date = harvest_date
        else:
            h_date = datetime.strptime(str(harvest_date)[:10], "%Y-%m-%d").date()

        if h_date > as_of_date:
            h_date = as_of_date

        elapsed_age_days = (as_of_date - h_date).days

        # Configuration constants
        q10 = crop_cfg.get("q10", 2.0)
        t_base = crop_cfg.get("t_base", 22.0)
        critical_loss_pct = crop_cfg.get("critical_loss_threshold", 0.15) * 100.0
        cutoff_mult = self.defaults.get("cutoff_value_multiplier", 0.60)
        max_allowed_days = self.defaults.get("max_simulation_days", {}).get(crop_key, 30)

        # Simulation horizon: if not specified or shorter than shelf life, simulate up to cutoff
        target_horizon = horizon_days or (14 if crop_key == "tomato" else 30)

        # Replay elapsed pre-storage days (from harvest_date to as_of)
        current_weight = float(initial_quantity_quintals)
        if elapsed_age_days > 0:
            for elapsed_d in range(elapsed_age_days):
                past_date = h_date + timedelta(days=elapsed_d)
                temp, hum, precip, _ = self._get_weather_for_date(district, past_date)
                temp_factor = q10 ** ((temp - t_base) / 10.0)
                if crop_key == "tomato":
                    w_rate = crop_cfg.get("base_daily_weight_loss", 0.015) * temp_factor
                    s_rate = crop_cfg.get("base_daily_spoilage_rate", 0.020) * temp_factor
                else:
                    w_rate = crop_cfg.get("base_daily_weight_loss", 0.0018) * temp_factor
                    s_rate = crop_cfg.get("base_daily_spoilage_rate", 0.0012) * temp_factor
                loss_rate = min(w_rate + s_rate, 0.40)
                current_weight = current_weight * (1.0 - loss_rate)

        # Storage environmental controls (prevents double counting)
        is_override = storage_cfg.get("environment_override", False)
        mitigation = storage_cfg.get("mitigation_factor", 1.0) if not is_override else 1.0

        # Initial quality & value multiplier as of today (t=0) accounting for elapsed crop age
        quality_discount_today = (
            self._get_quality_discount(crop_cfg, elapsed_age_days, mitigation)
            if elapsed_age_days > 0 else 0.0
        )
        eff_value_mult_today = (current_weight / initial_quantity_quintals) * (1.0 - quality_discount_today)
        initial_risk_today = self._determine_risk_level(
            crop_key,
            ((initial_quantity_quintals - current_weight) / initial_quantity_quintals) * 100.0,
        )

        daily_steps: List[DailyDecayStep] = []
        safe_holding_days = target_horizon
        cutoff_day: Optional[int] = None
        horizon_capped = False

        max_loop_days = max(target_horizon, max_allowed_days)

        for step_idx in range(1, max_loop_days + 1):
            step_date = as_of_date + timedelta(days=step_idx)
            total_crop_age = elapsed_age_days + step_idx

            temp_c, humidity_pct, precip_mm, assumed = self._get_weather_for_date(
                district, step_date, weather_forecast
            )

            # Apply environmental modification if storage provides active climate control
            if storage_key == "cold_storage":
                eff_temp = float(storage_cfg.get("temp_c", {}).get(crop_key, 10.0))
                eff_humidity = float(storage_cfg.get("rh_pct", {}).get(crop_key, 85.0))
            elif storage_key == "zecc":
                eff_temp = max(temp_c - storage_cfg.get("temp_reduction_c", 6.0), 16.0)
                eff_humidity = min(humidity_pct + storage_cfg.get("rh_boost_pct", 15.0), 90.0)
            else:
                eff_temp = temp_c
                eff_humidity = humidity_pct

            # Physical loss calculation
            if crop_key == "tomato":
                base_w_loss = crop_cfg.get("base_daily_weight_loss", 0.015)
                base_spoil = crop_cfg.get("base_daily_spoilage_rate", 0.020)
                temp_factor = q10 ** ((eff_temp - t_base) / 10.0)

                rh_transp_factor = 1.0 + max(0.0, (80.0 - eff_humidity) / 100.0)
                daily_w_rate = base_w_loss * temp_factor * rh_transp_factor * mitigation

                rh_rot_factor = 1.0 + max(0.0, (eff_humidity - 85.0) / 40.0)
                daily_s_rate = base_spoil * temp_factor * rh_rot_factor * mitigation

                high_temp_thresh = crop_cfg.get("high_temp_threshold", 30.0)
                if eff_temp > high_temp_thresh:
                    penalty_factor = crop_cfg.get("high_temp_penalty_factor", 0.04)
                    daily_s_rate += (eff_temp - high_temp_thresh) * penalty_factor * mitigation
            else:  # Onion
                base_w_loss = crop_cfg.get("base_daily_weight_loss", 0.0018)
                base_spoil = crop_cfg.get("base_daily_spoilage_rate", 0.0012)
                temp_factor = q10 ** ((eff_temp - t_base) / 10.0)

                daily_w_rate = base_w_loss * temp_factor * mitigation
                daily_s_rate = base_spoil * temp_factor * mitigation

                high_rh_thresh = crop_cfg.get("high_rh_threshold", 75.0)
                if eff_humidity > high_rh_thresh:
                    daily_s_rate += (
                        (eff_humidity - high_rh_thresh)
                        * crop_cfg.get("high_rh_penalty_factor", 0.003)
                        * mitigation
                    )

                if precip_mm > 2.0 and storage_key not in ["cold_storage", "ventilated_chawl"]:
                    daily_s_rate += crop_cfg.get("rain_dampness_penalty", 0.004) * mitigation

            daily_total_rate = min(daily_w_rate + daily_s_rate, 0.40)
            current_weight = current_weight * (1.0 - daily_total_rate)

            cum_weight_loss_pct = (
                (initial_quantity_quintals - current_weight) / initial_quantity_quintals * 100.0
            )

            # Quality discount based on total chronological age
            quality_discount = self._get_quality_discount(crop_cfg, total_crop_age, mitigation)

            # Commercial effective value multiplier
            eff_value_mult = (current_weight / initial_quantity_quintals) * (1.0 - quality_discount)

            risk = self._determine_risk_level(crop_key, cum_weight_loss_pct)

            if cum_weight_loss_pct >= critical_loss_pct and safe_holding_days == target_horizon:
                safe_holding_days = max(1, step_idx - 1)

            step = DailyDecayStep(
                day=step_idx,
                date=step_date.strftime("%Y-%m-%d"),
                temp_c=round(eff_temp, 1),
                humidity_pct=round(eff_humidity, 1),
                precipitation_mm=round(precip_mm, 1),
                weather_assumed=assumed,
                daily_weight_loss_pct=round(daily_w_rate * 100.0, 2),
                daily_spoilage_loss_pct=round(daily_s_rate * 100.0, 2),
                daily_total_loss_pct=round(daily_total_rate * 100.0, 2),
                retained_weight_quintals=round(current_weight, 2),
                cumulative_weight_loss_pct=round(cum_weight_loss_pct, 2),
                quality_discount_pct=round(quality_discount * 100.0, 2),
                effective_value_multiplier=round(eff_value_mult, 4),
                risk_level=risk,
            )
            daily_steps.append(step)

            # Check shelf-life cutoff
            if eff_value_mult < cutoff_mult and cutoff_day is None:
                cutoff_day = step_idx
                if step_idx >= target_horizon:
                    break

            if step_idx >= max_allowed_days:
                horizon_capped = True
                break

        final_step = daily_steps[-1]
        summary = {
            "initial_weight_quintals": round(initial_quantity_quintals, 2),
            "current_weight_quintals_today": round(current_weight, 2),
            "effective_value_multiplier_today": round(eff_value_mult_today, 4),
            "quality_discount_pct_today": round(quality_discount_today * 100.0, 2),
            "initial_risk_today": initial_risk_today,
            "final_sellable_weight_quintals": final_step.retained_weight_quintals,
            "total_physical_loss_pct": final_step.cumulative_weight_loss_pct,
            "final_quality_discount_pct": final_step.quality_discount_pct,
            "final_value_multiplier": final_step.effective_value_multiplier,
            "final_risk_level": final_step.risk_level,
            "safe_holding_horizon_days": safe_holding_days,
            "shelf_life_cutoff_day": cutoff_day,
            "holding_recommendation": (
                "FAVORABLE" if final_step.risk_level in ["LOW", "MODERATE"] else "HIGH_RISK"
            ),
        }

        return DecaySimulationResult(
            crop=crop_cfg.get("display_name", crop_key),
            district=district,
            storage_type=storage_key,
            storage_name=storage_cfg.get("display_name", storage_key),
            initial_quantity_quintals=initial_quantity_quintals,
            as_of=str(as_of_date),
            harvest_date=str(h_date),
            crop_age_days_at_start=elapsed_age_days,
            horizon_days=len(daily_steps),
            safe_holding_days=safe_holding_days,
            shelf_life_cutoff_day=cutoff_day,
            horizon_capped=horizon_capped,
            critical_threshold_pct=critical_loss_pct,
            warnings=warnings,
            daily_schedule=daily_steps,
            summary=summary,
        )
