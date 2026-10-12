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
