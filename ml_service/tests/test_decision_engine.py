"""
Unit Tests for Distress-Sale Timing Advisor Decision Engine
Tests mocked economic scenarios:
1. Rising price with high confidence -> HOLD
2. High liquidity need -> SELL
3. High decay risk -> SELL
4. Low confidence / moderate risk -> PARTIAL-SELL
"""

import os
import sys
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.decision_engine import evaluate_decision


def test_hold_recommendation_on_rising_market():
    # Price rising by ~15% over 3 days, low decay risk, high confidence
    pf = [
        {"predicted_modal_price": 1050.0, "confidence_label": "High", "date": "2026-10-14"},
        {"predicted_modal_price": 1120.0, "confidence_label": "High", "date": "2026-10-15"},
        {"predicted_modal_price": 1180.0, "confidence_label": "High", "date": "2026-10-16"},
    ]
    df = [
        {"effective_value_multiplier": 0.99, "risk_level": "LOW", "retained_weight_quintals": 99.5},
        {"effective_value_multiplier": 0.98, "risk_level": "LOW", "retained_weight_quintals": 99.0},
        {"effective_value_multiplier": 0.97, "risk_level": "LOW", "retained_weight_quintals": 98.5},
    ]
    res = evaluate_decision(
        price_forecast_schedule=pf,
        decay_schedule=df,
        initial_quantity_quintals=100.0,
        storage_cost_per_quintal_per_day=0.5,
        liquidity_need="normal",
        base_price_today=1000.0,
    )
    assert res.decision == "HOLD"
    assert res.sell_fraction == 0.0
    assert res.recommended_holding_days == 3
    assert res.uplift_pct > 5.0


def test_immediate_liquidity_need_forces_sell():
    # Even if market is rising, cash urgency forces immediate sale
    pf = [
        {"predicted_modal_price": 1500.0, "confidence_label": "High", "date": "2026-10-14"},
    ]
    df = [
        {"effective_value_multiplier": 0.99, "risk_level": "LOW", "retained_weight_quintals": 99.5},
    ]
    res = evaluate_decision(
        price_forecast_schedule=pf,
        decay_schedule=df,
        liquidity_need="immediate",
        base_price_today=1000.0,
    )
    assert res.decision == "SELL"
    assert res.sell_fraction == 1.0


def test_high_decay_risk_forces_sell():
    # Market rising slightly but produce rotting rapidly
    pf = [
        {"predicted_modal_price": 1050.0, "confidence_label": "High", "date": "2026-10-14"},
    ]
    df = [
        {"effective_value_multiplier": 0.65, "risk_level": "HIGH", "retained_weight_quintals": 75.0},
    ]
    res = evaluate_decision(
        price_forecast_schedule=pf,
        decay_schedule=df,
        liquidity_need="normal",
        base_price_today=1000.0,
    )
    assert res.decision == "SELL"
    assert res.sell_fraction == 1.0


def test_low_confidence_produces_partial_sell():
    # Uplift is positive but confidence is Low
    pf = [
        {"predicted_modal_price": 1080.0, "confidence_label": "Low", "date": "2026-10-14"},
    ]
    df = [
        {"effective_value_multiplier": 0.99, "risk_level": "LOW", "retained_weight_quintals": 99.5},
    ]
    res = evaluate_decision(
        price_forecast_schedule=pf,
        decay_schedule=df,
        liquidity_need="normal",
        base_price_today=1000.0,
    )
    assert res.decision == "PARTIAL_SELL"
    assert res.sell_fraction == 0.50
