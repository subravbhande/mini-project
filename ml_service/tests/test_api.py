"""
End-to-End API Tests for FastAPI Service (app/main.py)
Tests:
- GET /health
- GET /series
- POST /price/forecast (valid 200 vs unsupported 422)
- POST /decay/simulate
- POST /decide
"""

import os
import sys
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_health_check(client):
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"


def test_get_series(client):
    res = client.get("/series")
    assert res.status_code == 200
    data = res.json()
    assert data["count"] == 6
    assert len(data["supported_series"]) == 6


def test_price_forecast_valid(client):
    payload = {
        "commodity": "tomato",
        "market": "Kolhapur",
        "horizon_days": 5,
    }
    res = client.post("/price/forecast", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["commodity"] == "Tomato"
    assert data["market"] == "Kolhapur"
    assert len(data["daily_forecasts"]) == 5
    assert "data_as_of" in data
    assert "days_stale" in data


def test_price_forecast_unsupported_returns_422(client):
    # Pune is not in training
    payload = {
        "commodity": "onion",
        "market": "Pune",
        "horizon_days": 3,
    }
    res = client.post("/price/forecast", json=payload)
    assert res.status_code == 422
    err_data = res.json()["detail"]
    assert "valid" in err_data
    assert len(err_data["valid"]) == 6


def test_decay_simulate_valid(client):
    payload = {
        "crop": "tomato",
        "initial_quantity_quintals": 50.0,
        "storage_type": "zecc",
        "district": "Kolhapur",
        "horizon_days": 7,
    }
    res = client.post("/decay/simulate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["crop"] == "Tomato"
    assert len(data["daily_schedule"]) >= 1


def test_decide_endpoint(client):
    payload = {
        "commodity": "tomato",
        "market": "Vadgaonpeth",
        "initial_quantity_quintals": 100.0,
        "storage_type": "ambient",
        "liquidity_need": "normal",
    }
    res = client.post("/decide", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["decision"] in ["SELL", "HOLD", "PARTIAL_SELL"]
    assert "act_by_date" in data
    assert "uplift_pct" in data
    assert "economic_decision" in data
    # Staleness metadata is properly populated
    assert "days_stale" in data
    assert isinstance(data["days_stale"], int) and data["days_stale"] >= 0
    assert "stale" in data
    assert isinstance(data["stale"], bool)
    # Break even price fields are populated
    assert "break_even_price_best_day" in data


def test_decide_staleness_when_as_of_future(client):
    # Staleness is correctly flagged when evaluation date is beyond latest data
    payload = {
        "commodity": "tomato",
        "market": "Vadgaonpeth",
        "initial_quantity_quintals": 100.0,
        "storage_type": "ambient",
        "liquidity_need": "normal",
        "as_of": "2026-11-20",
    }
    res = client.post("/decide", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["days_stale"] > 0
    assert data["stale"] is True


def test_decide_act_by_date_not_in_past(client):
    # Bug 1 fix: with as_of set to a modern date (2026-10-15), act_by_date must not revert to 2026-09-24
    payload = {
        "commodity": "tomato",
        "market": "Vadgaonpeth",
        "initial_quantity_quintals": 100.0,
        "storage_type": "ambient",
        "liquidity_need": "normal",
        "as_of": "2026-10-15",
    }
    res = client.post("/decide", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["act_by_date"] >= "2026-10-15"
    assert data["act_by_date"] != "2026-09-24"


def test_decide_aged_batch_nrv_today_accounts_for_quality(client):
    # Bug 3 fix: 10-day old tomato batch should have degraded nrv_today, not fresh 1.0 multiplier
    fresh_payload = {
        "commodity": "tomato",
        "market": "Vadgaonpeth",
        "initial_quantity_quintals": 100.0,
        "storage_type": "ambient",
        "harvest_date": "2026-10-15",
        "as_of": "2026-10-15",
    }
    aged_payload = {
        "commodity": "tomato",
        "market": "Vadgaonpeth",
        "initial_quantity_quintals": 100.0,
        "storage_type": "ambient",
        "harvest_date": "2026-10-05",  # 10 days aged
        "as_of": "2026-10-15",
    }
    fresh_res = client.post("/decide", json=fresh_payload).json()
    aged_res = client.post("/decide", json=aged_payload).json()

    # NRV today of aged batch must be significantly lower than fresh batch
    assert aged_res["nrv_today"] < fresh_res["nrv_today"] * 0.70


def test_price_forecast_weather_metrics(client):
    # Bug 8 fix: weather values must not be fabricated
    payload = {
        "commodity": "tomato",
        "market": "Kolhapur",
        "horizon_days": 3,
    }
    res = client.post("/price/forecast", json=payload)
    assert res.status_code == 200
    daily = res.json()["daily_forecasts"]
    for d in daily:
        assert "weather" in d
        assert "temp_max_c" in d["weather"]
        assert "precipitation_mm" in d["weather"]


def test_get_price_sync_status(client):
    res = client.get("/price/sync/status")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "data_status" in data
    assert "sync_metadata" in data
    assert "latest_price_date" in data["data_status"]


def test_get_weather_current(client):
    res = client.get("/weather/current?district=Kolhapur")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "current" in data
    assert data["district"] == "Kolhapur"


def test_get_weather_forecast(client):
    res = client.get("/weather/forecast?district=Sangli")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "forecasts" in data
    assert data["district"] == "Sangli"


def test_feedback_metrics(client):
    res = client.get("/feedback/metrics")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "data" in data
    assert "overall_mape" in data["data"]


def test_feedback_evaluate(client):
    res = client.post("/feedback/evaluate", json={"retrain_if_drift": False})
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "data" in data


def test_sync_all_endpoint(client):
    res = client.post("/sync/all", json={})
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "results" in data
