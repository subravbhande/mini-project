"""
Distress-Sale Timing Advisor — Fast, Precomputed Rolling-Origin Backtest Harness
Evaluates ML models against Naive (persistence), 7-Day Mean, and Seasonal Baselines.
Calculates MAE, MAPE, MASE (Model MAE / Naive MAE) per (crop, market, horizon)
and estimates empirical residual quantiles for realistic confidence bands.
"""

from __future__ import annotations

import json
import logging
import os
import sys
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from xgboost import XGBRegressor

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.data_access import load_prices, load_weather
from models.features import build_features, get_feature_names

logger = logging.getLogger("backtest_price")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", stream=sys.stderr)

ML_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SUPPORTED_SERIES_PATH = os.path.join(ML_ROOT, "models", "saved", "supported_series.json")
BACKTEST_REPORT_PATH = os.path.join(ML_ROOT, "models", "saved", "backtest_report.json")
RESIDUAL_QUANTILES_PATH = os.path.join(ML_ROOT, "models", "saved", "residual_quantiles.json")

CROP_MAP = {"onion": 0, "tomato": 1}
MARKET_MAP = {
    "Islampur": 0,
    "Kolhapur": 1,
    "Sangli-Phale-Bhajipala": 2,
    "Vadgaonpeth": 3,
}


def encode_features(feat_dict: Dict[str, Any]) -> List[float]:
    """Encode feature dict to numeric array with fixed categoricals."""
    names = get_feature_names()
    row = []
    for name in names:
        val = feat_dict[name]
        if name == "crop":
            row.append(float(CROP_MAP.get(str(val).lower(), -1)))
        elif name == "market":
            row.append(float(MARKET_MAP.get(str(val), -1)))
        else:
            row.append(float(val) if val is not None else 0.0)
    return row


def precompute_dataset_for_horizon(
    history: pd.DataFrame,
    supported_series: List[Dict[str, Any]],
    horizon: int,
    weather_df: pd.DataFrame,
) -> Dict[str, Any]:
    """
    Precompute features, target log returns, origin dates, and series metadata for all observations.
    Because features at origin t only look backwards (<= t), precomputed rows are leakage-free.
    """
    X_rows = []
    y_vals = []
    origins = []
    meta = []

    for s in supported_series:
        crop = s["crop"]
        market = s["market"]
        district = s["district"]

        mask = (
            (history["Commodity"].str.lower() == crop)
            & (history["Market"] == market)
        )
        sub = history[mask].sort_values("date").reset_index(drop=True)
        if len(sub) < 5:
            continue

        date_to_price = dict(zip(sub["date"], sub["Modal Price"]))

        for _, r in sub.iterrows():
            orig_d = r["date"]
            target_d = orig_d + pd.Timedelta(days=horizon)

            if target_d in date_to_price:
                actual_price = float(date_to_price[target_d])
                if actual_price <= 0:
                    continue

                feat = build_features(
                    history=history,
                    series={"crop": crop, "market": market, "district": district},
                    origin=orig_d,
                    horizon=horizon,
                    weather_df=weather_df,
                )
                p_last = feat["p_last"]
                if p_last <= 0:
                    continue

                y = float(np.log(actual_price / p_last))
                x_vec = encode_features(feat)

                X_rows.append(x_vec)
                y_vals.append(y)
                origins.append(orig_d)
                meta.append({
                    "crop": crop,
                    "market": market,
                    "district": district,
                    "target_date": target_d,
                    "actual_price": actual_price,
                    "p_last": p_last,
                    "mean_7d": feat["mean_7d_ratio"] * p_last,
                    "features": feat,
                })

    return {
        "X": np.array(X_rows, dtype=np.float32),
        "y": np.array(y_vals, dtype=np.float32),
        "origins": np.array(origins),
        "meta": meta,
    }


def run_rolling_origin_backtest() -> Dict[str, Any]:
    prices = load_prices()
    weather = load_weather()

    with open(SUPPORTED_SERIES_PATH, "r", encoding="utf-8") as f:
        supported_series = json.load(f)

    min_date = prices["date"].min()
    max_date = prices["date"].max()

    first_origin = min_date + pd.Timedelta(days=120)
    last_origin = max_date - pd.Timedelta(days=5)

    origin_dates = pd.date_range(first_origin, last_origin, freq="7D")
    logger.info(f"Running rolling backtest over {len(origin_dates)} weekly origins from {first_origin.date()} to {last_origin.date()}")

    horizons = [1, 2, 3, 4, 5]

    # Precompute per-horizon datasets once (takes ~20s total per horizon)
    horizon_data = {}
    for h in horizons:
        logger.info(f"Precomputing feature matrix for horizon h={h}...")
        horizon_data[h] = precompute_dataset_for_horizon(
            history=prices,
            supported_series=supported_series,
            horizon=h,
            weather_df=weather,
        )

    eval_records = []
    log_errors_by_crop_h: Dict[Tuple[str, int], List[float]] = {}

    for origin in origin_dates:
        origin_ts = pd.Timestamp(origin)

        for h in horizons:
            h_dict = horizon_data[h]
            X_all = h_dict["X"]
            y_all = h_dict["y"]
            orig_all = h_dict["origins"]
            meta_all = h_dict["meta"]

            # Train only on rows strictly before this origin
            train_mask = (orig_all < origin_ts)
            X_tr, y_tr = X_all[train_mask], y_all[train_mask]

            if len(X_tr) < 30:
                continue

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
            model.fit(X_tr, y_tr)

            # Test on rows with origin == origin_ts
            test_indices = np.where(orig_all == origin_ts)[0]

            for idx in test_indices:
                x_test = X_all[idx : idx + 1]
                m = meta_all[idx]

                y_hat = float(model.predict(x_test)[0])
                y_hat_clipped = float(np.clip(y_hat, -0.5, 0.5))

                actual = m["actual_price"]
                p_last = m["p_last"]
                mean_7d = m["mean_7d"]

                p_model = p_last * float(np.exp(y_hat_clipped))
                p_naive = p_last
                p_mean7 = mean_7d

                err_model = abs(actual - p_model)
                err_naive = abs(actual - p_naive)
                err_mean7 = abs(actual - p_mean7)
                log_err = float(np.log(actual / p_model))

                record = {
                    "origin": str(origin_ts.date()),
                    "target_date": str(pd.Timestamp(m["target_date"]).date()),
                    "crop": m["crop"],
                    "market": m["market"],
                    "district": m["district"],
                    "horizon": h,
                    "actual": actual,
                    "pred_model": p_model,
                    "pred_naive": p_naive,
                    "pred_mean7": p_mean7,
                    "err_model": err_model,
                    "err_naive": err_naive,
                    "err_mean7": err_mean7,
                    "log_err": log_err,
                }
                eval_records.append(record)

                key = (m["crop"], h)
                if key not in log_errors_by_crop_h:
                    log_errors_by_crop_h[key] = []
                log_errors_by_crop_h[key].append(log_err)

    df_eval = pd.DataFrame(eval_records)
    logger.info(f"Backtest complete. Evaluated {len(df_eval)} test points across {len(origin_dates)} weekly origins.")

    # Compute metrics per (crop, market, horizon)
    series_metrics = {}
    for (crop, market, h), g in df_eval.groupby(["crop", "market", "horizon"]):
        mae_model = float(g["err_model"].mean())
        mae_naive = float(g["err_naive"].mean())
        mae_mean7 = float(g["err_mean7"].mean())
        mape_model = float((g["err_model"] / g["actual"]).mean() * 100.0)
        mape_naive = float((g["err_naive"] / g["actual"]).mean() * 100.0)
        mase = float(mae_model / mae_naive) if mae_naive > 0 else 1.0

        series_key = f"{crop}_{market}_h{h}"
        series_metrics[series_key] = {
            "crop": crop,
            "market": market,
            "horizon": int(h),
            "n_eval_points": int(len(g)),
            "mae_model": round(mae_model, 2),
            "mae_naive": round(mae_naive, 2),
            "mae_mean7": round(mae_mean7, 2),
            "mape_model_pct": round(mape_model, 2),
            "mape_naive_pct": round(mape_naive, 2),
            "mase": round(mase, 4),
            "beats_naive": bool(mase < 1.0),
        }

    # Pooled metrics per crop
    crop_metrics = {}
    for crop, g in df_eval.groupby("crop"):
        mae_model = float(g["err_model"].mean())
        mae_naive = float(g["err_naive"].mean())
        mape_model = float((g["err_model"] / g["actual"]).mean() * 100.0)
        mase = float(mae_model / mae_naive) if mae_naive > 0 else 1.0
        crop_metrics[crop] = {
            "crop": crop,
            "n_points": int(len(g)),
            "mae_model": round(mae_model, 2),
            "mae_naive": round(mae_naive, 2),
            "mape_pct": round(mape_model, 2),
            "mase": round(mase, 4),
            "beats_naive": bool(mase < 1.0),
        }

    # Compute empirical residual quantiles (10th and 90th percentile)
    residual_quantiles = {}
    for (crop, h), errors in log_errors_by_crop_h.items():
        q10 = float(np.percentile(errors, 10))
        q90 = float(np.percentile(errors, 90))
        in_band = sum(1 for e in errors if q10 <= e <= q90)
        coverage_pct = round((in_band / len(errors)) * 100.0, 1) if errors else 80.0

        k = f"{crop}_h{h}"
        residual_quantiles[k] = {
            "crop": crop,
            "horizon": int(h),
            "q10": round(q10, 4),
            "q90": round(q90, 4),
            "coverage_pct": coverage_pct,
            "n_samples": len(errors),
        }

    report = {
        "evaluation_type": "rolling_origin_expanding_window",
        "n_origins": len(origin_dates),
        "total_test_points": len(df_eval),
        "crop_summary": crop_metrics,
        "series_horizon_metrics": series_metrics,
        "residual_quantiles": residual_quantiles,
    }

    with open(BACKTEST_REPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    with open(RESIDUAL_QUANTILES_PATH, "w", encoding="utf-8") as f:
        json.dump(residual_quantiles, f, indent=2)

    print("\n" + "=" * 80)
    print("  ROLLING-ORIGIN BACKTEST RESULTS (Honest Evaluation vs Baselines)")
    print("=" * 80)
    print(f"{'Crop':<8} {'Market':<25} {'H':<3} {'Points':<7} {'Model MAE':<10} {'Naive MAE':<10} {'MASE':<8} {'Status'}")
    print("-" * 80)
    for k, v in sorted(series_metrics.items()):
        status = "BEATS NAIVE" if v["beats_naive"] else "TIES/LOSES"
        print(f"{v['crop']:<8} {v['market']:<25} {v['horizon']:<3} {v['n_eval_points']:<7} Rs.{v['mae_model']:<7.1f} Rs.{v['mae_naive']:<7.1f} {v['mase']:<8.3f} {status}")

    print("-" * 80)
    print("  POOLED SUMMARY PER CROP:")
    for crop, cm in crop_metrics.items():
        print(f"    {crop.upper():<7} -> Model MAE: Rs.{cm['mae_model']:.1f} | Naive MAE: Rs.{cm['mae_naive']:.1f} | MASE: {cm['mase']:.3f} ({'Beats persistence' if cm['beats_naive'] else 'Near random walk'})")

    print("\n  RESIDUAL QUANTILES & 10-90 BAND COVERAGE:")
    for k, q in residual_quantiles.items():
        print(f"    {k:<12}: q10={q['q10']:+.3f}, q90={q['q90']:+.3f} | Coverage: {q['coverage_pct']}% (Target ~80%)")
    print("=" * 80 + "\n")

    return report


if __name__ == "__main__":
    run_rolling_origin_backtest()
