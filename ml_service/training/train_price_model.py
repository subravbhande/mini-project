"""
Distress-Sale Timing Advisor — Price Model Training Pipeline
Trains direct multi-step XGBoost models for horizons 1..5 using leak-free relative targets.
Executes the rolling-origin backtest and produces production artifacts:
  - models/saved/supported_series.json
  - models/saved/feature_names.json
  - models/saved/price_h1.json ... price_h5.json
  - models/saved/residual_quantiles.json
  - models/saved/backtest_report.json
"""

from __future__ import annotations

import json
import logging
import os
import sys
from datetime import datetime
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd
from xgboost import XGBRegressor

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.data_access import load_prices, load_weather
from models.features import build_features, get_feature_names
from training.backtest_price import (
    CROP_MAP,
    MARKET_MAP,
    build_training_matrix_for_horizon,
    encode_features,
    run_rolling_origin_backtest,
)

logger = logging.getLogger("train_price_model")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", stream=sys.stderr)

ML_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAVED_DIR = os.path.join(ML_ROOT, "models", "saved")
CONFIG_PATH = os.path.join(ML_ROOT, "config", "price_model_config.json")


def update_supported_series(prices: pd.DataFrame) -> List[Dict]:
    """Generate and persist canonical supported_series.json."""
    os.makedirs(SAVED_DIR, exist_ok=True)
    groups = prices.groupby(["Commodity", "Market", "District"])
    series_list = []
    for (crop, market, district), g in groups:
        series_list.append({
            "crop": crop.lower(),
            "crop_display": crop,
            "market": market,
            "district": district,
            "rows": int(len(g)),
            "first_date": str(g["date"].min().date()),
            "last_date": str(g["date"].max().date()),
        })

    out_path = os.path.join(SAVED_DIR, "supported_series.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(series_list, f, indent=2)

    logger.info(f"Saved {len(series_list)} supported series to {out_path}")
    return series_list


def train_production_models() -> Dict[int, XGBRegressor]:
    """Train direct horizon XGBoost models on full filtered dataset."""
    prices = load_prices()
    weather = load_weather()

    supported_series = update_supported_series(prices)

    # Save feature names
    feature_names = get_feature_names()
    feat_names_path = os.path.join(SAVED_DIR, "feature_names.json")
    with open(feat_names_path, "w", encoding="utf-8") as f:
        json.dump(feature_names, f, indent=2)

    # Cutoff date = end of dataset (train on all available clean historical data)
    max_date = prices["date"].max()
    horizons = [1, 2, 3, 4, 5]
    trained_models = {}

    for h in horizons:
        logger.info(f"Building training matrix for horizon h={h} days...")
        X, y = build_training_matrix_for_horizon(
            history=prices,
            supported_series=supported_series,
            horizon=h,
            cutoff_date=max_date,
            weather_df=weather,
        )

        logger.info(f"Horizon h={h}: {len(X)} training samples. Fitting XGBoost...")
        model = XGBRegressor(
            n_estimators=150,
            max_depth=3,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            min_child_weight=5,
            random_state=42,
            n_jobs=-1,
        )
        model.fit(X, y)
        trained_models[h] = model

        # Native save (JSON format)
        model_path = os.path.join(SAVED_DIR, f"price_h{h}.json")
        model.save_model(model_path)
        logger.info(f"Saved native model to {model_path}")

    return trained_models


def main():
    print("=" * 75)
    print("  STEP 1: Training Direct Horizon Models (h=1..5)")
    print("=" * 75)
    train_production_models()

    print("\n" + "=" * 75)
    print("  STEP 2: Executing Rolling-Origin Backtest & Baseline Comparison")
    print("=" * 75)
    run_rolling_origin_backtest()
    print("\nProduction training & backtest finished successfully.")


if __name__ == "__main__":
    main()
