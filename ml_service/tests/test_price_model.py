"""
Unit Tests for Distress-Sale Timing Advisor Price Prediction Model
Covers:
- Input validation & UnsupportedSeriesError
- Rain risk flag logic
- Non-trivial uncertainty bands
- Freshness tracking (data_as_of, days_stale)
- Max horizon enforcement
"""

import os
import sys
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.price_model import PriceModel, UnsupportedSeriesError


@pytest.fixture(scope="module")
def model():
    return PriceModel.load()


def test_unsupported_inputs_raise_error(model):
    # Pune is not in training
    with pytest.raises(UnsupportedSeriesError) as exc_info:
        model.predict(commodity="onion", market="Pune")
    assert "Pune" in str(exc_info.value)
    assert len(exc_info.value.valid) == 6

    # Palus has only Tomato, so Onion in Palus must fail
    with pytest.raises(UnsupportedSeriesError):
        model.predict(commodity="onion", market="Palus")


def test_supported_inputs_succeed(model):
    # Tomato in Kolhapur
    res = model.predict(commodity="tomato", market="Kolhapur", horizon_days=5)
    assert res.commodity == "Tomato"
    assert res.market == "Kolhapur"
    assert len(res.daily_forecasts) == 5
    assert res.data_as_of is not None
    assert res.days_stale >= 0

    # Onion in Sangli-Phale-Bhajipala
    res_onion = model.predict(commodity="onion", market="Sangli-Phale-Bhajipala", horizon_days=3)
    assert res_onion.commodity == "Onion"
    assert len(res_onion.daily_forecasts) == 3


def test_horizon_cap(model):
    # > 5 days must be rejected
    with pytest.raises(ValueError):
        model.predict(commodity="tomato", market="Kolhapur", horizon_days=7)


def test_rain_risk_flag_logic(model):
    # Test light drizzle (2.5 mm) -> no flag
    wf_light = [{"date": "2026-09-25", "precipitation_sum": 2.5, "temp_mean": 25.0, "humidity_mean": 70.0}]
    res_light = model.predict(commodity="tomato", market="Kolhapur", horizon_days=1, weather_forecast=wf_light)
    d1 = res_light.daily_forecasts[0]
    assert d1.weather_risk_flag is False

    # Test heavy rain (60 mm) -> heavy flag
    wf_heavy = [{"date": "2026-09-25", "precipitation_sum": 60.0, "temp_mean": 25.0, "humidity_mean": 70.0}]
    res_heavy = model.predict(commodity="tomato", market="Kolhapur", horizon_days=1, weather_forecast=wf_heavy)
    d2 = res_heavy.daily_forecasts[0]
    assert d2.weather_risk_flag is True
    assert "Heavy rain" in d2.weather_risk_reason


def test_uncertainty_bands(model):
    res = model.predict(commodity="tomato", market="Kolhapur", horizon_days=3)
    for day_f in res.daily_forecasts:
        assert day_f.confidence_band_low < day_f.predicted_modal_price
        assert day_f.predicted_modal_price < day_f.confidence_band_high
        assert day_f.confidence_label in ["High", "Moderate", "Low"]
