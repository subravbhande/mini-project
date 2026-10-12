"""
Distress-Sale Timing Advisor — ML Service API (FastAPI)
Provides high-performance endpoints for price forecasting, crop decay simulation,
and Net Realizable Value decision recommendations.
"""

from __future__ import annotations

import logging
import os
import sys
from contextlib import asynccontextmanager
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Ensure ml_service root is in sys.path
ML_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ML_ROOT not in sys.path:
    sys.path.insert(0, ML_ROOT)

from app.decision_engine import evaluate_decision
from models.decay_model import DecayModel
from models.price_model import PriceModel, UnsupportedSeriesError

logger = logging.getLogger("ml_service_api")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", stream=sys.stderr)


# ---------------------------------------------------------------------------
# Pydantic Request Models
# ---------------------------------------------------------------------------

class PriceForecastRequest(BaseModel):
    commodity: str = Field(..., description="Crop name: 'tomato' or 'onion'")
    market: str = Field(..., description="APMC Market name")
    district: Optional[str] = Field(None, description="District: 'Kolhapur' or 'Sangli'")
    horizon_days: int = Field(5, ge=1, le=5, description="Forecast horizon (1 to 5 days)")
    as_of: Optional[str] = Field(None, description="Cutoff date YYYY-MM-DD")
    weather_forecast: Optional[List[Dict[str, Any]]] = Field(None, description="Optional daily weather forecast")


class DecaySimulateRequest(BaseModel):
    crop: str = Field(..., description="Crop name: 'tomato' or 'onion'")
    initial_quantity_quintals: float = Field(100.0, gt=0, description="Harvest weight in quintals")
    storage_type: str = Field("ambient", description="'ambient', 'ventilated_chawl', 'zecc', 'cold_storage'")
    district: str = Field("Kolhapur", description="'Kolhapur' or 'Sangli'")
    harvest_date: Optional[str] = Field(None, description="Date of harvest YYYY-MM-DD")
    as_of: Optional[str] = Field(None, description="Current evaluation date YYYY-MM-DD")
    horizon_days: Optional[int] = Field(None, description="Number of days to simulate (or until cutoff)")
    weather_forecast: Optional[List[Dict[str, Any]]] = Field(None, description="Optional daily weather forecast")


class DecisionRequest(BaseModel):
    commodity: str = Field(..., description="Crop name: 'tomato' or 'onion'")
    market: str = Field(..., description="Target market")
    district: Optional[str] = Field(None, description="District name")
    initial_quantity_quintals: float = Field(100.0, gt=0, description="Weight in quintals")
    storage_type: str = Field("ambient", description="Storage method")
    harvest_date: Optional[str] = Field(None, description="Date of harvest YYYY-MM-DD")
    as_of: Optional[str] = Field(None, description="Evaluation date YYYY-MM-DD")
    liquidity_need: str = Field("normal", description="'immediate' | 'normal' | 'low'")
    weather_forecast: Optional[List[Dict[str, Any]]] = Field(None, description="Optional daily weather forecast")


# ---------------------------------------------------------------------------
# Application Lifespan & State Management
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model artifacts, configs, and history into memory once on startup."""
    logger.info("Initializing Distress-Sale ML Service artifacts...")
    app.state.price_model = PriceModel.load()
    app.state.decay_model = DecayModel()
    logger.info("ML Service artifacts loaded and ready.")
    yield
    logger.info("Shutting down ML Service.")


app = FastAPI(
    title="Distress-Sale Timing Advisor — ML Service",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# API Routes
# ---------------------------------------------------------------------------

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "distress-sale-timing-advisor",
        "timestamp": datetime.now().isoformat(),
    }


@app.get("/series")
def list_supported_series():
    """Return all verified (crop, market, district) combinations."""
    price_model: PriceModel = app.state.price_model
    return {
        "count": len(price_model.supported_series),
        "supported_series": price_model.supported_series,
    }


@app.post("/price/forecast")
def forecast_price(req: PriceForecastRequest):
    """Generate 1-5 day direct multi-step price forecast with uncertainty bands."""
    price_model: PriceModel = app.state.price_model
    try:
        result = price_model.predict(
            commodity=req.commodity,
            market=req.market,
            district=req.district,
            horizon_days=req.horizon_days,
            as_of=req.as_of,
            weather_forecast=req.weather_forecast,
        )
        return result.to_dict()
    except UnsupportedSeriesError as e:
        logger.warning(f"Unsupported series requested: {e}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": str(e), "valid": e.valid},
        )
    except Exception as e:
        logger.error(f"Error generating price forecast: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@app.post("/decay/simulate")
def simulate_decay(req: DecaySimulateRequest):
    """Run shelf-life and quality degradation simulation."""
    decay_model: DecayModel = app.state.decay_model
    try:
        result = decay_model.simulate(
            crop=req.crop,
            initial_quantity_quintals=req.initial_quantity_quintals,
            storage_type=req.storage_type,
            district=req.district,
            harvest_date=req.harvest_date,
            as_of=req.as_of,
            horizon_days=req.horizon_days,
            weather_forecast=req.weather_forecast,
        )
        return result.to_dict()
    except Exception as e:
        logger.error(f"Error simulating decay: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@app.post("/decide")
def get_timing_decision(req: DecisionRequest):
    """
    Combined decision endpoint:
    Runs price forecast + decay simulation + economic NRV optimizer.
    """
    price_model: PriceModel = app.state.price_model
    decay_model: DecayModel = app.state.decay_model

    try:
        # 1. Price Forecast (5 days)
        price_res = price_model.predict(
            commodity=req.commodity,
            market=req.market,
            district=req.district,
            horizon_days=5,
            as_of=req.as_of,
            weather_forecast=req.weather_forecast,
        )
        price_dict = price_res.to_dict()

        # 2. Decay Simulation
        decay_res = decay_model.simulate(
            crop=req.commodity,
            initial_quantity_quintals=req.initial_quantity_quintals,
            storage_type=req.storage_type,
            district=price_res.district,
            harvest_date=req.harvest_date,
            as_of=req.as_of,
            horizon_days=5,
            weather_forecast=req.weather_forecast,
        )
        decay_dict = decay_res.to_dict()

        # 3. Storage cost per quintal per day from storage profiles
        storage_meta = decay_model.storage_types.get(decay_res.storage_type, {})
        storage_cost_rate = float(storage_meta.get("cost_per_quintal_per_day", 0.0))

        # 4. Economic Optimization
        economic_res = evaluate_decision(
            price_forecast_schedule=price_dict["daily_forecasts"],
            decay_schedule=decay_dict["daily_schedule"],
            initial_quantity_quintals=req.initial_quantity_quintals,
            storage_cost_per_quintal_per_day=storage_cost_rate,
            liquidity_need=req.liquidity_need,
            base_price_today=price_dict["summary"]["last_observed_price"],
            as_of_date=price_res.data_as_of,
        )

        return {
            "commodity": price_res.commodity,
            "market": price_res.market,
            "district": price_res.district,
            "decision": economic_res.decision,
            "sell_fraction": economic_res.sell_fraction,
            "act_by_date": economic_res.act_by_date,
            "recommended_holding_days": economic_res.recommended_holding_days,
            "nrv_today": economic_res.nrv_today,
            "nrv_best": economic_res.nrv_best,
            "uplift_pct": economic_res.uplift_pct,
            "confidence_label": economic_res.confidence_label,
            "reason": economic_res.reason,
            "reason_mr": economic_res.reason_mr,
            "data_as_of": price_res.data_as_of,
            "days_stale": price_res.days_stale,
            "stale": price_res.stale,
            "warnings": decay_res.warnings,
            "price_forecast": price_dict,
            "decay_simulation": decay_dict,
            "economic_decision": economic_res.to_dict(),
        }

    except UnsupportedSeriesError as e:
        logger.warning(f"Unsupported series in decision: {e}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": str(e), "valid": e.valid},
        )
    except Exception as e:
        logger.error(f"Error evaluating decision: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
