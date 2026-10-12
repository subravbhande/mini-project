"""
Distress-Sale Timing Advisor — Automated Data Refresh Pipeline
Runs end-to-end data processing in one command:
  1. Clean Agmarknet price CSVs (clean_price_data.py)
  2. Clean Open-Meteo weather exports (clean_weather_data.py)
  3. Recompute coverage statistics (coverage_report.py)
  4. Filter sparse/gappy series (filter_series.py)
  5. Seed / update MongoDB collections (seed_mongo.py)
  6. Persist models/saved/data_as_of.json metadata

Usage:
    python training/refresh_data.py
"""

from __future__ import annotations

import json
import logging
import os
import subprocess
import sys
from datetime import datetime

import pandas as pd

logger = logging.getLogger("refresh_data")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", stream=sys.stderr)

ML_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_AS_OF_PATH = os.path.join(ML_ROOT, "models", "saved", "data_as_of.json")
FILTERED_PRICE_CSV = os.path.join(ML_ROOT, "data", "processed", "price_history_filtered.csv")


def run_py(script_name: str) -> None:
    path = os.path.join(ML_ROOT, "training", script_name)
    if not os.path.exists(path):
        logger.warning(f"Script {path} not found; skipping.")
        return
    logger.info(f"Executing {script_name}...")
    res = subprocess.run([sys.executable, path], cwd=ML_ROOT, capture_output=True, text=True)
    if res.returncode != 0:
        logger.error(f"Error executing {script_name}: {res.stderr}")
    else:
        logger.info(f"Finished {script_name}.")


def main():
    logger.info("Starting automated data refresh...")

    # Phase 1 chain
    run_py("clean_price_data.py")
    run_py("clean_weather_data.py")
    run_py("coverage_report.py")
    run_py("filter_series.py")
    run_py("seed_mongo.py")

    # Update data_as_of metadata
    if os.path.exists(FILTERED_PRICE_CSV):
        df = pd.read_csv(FILTERED_PRICE_CSV, parse_dates=["Arrival Date"])
        latest_date = df["Arrival Date"].max()
        meta = {
            "refreshed_at": datetime.now().isoformat(),
            "latest_price_date": str(latest_date.date()),
            "total_records": len(df),
            "status": "up_to_date",
        }
        os.makedirs(os.path.dirname(DATA_AS_OF_PATH), exist_ok=True)
        with open(DATA_AS_OF_PATH, "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=2)
        logger.info(f"Wrote data_as_of metadata: {meta}")

    print("Data refresh completed successfully.")


if __name__ == "__main__":
    main()
