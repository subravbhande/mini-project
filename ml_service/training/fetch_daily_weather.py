"""
Distress-Sale Timing Advisor — Automated Daily Weather Fetcher
Fetches live daily weather and 5-day meteorological forecasts from OpenWeatherMap
using the mini project API key (71b1c519aa7a9dc576127852864819cd) for Kolhapur & Sangli.

Usage:
    python training/fetch_daily_weather.py
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
import requests

ML_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ML_ROOT not in sys.path:
    sys.path.insert(0, ML_ROOT)

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(ML_ROOT, ".env"))
except Exception:
    pass

logger = logging.getLogger("DailyWeatherFetcher")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", stream=sys.stderr)

CONFIG_PATH = os.path.join(ML_ROOT, "config", "weather_config.json")
DEFAULT_API_KEY = "71b1c519aa7a9dc576127852864819cd"


def load_config() -> Dict[str, Any]:
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Could not load {CONFIG_PATH}: {e}")
    return {
        "api_endpoint": "https://api.openweathermap.org/data/2.5",
        "default_api_key": DEFAULT_API_KEY,
        "units": "metric",
        "timeout_seconds": 15,
        "districts": {
            "Kolhapur": {"name": "Kolhapur", "query": "Kolhapur,IN", "lat": 16.7050, "lon": 74.2433},
            "Sangli": {"name": "Sangli", "query": "Sangli,IN", "lat": 16.8524, "lon": 74.5815},
        },
        "paths": {
            "weather_clean_csv": "data/processed/weather_history_clean.csv",
            "weather_cache_json": "data/raw/weather/live_weather_cache.json",
        },
    }


def get_api_key(custom_key: Optional[str] = None) -> str:
    return custom_key or os.getenv("OPENWEATHER_API_KEY") or DEFAULT_API_KEY


def fetch_current_weather(
    district: str,
    api_key: Optional[str] = None,
    timeout: int = 15,
) -> Optional[Dict[str, Any]]:
    """
    Fetch current conditions from OpenWeatherMap for a specific district.
    """
    key = get_api_key(api_key)
    config = load_config()
    dist_meta = config.get("districts", {}).get(district.capitalize(), {"query": f"{district},IN"})
    query = dist_meta.get("query", f"{district},IN")

    url = f"{config.get('api_endpoint', 'https://api.openweathermap.org/data/2.5')}/weather"
    params = {
        "q": query,
        "appid": key,
        "units": config.get("units", "metric"),
    }

    try:
        res = requests.get(url, params=params, timeout=timeout)
        if res.status_code == 200:
            data = res.json()
            main = data.get("main", {})
            rain = data.get("rain", {})
            weather = data.get("weather", [{}])[0]

            precip_sum = float(rain.get("1h", rain.get("3h", 0.0)) or 0.0)

            return {
                "District": district.capitalize(),
                "date": datetime.now().strftime("%Y-%m-%d"),
                "temperature_2m_mean": round(float(main.get("temp", 25.0)), 2),
                "temperature_2m_max": round(float(main.get("temp_max", 30.0)), 2),
                "temperature_2m_min": round(float(main.get("temp_min", 20.0)), 2),
                "precipitation_sum": precip_sum,
                "rain_sum": precip_sum,
                "precipitation_hours": 1.0 if precip_sum > 0 else 0.0,
                "et0_fao_evapotranspiration": 4.0,  # regional constant estimate
                "weather_code": int(weather.get("id", 800)),
                "soil_moisture_0_to_100cm_mean": 0.32,
                "soil_moisture_0_to_7cm_mean": 0.25,
                "soil_moisture_28_to_100cm_mean": 0.34,
                "soil_moisture_7_to_28cm_mean": 0.33,
                "relative_humidity_2m_mean": round(float(main.get("humidity", 60.0)), 2),
                "weather_description": str(weather.get("description", "Clear")),
            }
        else:
            logger.warning(f"OpenWeather current weather failed for {district}: HTTP {res.status_code}")
    except Exception as e:
        logger.warning(f"OpenWeather current weather error for {district}: {e}")
    return None


def fetch_5day_forecast(
    district: str,
    api_key: Optional[str] = None,
    timeout: int = 15,
) -> List[Dict[str, Any]]:
    """
    Fetch 5-day / 3-hour meteorological forecast from OpenWeatherMap,
    aggregate into clean daily forecasts compatible with PriceModel & DecayModel.
    """
    key = get_api_key(api_key)
    config = load_config()
    dist_meta = config.get("districts", {}).get(district.capitalize(), {"query": f"{district},IN"})
    query = dist_meta.get("query", f"{district},IN")

    url = f"{config.get('api_endpoint', 'https://api.openweathermap.org/data/2.5')}/forecast"
    params = {
        "q": query,
        "appid": key,
        "units": config.get("units", "metric"),
    }

    daily_buckets = defaultdict(list)
    try:
        res = requests.get(url, params=params, timeout=timeout)
        if res.status_code == 200:
            data = res.json()
            items = data.get("list", [])
            for item in items:
                dt_txt = item.get("dt_txt", "")
                if dt_txt:
                    day_str = dt_txt.split(" ")[0]
                    daily_buckets[day_str].append(item)
        else:
            logger.warning(f"OpenWeather 5-day forecast failed for {district}: HTTP {res.status_code}")
    except Exception as e:
        logger.warning(f"OpenWeather 5-day forecast error for {district}: {e}")

    forecast_list: List[Dict[str, Any]] = []
    for day_str in sorted(daily_buckets.keys())[:5]:
        entries = daily_buckets[day_str]
        temps = [e["main"]["temp"] for e in entries if "main" in e and "temp" in e["main"]]
        humidities = [e["main"]["humidity"] for e in entries if "main" in e and "humidity" in e["main"]]
        rains = [e.get("rain", {}).get("3h", 0.0) for e in entries]

        max_temp = round(max(temps), 1) if temps else 31.0
        min_temp = round(min(temps), 1) if temps else 20.0
        avg_temp = round(sum(temps) / len(temps), 1) if temps else 25.5
        avg_hum = round(sum(humidities) / len(humidities), 1) if humidities else 65.0
        tot_rain = round(sum(rains), 1) if rains else 0.0

        # Rain risk flag: > 15mm/day or heavy thunderstorm
        weather_risk_flag = tot_rain >= 15.0 or any(e.get("weather", [{}])[0].get("id", 800) in (200, 201, 202, 502, 503, 504) for e in entries)
        risk_reason = "Adverse heavy rain / storm predicted" if weather_risk_flag else "No adverse weather risk"

        forecast_list.append({
            "date": day_str,
            "district": district.capitalize(),
            "temp_max_c": max_temp,
            "temp_min_c": min_temp,
            "temp_c": avg_temp,
            "humidity_pct": avg_hum,
            "precipitation_mm": tot_rain,
            "weather_risk_flag": weather_risk_flag,
            "weather_risk_reason": risk_reason,
            "weather_assumed": False,
        })

    return forecast_list


def append_weather_records(csv_path: str, records: List[Dict[str, Any]]) -> int:
    """Append new weather records to weather_history_clean.csv with deduplication."""
    if not records:
        return 0

    new_df = pd.DataFrame(records)
    # Ensure all canonical columns exist
    canonical_cols = [
        "date", "temperature_2m_mean", "temperature_2m_max", "temperature_2m_min",
        "precipitation_sum", "rain_sum", "precipitation_hours",
        "et0_fao_evapotranspiration", "weather_code", "soil_moisture_0_to_100cm_mean",
        "soil_moisture_0_to_7cm_mean", "soil_moisture_28_to_100cm_mean",
        "soil_moisture_7_to_28cm_mean", "relative_humidity_2m_mean", "District",
    ]

    for col in canonical_cols:
        if col not in new_df.columns:
            new_df[col] = None
    new_df = new_df[canonical_cols]

    if os.path.exists(csv_path):
        existing_df = pd.read_csv(csv_path)
        combined = pd.concat([existing_df, new_df], ignore_index=True)
    else:
        combined = new_df

    combined["date"] = pd.to_datetime(combined["date"]).dt.strftime("%Y-%m-%d")
    initial_len = len(combined)
    combined = combined.drop_duplicates(subset=["District", "date"], keep="last")
    combined = combined.sort_values(["District", "date"]).reset_index(drop=True)

    os.makedirs(os.path.dirname(csv_path), exist_ok=True)
    combined.to_csv(csv_path, index=False, encoding="utf-8-sig")

    added = len(combined) - (len(existing_df) if os.path.exists(csv_path) else 0)
    logger.info(f"Updated {csv_path}: {len(combined)} rows ({max(0, added)} net new rows)")
    return max(0, added)


def update_mongo_weather(
    current_records: List[Dict[str, Any]],
    forecast_records: List[Dict[str, Any]],
) -> None:
    """Upsert weather records into MongoDB Atlas weather_cache."""
    mongo_uri = os.getenv("MONGO_URI")
    if not mongo_uri:
        return

    try:
        from pymongo import MongoClient
        client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
        client.admin.command("ping")
        try:
            db = client.get_default_database()
            if db is None:
                db = client[os.getenv("MONGO_DB_NAME", "agrisense")]
        except Exception:
            db = client[os.getenv("MONGO_DB_NAME", "agrisense")]
        coll = db["weather_cache"]

        # 1. Upsert historical / current records
        for r in current_records:
            doc_date = datetime.strptime(r["date"], "%Y-%m-%d")
            query = {"district": r["District"], "date": doc_date}
            update = {
                "$set": {
                    "temp_mean": float(r["temperature_2m_mean"]),
                    "temp_max": float(r["temperature_2m_max"]),
                    "temp_min": float(r["temperature_2m_min"]),
                    "humidity_mean": float(r["relative_humidity_2m_mean"]),
                    "precipitation_sum": float(r["precipitation_sum"]),
                    "rain_sum": float(r["rain_sum"]),
                    "precipitation_hours": float(r["precipitation_hours"]),
                    "et0": float(r["et0_fao_evapotranspiration"]),
                    "weather_code": int(r["weather_code"]),
                    "soil_moisture_0_7cm": float(r["soil_moisture_0_to_7cm_mean"]),
                    "soil_moisture_7_28cm": float(r["soil_moisture_7_to_28cm_mean"]),
                    "soil_moisture_28_100cm": float(r["soil_moisture_28_to_100cm_mean"]),
                    "soil_moisture_0_100cm": float(r["soil_moisture_0_to_100cm_mean"]),
                    "is_forecast": False,
                    "updated_at": datetime.now(),
                }
            }
            coll.update_one(query, update, upsert=True)

        # 2. Upsert forecast records
        for f in forecast_records:
            f_date = datetime.strptime(f["date"], "%Y-%m-%d")
            query = {"district": f["district"], "date": f_date, "is_forecast": True}
            update = {
                "$set": {
                    "temp_mean": float(f["temp_c"]),
                    "temp_max": float(f["temp_max_c"]),
                    "temp_min": float(f["temp_min_c"]),
                    "humidity_mean": float(f["humidity_pct"]),
                    "precipitation_sum": float(f["precipitation_mm"]),
                    "rain_sum": float(f["precipitation_mm"]),
                    "weather_risk_flag": bool(f["weather_risk_flag"]),
                    "weather_risk_reason": str(f["weather_risk_reason"]),
                    "is_forecast": True,
                    "updated_at": datetime.now(),
                }
            }
            coll.update_one(query, update, upsert=True)

        logger.info(f"Successfully synced weather to MongoDB Atlas weather_cache.")
    except Exception as e:
        logger.debug(f"MongoDB weather sync notice ({e}); non-fatal.")


def sync_daily_weather(api_key: Optional[str] = None) -> Dict[str, Any]:
    """
    Main entry point for daily weather sync:
      1. Pulls current conditions for Kolhapur & Sangli via OpenWeatherMap
      2. Pulls 5-day forecasts for Kolhapur & Sangli
      3. Appends clean observations to CSV
      4. Saves cache JSON and updates Mongo Atlas
    """
    config = load_config()
    final_key = get_api_key(api_key)
    csv_path = os.path.join(ML_ROOT, config["paths"]["weather_clean_csv"])
    cache_json_path = os.path.join(ML_ROOT, config["paths"].get("weather_cache_json", "data/raw/weather/live_weather_cache.json"))

    current_records: List[Dict[str, Any]] = []
    all_forecasts: List[Dict[str, Any]] = []

    for dist in ["Kolhapur", "Sangli"]:
        curr = fetch_current_weather(dist, api_key=final_key)
        if curr:
            current_records.append(curr)

        fc = fetch_5day_forecast(dist, api_key=final_key)
        if fc:
            all_forecasts.extend(fc)

    # Ingest clean records
    added = append_weather_records(csv_path, current_records)

    # Save live forecast cache JSON
    try:
        os.makedirs(os.path.dirname(cache_json_path), exist_ok=True)
        with open(cache_json_path, "w", encoding="utf-8") as f:
            json.dump({
                "synced_at": datetime.now().isoformat(),
                "districts": ["Kolhapur", "Sangli"],
                "forecasts": all_forecasts,
                "current": current_records,
            }, f, indent=2)
    except Exception as e:
        logger.warning(f"Failed to write weather cache json: {e}")

    # Upsert to MongoDB Atlas
    update_mongo_weather(current_records, all_forecasts)

    meta = {
        "refreshed_at": datetime.now().isoformat(),
        "api_key_used": f"{final_key[:6]}...{final_key[-4:]}",
        "records_added": added,
        "current_weather": current_records,
        "forecast_days": len(all_forecasts) // 2 if all_forecasts else 0,
        "status": "up_to_date",
    }
    logger.info(f"Weather sync complete: {meta['status']} (added {added} rows)")
    return meta


def main():
    parser = argparse.ArgumentParser(description="Fetch daily weather and 5-day forecasts from OpenWeatherMap")
    parser.add_argument("--key", help="OpenWeatherMap API Key", default=None)
    args = parser.parse_args()

    res = sync_daily_weather(api_key=args.key)
    print("\n" + "=" * 50)
    print("DAILY WEATHER SYNC RESULT")
    print("=" * 50)
    print(json.dumps(res, indent=2))


if __name__ == "__main__":
    main()
