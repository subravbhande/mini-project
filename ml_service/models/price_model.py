"""
AgriSense — XGBoost Price Prediction Model
Predicts crop Modal Price (Rs./Quintal) for Onion and Tomato markets
in Sangli & Kolhapur districts using price history, supply (arrival
quantity), weather, and temporal/seasonal features.

Used by the Phase 3 Decision Engine to estimate future market price P(t):
    NRV(t) = Q(t) * P(t) * (1 - quality_discount(t)) - Costs
"""

from __future__ import annotations

import json
import os
import pickle
from dataclasses import dataclass, field, asdict
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder

try:
    from xgboost import XGBRegressor
except ImportError as e:
    raise ImportError(
        "xgboost is required. Install with: pip install xgboost"
    ) from e

ML_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_CONFIG_PATH = os.path.join(ML_ROOT, "config", "price_model_config.json")

HARVEST_SEASONS = {
    "tomato": [10, 11, 12, 1, 4, 5, 6],
    "onion":  [2, 3, 4, 5, 10, 11, 12],
}

WMO_RAIN_CODES = {51, 53, 55, 61, 63, 65, 71, 73, 75, 80, 81, 82, 95, 96, 99}


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class PricePrediction:
    """Single-day price prediction result."""
    date: str
    commodity: str
    market: str
    district: str
    predicted_modal_price: float
    predicted_min_price: float
    predicted_max_price: float
    confidence_band_low: float
    confidence_band_high: float
    weather_risk_flag: bool
    weather_risk_reason: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class PriceForecast:
    """Multi-day price forecast result."""
    commodity: str
    market: str
    district: str
    forecast_start_date: str
    horizon_days: int
    daily_forecasts: List[PricePrediction] = field(default_factory=list)
    summary: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "commodity": self.commodity,
            "market": self.market,
            "district": self.district,
            "forecast_start_date": self.forecast_start_date,
            "horizon_days": self.horizon_days,
            "daily_forecasts": [f.to_dict() for f in self.daily_forecasts],
            "summary": self.summary,
        }


# ---------------------------------------------------------------------------
# Feature engineering helpers
# ---------------------------------------------------------------------------

def _add_temporal_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add date-derived temporal features."""
    df = df.copy()
    df["day_of_week"]  = df["date"].dt.dayofweek          # 0=Mon
    df["month"]        = df["date"].dt.month
    df["week_of_year"] = df["date"].dt.isocalendar().week.astype(int)
    df["day_of_year"]  = df["date"].dt.dayofyear
    df["quarter"]      = df["date"].dt.quarter

    # Cyclical encoding for month and day-of-week
    df["month_sin"]    = np.sin(2 * np.pi * df["month"]       / 12)
    df["month_cos"]    = np.cos(2 * np.pi * df["month"]       / 12)
    df["dow_sin"]      = np.sin(2 * np.pi * df["day_of_week"] / 7)
    df["dow_cos"]      = np.cos(2 * np.pi * df["day_of_week"] / 7)
    return df


def _add_harvest_season_flag(df: pd.DataFrame) -> pd.DataFrame:
    """Add binary is_harvest_season flag per commodity."""
    df = df.copy()
    commodity_lower = df["Commodity"].str.lower()

    def harvest_flag(row):
        crop = row["Commodity"].lower()
        months = HARVEST_SEASONS.get(crop, [])
        return 1 if row["month"] in months else 0

    df["is_harvest_season"] = df.apply(harvest_flag, axis=1)
    return df


def _add_weather_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add weather lag and rolling features. Weather columns must already be joined."""
    df = df.copy()

    weather_cols = [
        "temp_mean", "temp_max", "temp_min",
        "precipitation_sum", "rain_sum", "precipitation_hours",
        "evapotranspiration", "humidity_mean",
        "soil_moisture_0_to_100cm", "soil_moisture_0_to_7cm",
    ]

    for col in weather_cols:
        if col not in df.columns:
            df[col] = 0.0

    # Lag 3-day temperature (heat builds slowly)
    df["temp_mean_lag3"] = df.groupby(["Commodity", "Market"])["temp_mean"].shift(3)

    # 7-day rolling weather features
    for col in ["precipitation_sum", "humidity_mean", "temp_mean"]:
        df[f"{col}_roll7"] = (
            df.groupby(["Commodity", "Market"])[col]
            .transform(lambda x: x.shift(1).rolling(7, min_periods=1).mean())
        )

    # Binary rain event flags
    df["heavy_rain_flag"] = (df["precipitation_sum"] > 20.0).astype(int)
    df["is_rainy_weather"] = df["weather_code"].apply(
        lambda c: 1 if int(c) in WMO_RAIN_CODES else 0
        if pd.notna(c) else 0
    ).astype(int)

    return df


def _add_price_lag_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add lag and rolling price/arrival features per (Commodity, Market) group."""
    df = df.copy()

    for lag in [1, 7, 14]:
        df[f"modal_price_lag{lag}"] = (
            df.groupby(["Commodity", "Market"])["Modal Price"].shift(lag)
        )
        df[f"min_price_lag{lag}"] = (
            df.groupby(["Commodity", "Market"])["Min Price"].shift(lag)
        )
        df[f"max_price_lag{lag}"] = (
            df.groupby(["Commodity", "Market"])["Max Price"].shift(lag)
        )

    for window in [7, 14]:
        df[f"modal_price_roll{window}"] = (
            df.groupby(["Commodity", "Market"])["Modal Price"]
            .transform(lambda x: x.shift(1).rolling(window, min_periods=1).mean())
        )
        df[f"modal_price_std{window}"] = (
            df.groupby(["Commodity", "Market"])["Modal Price"]
            .transform(lambda x: x.shift(1).rolling(window, min_periods=1).std().fillna(0))
        )

    # Price range (volatility proxy)
    df["price_range"] = df["Max Price"] - df["Min Price"]

    # Supply features
    df["arrival_lag1"] = (
        df.groupby(["Commodity", "Market"])["Arrival Quantity"].shift(1)
    )
    df["arrival_roll7"] = (
        df.groupby(["Commodity", "Market"])["Arrival Quantity"]
        .transform(lambda x: x.shift(1).rolling(7, min_periods=1).mean())
    )

    return df


# ---------------------------------------------------------------------------
# Main model class
# ---------------------------------------------------------------------------

class PriceModel:
    """
    XGBoost-based agricultural commodity price prediction model.

    Workflow:
        1. load_and_prepare_data() — load + merge + feature engineering
        2. train()                  — fit XGBoost on training split
        3. evaluate()               — metrics on held-out test set
        4. predict()                — forecast next N days
        5. save() / load()          — persist model to disk
    """

    def __init__(self, config_path: str = DEFAULT_CONFIG_PATH):
        self.config_path = config_path
        self._load_config()

        params = self.cfg["model"]["hyperparameters"]
        self.model = XGBRegressor(**params)
        self.label_encoders: Dict[str, LabelEncoder] = {}
        self.feature_names: List[str] = []
        self.is_trained: bool = False
        self._train_df: Optional[pd.DataFrame] = None  # kept for rolling predict

    # ------------------------------------------------------------------
    # Config
    # ------------------------------------------------------------------

    def _load_config(self) -> None:
        if not os.path.exists(self.config_path):
            raise FileNotFoundError(f"Config not found: {self.config_path}")
        # utf-8-sig handles BOM written by PowerShell Set-Content
        with open(self.config_path, "r", encoding="utf-8-sig") as f:
            self.cfg = json.load(f)

    def _abs_path(self, rel: str) -> str:
        return os.path.join(ML_ROOT, rel)

    # ------------------------------------------------------------------
    # Data loading & preparation
    # ------------------------------------------------------------------

    def load_and_prepare_data(
        self,
        price_csv: Optional[str] = None,
        weather_processed_dir: Optional[str] = None,
    ) -> pd.DataFrame:
        """
        Loads price data, joins weather, engineers all features.
        Returns the fully prepared DataFrame (NaN rows from lags dropped).
        """
        price_path = price_csv or self._abs_path(self.cfg["paths"]["price_data"])
        proc_dir   = weather_processed_dir or self._abs_path("data/processed")

        # ---- Load price data ----
        df = pd.read_csv(price_path, parse_dates=["Arrival Date"])
        df.rename(columns={"Arrival Date": "date"}, inplace=True)
        df.sort_values(["Commodity", "Market", "date"], inplace=True)
        df.reset_index(drop=True, inplace=True)

        # Drop unwanted columns
        drop_cols = [c for c in self.cfg["features"]["drop_columns"] if c in df.columns]
        df.drop(columns=drop_cols, inplace=True)

        # ---- Coerce numeric columns (handles comma-formatted strings like "1,025.60") ----
        numeric_cols = ["Min Price", "Max Price", "Modal Price", "Arrival Quantity"]
        for col in numeric_cols:
            if col in df.columns:
                df[col] = (
                    df[col].astype(str)
                    .str.replace(",", "", regex=False)
                    .pipe(pd.to_numeric, errors="coerce")
                )
        df.dropna(subset=["Modal Price"], inplace=True)
        df.reset_index(drop=True, inplace=True)

        # ---- Load & join weather ----
        weather_frames = []
        for district in ["Kolhapur", "Sangli"]:
            wp = os.path.join(proc_dir, f"{district.lower()}_daily_weather.csv")
            if os.path.exists(wp):
                wdf = pd.read_csv(wp, parse_dates=["date"])
                weather_frames.append(wdf)

        if weather_frames:
            weather_df = pd.concat(weather_frames, ignore_index=True)
            # Normalize district names for join
            weather_df["District"] = weather_df["district"].str.capitalize()
            weather_df.drop(columns=["district"], inplace=True)
            df = df.merge(weather_df, on=["date", "District"], how="left")
        else:
            print("[WARN] No processed weather files found. Weather features will be zero-filled.")

        # ---- Feature engineering ----
        df = _add_temporal_features(df)
        df = _add_harvest_season_flag(df)
        df = _add_weather_features(df)
        df = _add_price_lag_features(df)

        # ---- Encode categoricals ----
        cat_cols = self.cfg["features"]["categorical_columns"]
        for col in cat_cols:
            if col not in df.columns:
                continue
            le = LabelEncoder()
            df[col + "_enc"] = le.fit_transform(df[col].astype(str))
            self.label_encoders[col] = le

        return df

    def _build_feature_matrix(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series]:
        """Extract X (features) and y (target) from prepared DataFrame."""
        target = self.cfg["training"]["target_column"]

        # All numeric / encoded columns except raw categoricals and target
        exclude = {
            "date", target, "Min Price", "Max Price",
            "Commodity", "Market", "District",
        }
        feature_cols = [
            c for c in df.columns
            if c not in exclude and df[c].dtype in [np.float64, np.int64, np.float32, np.int32, float, int]
        ]

        # Fill NaN weather with 0, lag NaN will be dropped
        X = df[feature_cols].fillna(0)
        y = df[target]

        self.feature_names = feature_cols
        return X, y

    # ------------------------------------------------------------------
    # Training
    # ------------------------------------------------------------------

    def train(
        self,
        df: Optional[pd.DataFrame] = None,
        price_csv: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Trains the XGBoost model. Returns training metrics.
        If df is None, calls load_and_prepare_data() automatically.
        """
        if df is None:
            df = self.load_and_prepare_data(price_csv=price_csv)

        # Drop rows with NaN in lag features (first 14 days per series)
        df_clean = df.dropna(subset=["modal_price_lag14"]).reset_index(drop=True)
        self._train_df = df_clean

        test_days = self.cfg["training"]["test_days"]
        cutoff = df_clean["date"].max() - timedelta(days=test_days)

        train_df = df_clean[df_clean["date"] <= cutoff]
        test_df  = df_clean[df_clean["date"] >  cutoff]

        X_train, y_train = self._build_feature_matrix(train_df)
        X_test,  y_test  = self._build_feature_matrix(test_df)

        print(f"\n[PriceModel] Training on {len(X_train)} rows, testing on {len(X_test)} rows")
        print(f"             Features: {len(self.feature_names)}")
        print(f"             Train date range: {train_df['date'].min().date()} -> {train_df['date'].max().date()}")
        print(f"             Test  date range: {test_df['date'].min().date()}  -> {test_df['date'].max().date()}")

        self.model.fit(
            X_train, y_train,
            eval_set=[(X_test, y_test)],
            verbose=False,
        )
        self.is_trained = True

        # Basic train-set metric
        train_pred = self.model.predict(X_train)
        train_mae  = float(np.mean(np.abs(train_pred - y_train)))

        return {
            "train_rows": len(X_train),
            "test_rows":  len(X_test),
            "n_features": len(self.feature_names),
            "train_mae_rs_per_quintal": round(train_mae, 2),
        }

    # ------------------------------------------------------------------
    # Evaluation
    # ------------------------------------------------------------------

    def evaluate(self) -> Dict[str, Any]:
        """
        Evaluates on the held-out test split. Must call train() first.
        Returns MAE, RMSE, MAPE, R2 per commodity and overall.
        """
        if not self.is_trained or self._train_df is None:
            raise RuntimeError("Model not trained. Call train() first.")

        test_days = self.cfg["training"]["test_days"]
        cutoff    = self._train_df["date"].max() - timedelta(days=test_days)
        test_df   = self._train_df[self._train_df["date"] > cutoff].copy()

        X_test, y_test = self._build_feature_matrix(test_df)
        preds = self.model.predict(X_test)
        # Store predictions separately — DO NOT add 'predicted' col to test_df
        # as it would leak into subsequent _build_feature_matrix calls.
        pred_series = pd.Series(preds, index=test_df.index)

        def metrics(actual: np.ndarray, predicted: np.ndarray) -> Dict[str, float]:
            mae  = float(np.mean(np.abs(actual - predicted)))
            rmse = float(np.sqrt(np.mean((actual - predicted) ** 2)))
            # MAPE: skip zero actuals
            mask = actual != 0
            mape = float(np.mean(np.abs((actual[mask] - predicted[mask]) / actual[mask])) * 100) if mask.any() else 0.0
            ss_res = np.sum((actual - predicted) ** 2)
            ss_tot = np.sum((actual - actual.mean()) ** 2)
            r2 = float(1 - ss_res / ss_tot) if ss_tot > 0 else 0.0
            return {
                "mae_rs_per_quintal":  round(mae, 2),
                "rmse_rs_per_quintal": round(rmse, 2),
                "mape_pct":            round(mape, 2),
                "r2":                  round(r2, 4),
            }

        overall = metrics(y_test.values, preds)

        target = self.cfg["training"]["target_column"]
        by_commodity = {}
        for commodity, grp in test_df.groupby("Commodity"):
            xg = grp[self.feature_names].fillna(0)
            yg = grp[target].values
            pg = self.model.predict(xg)
            by_commodity[commodity] = metrics(yg, pg)

        return {
            "overall": overall,
            "by_commodity": by_commodity,
            "test_date_range": {
                "start": str(test_df["date"].min().date()),
                "end":   str(test_df["date"].max().date()),
            },
        }

    # ------------------------------------------------------------------
    # Prediction
    # ------------------------------------------------------------------

    def predict(
        self,
        commodity: str,
        market: str,
        district: str,
        start_date: Optional[str] = None,
        horizon_days: int = 7,
        weather_forecast: Optional[List[Dict[str, Any]]] = None,
    ) -> PriceForecast:
        """
        Forecasts commodity price for `horizon_days` starting from `start_date`.

        Args:
            commodity     : 'Onion' or 'Tomato'
            market        : e.g. 'Kolhapur', 'Sangli'
            district      : 'Kolhapur' or 'Sangli'
            start_date    : ISO date string (defaults to tomorrow)
            horizon_days  : Number of days to forecast (1–14 recommended)
            weather_forecast: Optional list of daily dicts (from weather API/OpenMeteo).
                             Each dict may contain keys matching weather column names.
        """
        if not self.is_trained or self._train_df is None:
            raise RuntimeError("Model not trained. Call train() first.")

        if start_date is None:
            start_dt = datetime.today().date() + timedelta(days=1)
        else:
            start_dt = datetime.strptime(start_date[:10], "%Y-%m-%d").date()

        # Seed from historical data for this series
        hist = self._train_df[
            (self._train_df["Commodity"].str.lower() == commodity.lower()) &
            (self._train_df["Market"].str.lower()    == market.lower())
        ].sort_values("date").tail(30).copy()

        daily_forecasts: List[PricePrediction] = []

        for i in range(horizon_days):
            pred_date = start_dt + timedelta(days=i)

            # Build a single-row feature dict from lagged history
            row = self._build_prediction_row(
                hist, commodity, market, district, pred_date,
                weather_forecast[i] if weather_forecast and i < len(weather_forecast) else {}
            )
            X_row = pd.DataFrame([row])[self.feature_names].fillna(0)
            predicted_price = float(self.model.predict(X_row)[0])
            predicted_price = max(predicted_price, 0.0)

            # Derive min/max from recent spread ratio
            if len(hist) > 0:
                recent = hist.tail(7)
                avg_range = (recent["Max Price"] - recent["Min Price"]).mean()
                avg_min_ratio = (recent["Min Price"] / recent["Modal Price"].replace(0, np.nan)).mean()
                pred_min = round(predicted_price * float(avg_min_ratio or 0.7), 2)
                pred_max = round(predicted_price + avg_range * 0.5, 2)
            else:
                pred_min = round(predicted_price * 0.85, 2)
                pred_max = round(predicted_price * 1.15, 2)

            # Confidence band: ±10% (simple; expand with SHAP uncertainty later)
            band_low  = round(predicted_price * 0.90, 2)
            band_high = round(predicted_price * 1.10, 2)

            # Weather risk flag
            wf = weather_forecast[i] if weather_forecast and i < len(weather_forecast) else {}
            rain = float(wf.get("precipitation_sum", row.get("precipitation_sum", 0) or 0))
            wcode = int(wf.get("weather_code", row.get("weather_code", 0) or 0))
            heavy_rain = rain > 20.0 or wcode in WMO_RAIN_CODES
            risk_reason = f"Heavy rainfall ({rain:.1f}mm) may disrupt supply" if heavy_rain else ""

            forecast_entry = PricePrediction(
                date=str(pred_date),
                commodity=commodity,
                market=market,
                district=district,
                predicted_modal_price=round(predicted_price, 2),
                predicted_min_price=pred_min,
                predicted_max_price=pred_max,
                confidence_band_low=band_low,
                confidence_band_high=band_high,
                weather_risk_flag=heavy_rain,
                weather_risk_reason=risk_reason,
            )
            daily_forecasts.append(forecast_entry)

            # Feed prediction back as lag for next day
            new_row = {
                "date": pd.Timestamp(pred_date),
                "Commodity": commodity,
                "Market": market,
                "District": district,
                "Modal Price": predicted_price,
                "Min Price": pred_min,
                "Max Price": pred_max,
                "Arrival Quantity": hist["Arrival Quantity"].mean() if len(hist) > 0 else 0,
                **{k: float(wf.get(k, 0) or 0) for k in [
                    "temp_mean", "temp_max", "temp_min", "precipitation_sum",
                    "rain_sum", "precipitation_hours", "evapotranspiration",
                    "weather_code", "humidity_mean",
                    "soil_moisture_0_to_100cm", "soil_moisture_0_to_7cm",
                    "soil_moisture_7_to_28cm", "soil_moisture_28_to_100cm",
                ]},
            }
            hist = pd.concat([hist, pd.DataFrame([new_row])], ignore_index=True)

        prices = [f.predicted_modal_price for f in daily_forecasts]
        summary = {
            "forecast_min_price":  round(min(prices), 2),
            "forecast_max_price":  round(max(prices), 2),
            "forecast_avg_price":  round(sum(prices) / len(prices), 2),
            "price_trend":         "UP" if prices[-1] > prices[0] else "DOWN" if prices[-1] < prices[0] else "STABLE",
            "weather_risk_days":   sum(1 for f in daily_forecasts if f.weather_risk_flag),
        }

        return PriceForecast(
            commodity=commodity,
            market=market,
            district=district,
            forecast_start_date=str(start_dt),
            horizon_days=horizon_days,
            daily_forecasts=daily_forecasts,
            summary=summary,
        )

    def _build_prediction_row(
        self,
        hist: pd.DataFrame,
        commodity: str,
        market: str,
        district: str,
        pred_date: date,
        weather: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Assembles a feature row dict for a single prediction step."""
        ts = pd.Timestamp(pred_date)
        month     = ts.month
        dow       = ts.dayofweek
        woy       = ts.isocalendar()[1]

        crop_lower = commodity.lower()
        harvest_months = HARVEST_SEASONS.get(crop_lower, [])

        def lag_price(n: int) -> float:
            if len(hist) >= n:
                return float(hist["Modal Price"].iloc[-n])
            return float(hist["Modal Price"].mean()) if len(hist) > 0 else 0.0

        def roll_mean(col: str, w: int) -> float:
            if col not in hist.columns or len(hist) == 0:
                return 0.0
            return float(hist[col].tail(w).mean())

        def roll_std(col: str, w: int) -> float:
            if col not in hist.columns or len(hist) == 0:
                return 0.0
            return float(hist[col].tail(w).std(ddof=0))

        # Encode categoricals
        def encode(col: str, val: str) -> int:
            le = self.label_encoders.get(col)
            if le is None:
                return 0
            try:
                return int(le.transform([val])[0])
            except ValueError:
                return 0

        wcode = int(weather.get("weather_code", 0) or 0)

        row = {
            # Temporal
            "day_of_week":  dow,
            "month":        month,
            "week_of_year": woy,
            "day_of_year":  ts.dayofyear,
            "quarter":      ts.quarter,
            "month_sin":    np.sin(2 * np.pi * month / 12),
            "month_cos":    np.cos(2 * np.pi * month / 12),
            "dow_sin":      np.sin(2 * np.pi * dow   / 7),
            "dow_cos":      np.cos(2 * np.pi * dow   / 7),

            # Seasonal
            "is_harvest_season": 1 if month in harvest_months else 0,

            # Price lags
            "modal_price_lag1":  lag_price(1),
            "modal_price_lag7":  lag_price(7),
            "modal_price_lag14": lag_price(14),
            "min_price_lag1":    float(hist["Min Price"].iloc[-1]) if len(hist) > 0 else 0.0,
            "max_price_lag1":    float(hist["Max Price"].iloc[-1]) if len(hist) > 0 else 0.0,
            "min_price_lag7":    float(hist["Min Price"].iloc[-7]) if len(hist) >= 7 else 0.0,
            "max_price_lag7":    float(hist["Max Price"].iloc[-7]) if len(hist) >= 7 else 0.0,
            "min_price_lag14":   float(hist["Min Price"].iloc[-14]) if len(hist) >= 14 else 0.0,
            "max_price_lag14":   float(hist["Max Price"].iloc[-14]) if len(hist) >= 14 else 0.0,

            # Price rolling
            "modal_price_roll7":  roll_mean("Modal Price", 7),
            "modal_price_roll14": roll_mean("Modal Price", 14),
            "modal_price_std7":   roll_std("Modal Price", 7),
            "modal_price_std14":  roll_std("Modal Price", 14),

            # Price spread
            "price_range": lag_price(1) - float(hist["Min Price"].iloc[-1]) if len(hist) > 0 else 0.0,

            # Supply
            "Arrival Quantity": float(weather.get("arrival_quantity", roll_mean("Arrival Quantity", 7))),
            "arrival_lag1":     roll_mean("Arrival Quantity", 1),
            "arrival_roll7":    roll_mean("Arrival Quantity", 7),

            # Weather (current day from forecast)
            "temp_mean":               float(weather.get("temp_mean",           25.0) or 25.0),
            "temp_max":                float(weather.get("temp_max",            30.0) or 30.0),
            "temp_min":                float(weather.get("temp_min",            20.0) or 20.0),
            "precipitation_sum":       float(weather.get("precipitation_sum",   0.0)  or 0.0),
            "rain_sum":                float(weather.get("rain_sum",            0.0)  or 0.0),
            "precipitation_hours":     float(weather.get("precipitation_hours", 0.0)  or 0.0),
            "evapotranspiration":      float(weather.get("evapotranspiration",  4.0)  or 4.0),
            "humidity_mean":           float(weather.get("humidity_mean",       70.0) or 70.0),
            "soil_moisture_0_to_100cm":  float(weather.get("soil_moisture_0_to_100cm",  0.3) or 0.3),
            "soil_moisture_0_to_7cm":    float(weather.get("soil_moisture_0_to_7cm",    0.2) or 0.2),
            "soil_moisture_7_to_28cm":   float(weather.get("soil_moisture_7_to_28cm",   0.25) or 0.25),
            "soil_moisture_28_to_100cm": float(weather.get("soil_moisture_28_to_100cm", 0.3) or 0.3),
            "weather_code":            float(wcode),

            # Weather lags / rolling
            "temp_mean_lag3":           roll_mean("temp_mean", 3),
            "precipitation_sum_roll7":  roll_mean("precipitation_sum", 7),
            "humidity_mean_roll7":      roll_mean("humidity_mean", 7),
            "temp_mean_roll7":          roll_mean("temp_mean", 7),

            # Weather binary flags
            "heavy_rain_flag": 1 if float(weather.get("precipitation_sum", 0) or 0) > 20.0 else 0,
            "is_rainy_weather": 1 if wcode in WMO_RAIN_CODES else 0,

            # Categoricals (encoded)
            "Commodity_enc": encode("Commodity", commodity),
            "Market_enc":    encode("Market",    market),
            "District_enc":  encode("District",  district),
        }
        return row

    # ------------------------------------------------------------------
    # Feature importance
    # ------------------------------------------------------------------

    def get_feature_importance(self, top_n: int = 20) -> List[Dict[str, Any]]:
        """Returns top-N features by XGBoost importance score."""
        if not self.is_trained:
            raise RuntimeError("Model not trained.")
        scores = self.model.feature_importances_
        pairs = sorted(
            zip(self.feature_names, scores),
            key=lambda x: x[1], reverse=True
        )
        return [{"feature": f, "importance": round(float(s), 6)} for f, s in pairs[:top_n]]

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def save(self, model_path: Optional[str] = None) -> None:
        """Saves model, encoders, and feature names to disk."""
        model_path = model_path or self._abs_path(self.cfg["paths"]["model_output"])
        enc_path   = self._abs_path(self.cfg["paths"]["encoders_output"])
        feat_path  = self._abs_path(self.cfg["paths"]["feature_names_output"])

        os.makedirs(os.path.dirname(model_path), exist_ok=True)

        with open(model_path, "wb") as f:
            pickle.dump(self.model, f)
        with open(enc_path, "wb") as f:
            pickle.dump(self.label_encoders, f)
        with open(feat_path, "w", encoding="utf-8") as f:
            json.dump(self.feature_names, f, indent=2)

        print(f"[PriceModel] Saved model      -> {model_path}")
        print(f"[PriceModel] Saved encoders   -> {enc_path}")
        print(f"[PriceModel] Saved features   -> {feat_path}")

    @classmethod
    def load(cls, config_path: str = DEFAULT_CONFIG_PATH) -> "PriceModel":
        """Loads a persisted model from disk and rebuilds training data cache for predict()."""
        instance = cls(config_path=config_path)
        model_path = instance._abs_path(instance.cfg["paths"]["model_output"])
        enc_path   = instance._abs_path(instance.cfg["paths"]["encoders_output"])
        feat_path  = instance._abs_path(instance.cfg["paths"]["feature_names_output"])

        with open(model_path, "rb") as f:
            instance.model = pickle.load(f)
        with open(enc_path, "rb") as f:
            instance.label_encoders = pickle.load(f)
        with open(feat_path, "r", encoding="utf-8") as f:
            instance.feature_names = json.load(f)

        instance.is_trained = True
        print(f"[PriceModel] Loaded from {model_path}")

        # Rebuild _train_df so predict() and evaluate() have historical lag context
        print(f"[PriceModel] Rebuilding training data cache...")
        try:
            df = instance.load_and_prepare_data()
            test_days = instance.cfg["training"]["test_days"]
            df_clean = df.dropna(subset=["modal_price_lag14"]).reset_index(drop=True)
            instance._train_df = df_clean
            print(f"[PriceModel] Cache ready: {len(df_clean)} rows")
        except Exception as e:
            print(f"[PriceModel] [WARN] Could not rebuild data cache: {e}")
            print(f"[PriceModel] predict() will work with limited history.")

        return instance
