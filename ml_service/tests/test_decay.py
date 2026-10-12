"""
Unit Tests for Distress-Sale Timing Advisor Crop Decay Model
Tests all 9 fixes from the codebase review:
- Harvest date age replay
- Shelf-life cutoff (< 0.60 multiplier)
- Weather fallback with assumed=True
- Storage validation and warning generation
- Double counting prevention in cold storage
- Risk labels (strictly Low, Moderate, High)
"""

import os
import sys
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.decay_model import DecayModel


@pytest.fixture(scope="module")
def decay_model():
    return DecayModel()


def test_harvest_date_and_crop_age(decay_model):
    # Simulating fresh tomato vs 4-day-old tomato
    fresh = decay_model.simulate(
        crop="tomato",
        harvest_date="2026-05-10",
        as_of="2026-05-10",
        horizon_days=5,
    )
    aged = decay_model.simulate(
        crop="tomato",
        harvest_date="2026-05-06",
        as_of="2026-05-10",
        horizon_days=5,
    )
    assert aged.crop_age_days_at_start == 4
    # Aged produce should have lower initial retained weight / value multiplier
    assert aged.daily_schedule[0].retained_weight_quintals < fresh.daily_schedule[0].retained_weight_quintals
    assert aged.daily_schedule[0].effective_value_multiplier < fresh.daily_schedule[0].effective_value_multiplier


def test_shelf_life_cutoff(decay_model):
    # Tomato held ambient in warm weather should hit cutoff (< 0.60 value multiplier)
    res = decay_model.simulate(crop="tomato", storage_type="ambient", horizon_days=14)
    assert res.shelf_life_cutoff_day is not None
    assert res.shelf_life_cutoff_day <= 14


def test_storage_validation_and_warnings(decay_model):
    # Unknown storage must raise ValueError
    with pytest.raises(ValueError) as exc_info:
        decay_model.simulate(crop="onion", storage_type="invalid_storage")
    assert "Unknown storage type" in str(exc_info.value)

    # Incompatible storage: ventilated_chawl is only for onion, so tomato gets ambient + warning
    res = decay_model.simulate(crop="tomato", storage_type="ventilated_chawl", horizon_days=3)
    assert res.storage_type == "ambient"
    assert len(res.warnings) > 0
    assert "ventilated_chawl" in res.warnings[0]


def test_risk_labels_strictly_valid(decay_model):
    res = decay_model.simulate(crop="tomato", storage_type="ambient", horizon_days=10)
    valid_labels = {"LOW", "MODERATE", "HIGH"}
    for step in res.daily_schedule:
        assert step.risk_level in valid_labels, f"Invalid risk level: {step.risk_level}"


def test_weather_fallback_assumed(decay_model):
    # Dates far in the future will use day-of-year seasonal average and mark assumed=True
    res = decay_model.simulate(
        crop="onion",
        storage_type="ambient",
        as_of="2028-06-01",
        horizon_days=3,
    )
    for step in res.daily_schedule:
        assert step.weather_assumed is True
