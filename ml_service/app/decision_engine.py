"""
Distress-Sale Timing Advisor — Economic Decision Engine
Evaluates trade-offs between physical/quality decay, storage costs, and projected price movements
to recommend actionable timing: SELL, HOLD, or PARTIAL-SELL.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Union


@dataclass
class DailyEconomicSnapshot:
    day: int
    date: str
    predicted_price: float
    retained_weight_quintals: float
    effective_value_multiplier: float
    decay_risk_level: str
    cumulative_storage_cost: float
    net_realizable_value: float
    uplift_vs_today_pct: float

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class DecisionResult:
    decision: str  # "SELL", "HOLD", "PARTIAL_SELL"
    sell_fraction: float  # 1.0 (sell all), 0.0 (hold all), 0.5 (split)
    act_by_date: str
    recommended_holding_days: int
    nrv_today: float
    nrv_best: float
    uplift_pct: float
    confidence_label: str
    reason: str
    reason_mr: str
    daily_schedule: List[DailyEconomicSnapshot]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "decision": self.decision,
            "sell_fraction": self.sell_fraction,
            "act_by_date": self.act_by_date,
            "recommended_holding_days": self.recommended_holding_days,
            "nrv_today": round(self.nrv_today, 2),
            "nrv_best": round(self.nrv_best, 2),
            "uplift_pct": round(self.uplift_pct, 2),
            "confidence_label": self.confidence_label,
            "reason": self.reason,
            "reason_mr": self.reason_mr,
            "daily_schedule": [s.to_dict() for s in self.daily_schedule],
        }


def evaluate_decision(
    price_forecast_schedule: List[Dict[str, Any]],
    decay_schedule: List[Dict[str, Any]],
    initial_quantity_quintals: float = 100.0,
    storage_cost_per_quintal_per_day: float = 0.0,
    liquidity_need: str = "normal",  # "immediate" | "normal" | "low"
    transport_cost_total: float = 0.0,
    base_price_today: Optional[float] = None,
    as_of_date: Optional[Union[str, date]] = None,
) -> DecisionResult:
    """
    Computes Net Realizable Value (NRV) over the holding horizon and applies
    risk-weighted priority rules to determine optimal sale timing.
    """
    qty = float(initial_quantity_quintals)
    is_immediate_cash = str(liquidity_need).lower() in ["immediate", "urgent", "high", "true"]

    # Align dates
    today_str = str(as_of_date or date.today())[:10]

    # Baseline NRV today (t = 0)
    p0 = float(
        base_price_today
        or (price_forecast_schedule[0]["predicted_modal_price"] if price_forecast_schedule else 1000.0)
    )
    nrv_today = (p0 * 1.0 * qty) - transport_cost_total

    # Build daily snapshots
    snapshots: List[DailyEconomicSnapshot] = []
    min_len = min(len(price_forecast_schedule), len(decay_schedule))

    best_day_idx = 0
    best_nrv = nrv_today
    best_risk = "LOW"
    overall_confidence = price_forecast_schedule[0].get("confidence_label", "Moderate") if price_forecast_schedule else "Moderate"

    for i in range(min_len):
        pf = price_forecast_schedule[i]
        df = decay_schedule[i]

        day_num = i + 1
        day_date = pf.get("date") or df.get("date") or today_str
        pred_p = float(pf.get("predicted_modal_price", p0))
        val_mult = float(df.get("effective_value_multiplier", 1.0))
        retained_w = float(df.get("retained_weight_quintals", qty))
        risk_lvl = str(df.get("risk_level", "LOW")).upper()

        cum_storage = storage_cost_per_quintal_per_day * day_num * qty
        # Gross revenue = predicted_price * multiplier * initial_qty (incorporates both physical weight and quality downgrade)
        gross_rev = pred_p * val_mult * qty
        nrv_t = gross_rev - cum_storage - transport_cost_total
        uplift_t = ((nrv_t - nrv_today) / nrv_today) * 100.0 if nrv_today > 0 else 0.0

        snap = DailyEconomicSnapshot(
            day=day_num,
            date=day_date,
            predicted_price=round(pred_p, 2),
            retained_weight_quintals=round(retained_w, 2),
            effective_value_multiplier=round(val_mult, 4),
            decay_risk_level=risk_lvl,
            cumulative_storage_cost=round(cum_storage, 2),
            net_realizable_value=round(nrv_t, 2),
            uplift_vs_today_pct=round(uplift_t, 2),
        )
        snapshots.append(snap)

        if nrv_t > best_nrv:
            best_nrv = nrv_t
            best_day_idx = day_num
            best_risk = risk_lvl

    net_uplift_pct = ((best_nrv - nrv_today) / nrv_today) * 100.0 if nrv_today > 0 else 0.0

    # Decision Priority Rules
    # Rule 1: Immediate liquidity need -> SELL NOW
    if is_immediate_cash:
        decision = "SELL"
        sell_fraction = 1.0
        act_by_date = today_str
        rec_days = 0
        reason_en = "Immediate cash needed. Sell today to meet cash requirements and eliminate storage loss."
        reason_mr = "तातडीची पैशांची गरज. तोटा टाळण्यासाठी आजच माल विका."

    # Rule 2: High decay risk or zero/negative uplift -> SELL NOW
    elif best_risk == "HIGH" or net_uplift_pct <= 1.0:
        decision = "SELL"
        sell_fraction = 1.0
        act_by_date = today_str
        rec_days = 0
        if best_risk == "HIGH":
            reason_en = "High spoilage risk. Deterioration will outpace any prospective market price increase."
            reason_mr = "खराब होण्याची जास्त भीती आहे. साठवणुकीत नुकसान जास्त होईल, आजच विका."
        else:
            reason_en = "Market prices are declining or flat relative to holding costs. Selling today maximizes return."
            reason_mr = "बाजारभाव स्थिर किंवा घसरण्याची शक्यता. आजच विकणे फायदेशीर ठरेल."

    # Rule 3: Favorable uplift (> 3%) with High/Moderate confidence & Low spoilage risk -> HOLD
    elif net_uplift_pct >= 3.0 and overall_confidence in ["High", "Moderate"] and best_risk == "LOW":
        decision = "HOLD"
        sell_fraction = 0.0
        best_snap = snapshots[best_day_idx - 1]
        act_by_date = best_snap.date
        rec_days = best_day_idx
        reason_en = f"Favorable price gain projected (+{round(net_uplift_pct, 1)}% net uplift by {act_by_date}). Produce quality remains safe."
        reason_mr = f"भावात वाढ होण्याची शक्यता (+{round(net_uplift_pct, 1)}% निव्वळ नफा). {act_by_date} पर्यंत माल सांभाळा."

    # Rule 4: Positive uplift but Low confidence or Moderate spoilage risk -> PARTIAL-SELL
    elif net_uplift_pct > 1.0 and (overall_confidence == "Low" or best_risk == "MODERATE"):
        decision = "PARTIAL_SELL"
        sell_fraction = 0.50
        best_snap = snapshots[best_day_idx - 1] if best_day_idx > 0 else snapshots[0]
        act_by_date = best_snap.date
        rec_days = best_day_idx
        reason_en = f"Moderate market uncertainty / storage risk. Sell 50% today to secure cash, hold remaining 50% until {act_by_date}."
        reason_mr = f"बाजारात चढ-उतार संभवतो. ५०% माल आज विका आणि ५०% माल {act_by_date} पर्यंत ठेवा."

    # Default fallback
    else:
        decision = "SELL"
        sell_fraction = 1.0
        act_by_date = today_str
        rec_days = 0
        reason_en = "Holding does not yield reliable profit after factoring decay and storage fees."
        reason_mr = "साठवणुकीचा खर्च आणि घट लक्षात घेता आजच विकणे योग्य आहे."

    return DecisionResult(
        decision=decision,
        sell_fraction=sell_fraction,
        act_by_date=act_by_date,
        recommended_holding_days=rec_days,
        nrv_today=nrv_today,
        nrv_best=best_nrv,
        uplift_pct=net_uplift_pct,
        confidence_label=overall_confidence,
        reason=reason_en,
        reason_mr=reason_mr,
        daily_schedule=snapshots,
    )
