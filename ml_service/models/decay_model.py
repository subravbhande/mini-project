"""
AgriSense — Post-Harvest Crop Decay & Quality Degradation Model
Models physical weight loss, fungal/pathological spoilage, and commercial
quality downgrades for perishable (Tomato) and semi-perishable (Onion)
commodities based on environmental conditions and storage type.

Used by Phase 3 Decision Engine to calculate Net Realizable Value (NRV):
    NRV(t) = Q(t) * P(t) * (1 - quality_discount(t)) - StorageCost(t) - TransportCost
"""

from __future__ import annotations

import json
import math
import os
from dataclasses import asdict, dataclass
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Union
import pandas as pd


DEFAULT_CONFIG_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), "config", "crop_decay_profiles.json"
)


@dataclass
class DailyDecayStep:
    day: int
    date: str
    temp_c: float
    humidity_pct: float
    precipitation_mm: float
    daily_weight_loss_pct: float
    daily_spoilage_loss_pct: float
    daily_total_loss_pct: float
    retained_weight_quintals: float
    cumulative_weight_loss_pct: float
    quality_discount_pct: float
    effective_value_multiplier: float
    risk_level: str


@dataclass
class DecaySimulationResult:
    crop: str
    district: str
    storage_type: str
    storage_name: str
    initial_quantity_quintals: float
    horizon_days: int
    safe_holding_days: int
    critical_threshold_pct: float
    daily_schedule: List[DailyDecayStep]
    summary: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class DecayModel:
    """Scientific post-harvest crop decay and shelf-life simulation model."""

    def __init__(self, config_path: str = DEFAULT_CONFIG_PATH):
        self.config_path = config_path
        self._load_config()

    def _load_config(self) -> None:
        if not os.path.exists(self.config_path):
            raise FileNotFoundError(f"Decay config not found at: {self.config_path}")
        with open(self.config_path, "r", encoding="utf-8") as f:
            self.config = json.load(f)
        self.crops = self.config.get("crops", {})
        self.storage_types = self.config.get("storage_types", {})

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

    def _canonicalize_storage(self, storage_type: str, crop: str) -> str:
        s = storage_type.strip().lower()
        if s not in self.storage_types:
            # Fallback to ambient if unknown
            s = "ambient"

        # Check if storage is valid for this crop
        storage_meta = self.storage_types[s]
        allowed_crops = storage_meta.get("applicable_crops")
        if allowed_crops and crop not in allowed_crops:
            # e.g., ventilated_chawl is only for onion; if used for tomato, fallback to ambient
            return "ambient"
        return s

    def _get_quality_discount(
        self, crop_cfg: Dict[str, Any], day: int, mitigation_factor: float
    ) -> float:
        """Computes commercial quality discount factor for day t."""
        curve = crop_cfg.get("quality_discount_curve", [])
        if not curve or day <= 0:
            return 0.0

        # Exact match or interpolate
        base_discount = 0.0
        if day <= curve[0]["day"]:
            base_discount = curve[0]["discount"] * (day / curve[0]["day"])
        elif day >= curve[-1]["day"]:
            base_discount = curve[-1]["discount"]
        else:
            for i in range(len(curve) - 1):
                d1, d2 = curve[i], curve[i + 1]
                if d1["day"] <= day <= d2["day"]:
                    ratio = (day - d1["day"]) / (d2["day"] - d1["day"])
                    base_discount = d1["discount"] + ratio * (
                        d2["discount"] - d1["discount"]
                    )
                    break

        # In cold or improved storage, quality deterioration is slower
        effective_discount = base_discount * math.sqrt(mitigation_factor)
        return min(max(effective_discount, 0.0), 0.95)

    def _determine_risk_level(self, crop: str, cumulative_loss_pct: float) -> str:
        if crop == "tomato":
            if cumulative_loss_pct < 4.0:
                return "LOW"
            elif cumulative_loss_pct < 10.0:
                return "MODERATE"
            elif cumulative_loss_pct < 18.0:
                return "HIGH"
            else:
                return "CRITICAL"
        else:  # onion
            if cumulative_loss_pct < 2.0:
                return "LOW"
            elif cumulative_loss_pct < 6.0:
                return "MODERATE"
            elif cumulative_loss_pct < 12.0:
                return "HIGH"
            else:
                return "CRITICAL"

    def simulate(
        self,
        crop: str,
        initial_quantity_quintals: float = 100.0,
        storage_type: str = "ambient",
        district: str = "Kolhapur",
        start_date: Optional[Union[str, date, datetime]] = None,
        horizon_days: int = 7,
        weather_forecast: Optional[List[Dict[str, Any]]] = None,
    ) -> DecaySimulationResult:
        """
        Runs decay simulation over the horizon.

        Args:
            crop: 'tomato' or 'onion' (case-insensitive)
            initial_quantity_quintals: Starting weight of produce (Quintals)
            storage_type: 'ambient', 'ventilated_chawl', 'zecc', 'cold_storage'
            district: 'Kolhapur' or 'Sangli'
            start_date: Harvest/storage start date (defaults to today)
            horizon_days: Number of days to simulate (e.g., 7 or 14)
            weather_forecast: Optional list of daily weather dicts containing:
                {'temp_mean': float, 'humidity_mean': float, 'precipitation_sum': float}
        """
        crop_key = self._canonicalize_crop(crop)
        storage_key = self._canonicalize_storage(storage_type, crop_key)

        crop_cfg = self.crops[crop_key]
        storage_cfg = self.storage_types[storage_key]

        if start_date is None:
            curr_date = date.today()
        elif isinstance(start_date, (datetime, pd.Timestamp)):
            curr_date = start_date.date()
        elif isinstance(start_date, date):
            curr_date = start_date
        else:
            curr_date = datetime.strptime(str(start_date)[:10], "%Y-%m-%d").date()

        mitigation = storage_cfg.get("mitigation_factor", 1.0)
        q10 = crop_cfg.get("q10", 2.0)
        t_base = crop_cfg.get("t_base", 22.0)
        critical_threshold_pct = crop_cfg.get("critical_loss_threshold", 0.15) * 100.0

        daily_steps: List[DailyDecayStep] = []
        current_weight = float(initial_quantity_quintals)
        safe_holding_days = horizon_days

        for day in range(1, horizon_days + 1):
            step_date = curr_date + timedelta(days=day)
            date_str = step_date.strftime("%Y-%m-%d")

            # Extract or default weather parameters
            day_weather = {}
            if weather_forecast and len(weather_forecast) >= day:
                day_weather = weather_forecast[day - 1]

            temp_c = float(
                day_weather.get("temp_mean")
                or day_weather.get("temperature_2m_mean")
                or 25.0
            )
            humidity_pct = float(
                day_weather.get("humidity_mean")
                or day_weather.get("relative_humidity_2m_mean")
                or 70.0
            )
            precip_mm = float(
                day_weather.get("precipitation_sum")
                or day_weather.get("rain_sum")
                or 0.0
            )

            # Adjust environmental exposure if cold storage or ZECC
            eff_temp = temp_c
            eff_humidity = humidity_pct

            if storage_key == "cold_storage":
                eff_temp = 12.0 if crop_key == "tomato" else 2.0
                eff_humidity = 88.0 if crop_key == "tomato" else 65.0
            elif storage_key == "zecc":
                eff_temp = max(temp_c - 6.0, 16.0)
                eff_humidity = min(humidity_pct + 15.0, 90.0)

            # --- Physical Loss Calculations ---
            if crop_key == "tomato":
                base_w_loss = crop_cfg.get("base_daily_weight_loss", 0.015)
                base_spoil = crop_cfg.get("base_daily_spoilage_rate", 0.020)

                temp_factor = q10 ** ((eff_temp - t_base) / 10.0)

                # Low RH causes transpiration/shriveling
                rh_transpiration_factor = 1.0 + max(0.0, (80.0 - eff_humidity) / 100.0)
                daily_w_rate = (
                    base_w_loss * temp_factor * rh_transpiration_factor * mitigation
                )

                # High RH + warm temp drives fungal rot
                rh_rot_factor = 1.0 + max(0.0, (eff_humidity - 85.0) / 40.0)
                daily_s_rate = base_spoil * temp_factor * rh_rot_factor * mitigation

                # High heat stress penalty
                if eff_temp > crop_cfg.get("high_temp_threshold", 30.0):
                    daily_s_rate += (
                        (eff_temp - crop_cfg["high_temp_threshold"]) * 0.003 * mitigation
                    )

            else:  # Onion
                base_w_loss = crop_cfg.get("base_daily_weight_loss", 0.0018)
                base_spoil = crop_cfg.get("base_daily_spoilage_rate", 0.0012)

                temp_factor = q10 ** ((eff_temp - t_base) / 10.0)
                daily_w_rate = base_w_loss * temp_factor * mitigation
                daily_s_rate = base_spoil * temp_factor * mitigation

                # High RH (>75%) triggers black mold & sprouting
                high_rh_thresh = crop_cfg.get("high_rh_threshold", 75.0)
                if eff_humidity > high_rh_thresh:
                    daily_s_rate += (
                        (eff_humidity - high_rh_thresh)
                        * crop_cfg.get("high_rh_penalty_factor", 0.003)
                        * mitigation
                    )

                # Rain dampness penalty for non-cold storage
                if precip_mm > 2.0 and storage_key != "cold_storage":
                    daily_s_rate += (
                        crop_cfg.get("rain_dampness_penalty", 0.004) * mitigation
                    )

            # Total physical loss for the day
            daily_total_rate = min(daily_w_rate + daily_s_rate, 0.40)
            current_weight = current_weight * (1.0 - daily_total_rate)

            cum_weight_loss_pct = (
                (initial_quantity_quintals - current_weight)
                / initial_quantity_quintals
                * 100.0
            )

            # Quality discount
            quality_discount = self._get_quality_discount(crop_cfg, day, mitigation)

            # Commercial value multiplier (retained physical fraction * quality retention)
            eff_value_mult = (current_weight / initial_quantity_quintals) * (
                1.0 - quality_discount
            )

            risk = self._determine_risk_level(crop_key, cum_weight_loss_pct)

            # Track safe holding days cutoff
            if cum_weight_loss_pct >= critical_threshold_pct and safe_holding_days == horizon_days:
                safe_holding_days = max(1, day - 1)

            step = DailyDecayStep(
                day=day,
                date=date_str,
                temp_c=round(eff_temp, 1),
                humidity_pct=round(eff_humidity, 1),
                precipitation_mm=round(precip_mm, 1),
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

        # Summary KPIs
        final_step = daily_steps[-1]
        summary = {
            "initial_weight_quintals": round(initial_quantity_quintals, 2),
            "final_sellable_weight_quintals": final_step.retained_weight_quintals,
            "total_physical_loss_pct": final_step.cumulative_weight_loss_pct,
            "final_quality_discount_pct": final_step.quality_discount_pct,
            "final_value_multiplier": final_step.effective_value_multiplier,
            "final_risk_level": final_step.risk_level,
            "safe_holding_horizon_days": safe_holding_days,
            "holding_recommendation": (
                "FAVORABLE"
                if final_step.risk_level in ["LOW", "MODERATE"]
                else "HIGH_RISK_DISTRESS_SALE_LIKELY"
            ),
        }

        return DecaySimulationResult(
            crop=crop_cfg.get("display_name", crop_key),
            district=district,
            storage_type=storage_key,
            storage_name=storage_cfg.get("display_name", storage_key),
            initial_quantity_quintals=initial_quantity_quintals,
            horizon_days=horizon_days,
            safe_holding_days=safe_holding_days,
            critical_threshold_pct=critical_threshold_pct,
            daily_schedule=daily_steps,
            summary=summary,
        )

    def load_weather_from_clean_dataset(
        self,
        district: str,
        start_date: str,
        horizon_days: int = 14,
        csv_path: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Helper method to extract weather window from the cleaned weather dataset.
        Useful for backtesting, historical simulations, and offline scenarios.
        """
        if csv_path is None:
            csv_path = os.path.join(
                os.path.dirname(os.path.dirname(__file__)),
                "data",
                "processed",
                "weather_history_clean.csv",
            )

        if not os.path.exists(csv_path):
            return []

        df = pd.read_csv(csv_path, parse_dates=["date"])
        df["District"] = df["District"].str.strip().str.capitalize()
        target_dist = district.strip().capitalize()

        dist_df = df[df["District"] == target_dist].sort_values("date")
        start_ts = pd.to_datetime(start_date)
        window = dist_df[dist_df["date"] >= start_ts].head(horizon_days)

        records = []
        for _, r in window.iterrows():
            records.append({
                "date": str(r["date"].date()),
                "temp_mean": float(r["temperature_2m_mean"]),
                "humidity_mean": (
                    float(r["relative_humidity_2m_mean"])
                    if pd.notna(r.get("relative_humidity_2m_mean"))
                    else 70.0
                ),
                "precipitation_sum": float(r.get("precipitation_sum", 0.0)),
            })
        return records
