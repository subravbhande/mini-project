"""
Phase 1 — MongoDB seed
Loads price_history_filtered.csv and weather_history_clean.csv into
MongoDB, closing out Phase 1.

Collections:
  price_history  { district, market, crop, variety, grade, date,
                    min_price, max_price, modal_price, arrival_qty, source_file }
  weather_cache   { district, date, temp_mean, temp_max, temp_min,
                     humidity_mean, precipitation_sum, rain_sum,
                     precipitation_hours, et0, weather_code,
                     soil_moisture_0_7cm, soil_moisture_7_28cm,
                     soil_moisture_28_100cm, soil_moisture_0_100cm,
                     is_forecast }

NOTE: weather_cache is keyed by DISTRICT, not market — the decay model
uses the farmer's storage district, not the sell-side market, per the
earlier correction to the schema.

Run from ml_service/ root, venv active:
    python training\\seed_mongo.py
"""

import os
import pandas as pd
from pymongo import MongoClient, ASCENDING
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = "distress_sale_advisor"

PRICE_FILE = "data/processed/price_history_filtered.csv"
WEATHER_FILE = "data/processed/weather_history_clean.csv"


def to_float(val):
    """Defensive numeric parse — strips stray commas if any slipped through upstream."""
    if pd.isna(val):
        return None
    return float(str(val).replace(",", ""))


def seed_price_history(db):
    df = pd.read_csv(PRICE_FILE, parse_dates=["Arrival Date"])

    docs = []
    for _, r in df.iterrows():
        docs.append({
            "district": r["District"],
            "market": r["Market"],
            "crop": r["Commodity"],
            "variety": r.get("Variety"),
            "grade": r.get("Grade"),
            "date": r["Arrival Date"].to_pydatetime(),
            "min_price": to_float(r["Min Price"]),
            "max_price": to_float(r["Max Price"]),
            "modal_price": to_float(r["Modal Price"]),
            "arrival_qty": to_float(r["Arrival Quantity"]),
            "source_file": r.get("source_file"),
        })

    coll = db["price_history"]
    coll.delete_many({})  # clean slate — avoids duplicate seeds on re-run
    if docs:
        coll.insert_many(docs)
    coll.create_index([("district", ASCENDING), ("market", ASCENDING), ("crop", ASCENDING), ("date", ASCENDING)])

    print(f"price_history: inserted {len(docs)} docs")
    return len(docs)


def seed_weather_cache(db):
    df = pd.read_csv(WEATHER_FILE, parse_dates=["date"])

    docs = []
    for _, r in df.iterrows():
        docs.append({
            "district": r["District"],
            "date": r["date"].to_pydatetime(),
            "temp_mean": float(r["temperature_2m_mean"]),
            "temp_max": float(r["temperature_2m_max"]),
            "temp_min": float(r["temperature_2m_min"]),
            "humidity_mean": float(r["relative_humidity_2m_mean"]) if pd.notna(r["relative_humidity_2m_mean"]) else None,
            "precipitation_sum": float(r["precipitation_sum"]),
            "rain_sum": float(r["rain_sum"]),
            "precipitation_hours": float(r["precipitation_hours"]),
            "et0": float(r["et0_fao_evapotranspiration"]),
            "weather_code": int(r["weather_code"]) if pd.notna(r["weather_code"]) else None,
            "soil_moisture_0_7cm": float(r["soil_moisture_0_to_7cm_mean"]),
            "soil_moisture_7_28cm": float(r["soil_moisture_7_to_28cm_mean"]),
            "soil_moisture_28_100cm": float(r["soil_moisture_28_to_100cm_mean"]),
            "soil_moisture_0_100cm": float(r["soil_moisture_0_to_100cm_mean"]),
            "is_forecast": False,
        })

    coll = db["weather_cache"]
    coll.delete_many({})
    if docs:
        coll.insert_many(docs)
    coll.create_index([("district", ASCENDING), ("date", ASCENDING)])

    print(f"weather_cache: inserted {len(docs)} docs")
    return len(docs)


def main():
    if not MONGO_URI:
        print("MONGO_URI not found — check ml_service/.env")
        return

    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]

    print("=" * 60)
    print(f"Seeding database: {DB_NAME}")
    print("=" * 60)

    price_count = seed_price_history(db)
    weather_count = seed_weather_cache(db)

    print("\nVerification (reading back from Mongo):")
    print(f"  price_history count:  {db['price_history'].count_documents({})}")
    print(f"  weather_cache count:  {db['weather_cache'].count_documents({})}")

    client.close()
    print("\nDone.")


if __name__ == "__main__":
    main()
