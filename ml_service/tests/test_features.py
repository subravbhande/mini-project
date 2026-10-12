"""
Leakage and Parity Tests for models/features.py
Verifies:
1. Leakage test: deleting data dated after origin has 0 impact on features.
2. Parity test: identical inputs produce identical feature vectors across invocations.
3. No same-day price or arrival leaks exist in the feature set.
"""

import os
import sys
import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.features import build_features, get_feature_names
from models.data_access import load_prices, load_weather


@pytest.fixture
def dataset():
    prices = load_prices()
    weather = load_weather()
    return prices, weather


def test_no_sameday_features_in_feature_names():
    names = get_feature_names()
    forbidden = ["price_range", "Modal Price", "Arrival Quantity", "day_of_year", "week_of_year", "quarter"]
    for f in forbidden:
        assert f not in names, f"Forbidden feature '{f}' found in feature names!"


def test_leakage_immunity(dataset):
    prices, weather = dataset
    # Pick a series and origin date
    series = {"crop": "tomato", "market": "Kolhapur", "district": "Kolhapur"}
    origin = "2026-05-15"
    horizon = 3

    # Feature vector built with the full dataset
    features_full = build_features(prices, series, origin, horizon, weather)

    # Feature vector built with dataset where everything after origin is deleted
    prices_cutoff = prices[prices["date"] <= pd.to_datetime(origin)].copy()
    weather_cutoff = weather[weather["date"] <= pd.to_datetime(origin) + pd.Timedelta(days=horizon)].copy()
    features_cutoff = build_features(prices_cutoff, series, origin, horizon, weather_cutoff)

    # Both must match exactly across all numerical and categorical fields
    for k in features_full:
        if isinstance(features_full[k], (float, int, np.floating, np.integer)):
            assert np.isclose(features_full[k], features_cutoff[k], rtol=1e-5, atol=1e-5), (
                f"Feature '{k}' differed between full and cutoff: {features_full[k]} vs {features_cutoff[k]}"
            )
        else:
            assert features_full[k] == features_cutoff[k], (
                f"Categorical feature '{k}' differed: {features_full[k]} vs {features_cutoff[k]}"
            )


def test_train_serve_parity(dataset):
    prices, weather = dataset
    series = {"crop": "onion", "market": "Sangli-Phale-Bhajipala", "district": "Sangli"}
    origin = "2026-06-01"
    horizon = 1

    # Simulate two independent calls (representing train time vs serve time)
    v1 = build_features(prices, series, origin, horizon, weather)
    v2 = build_features(prices, series, origin, horizon, weather)

    assert v1 == v2, "Feature vectors failed parity test!"
