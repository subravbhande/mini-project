"""
Distress-Sale Timing Advisor — ML Service API (FastAPI)
Provides high-performance endpoints for price forecasting, crop decay simulation,
and Net Realizable Value decision recommendations.
"""

from __future__ import annotations

import json
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
from training.fetch_daily_prices import sync_daily_prices
from training.fetch_daily_weather import sync_daily_weather, fetch_5day_forecast, fetch_current_weather

logger = logging.getLogger("ml_service_api")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", stream=sys.stderr)


# ---------------------------------------------------------------------------
# Utility Helpers
# ---------------------------------------------------------------------------

def sanitize_for_json(obj: Any) -> Any:
    """Recursively converts MongoDB ObjectId and other non-JSON types to strings/primitives."""
    if isinstance(obj, dict):
        res = {}
        for k, v in obj.items():
            if type(v).__name__ == "ObjectId":
                res[k] = str(v)
            else:
                res[k] = sanitize_for_json(v)
        return res
    elif isinstance(obj, (list, tuple)):
        return [sanitize_for_json(item) for item in obj]
    elif type(obj).__name__ == "ObjectId":
        return str(obj)
    return obj


# ---------------------------------------------------------------------------
# Pydantic Request Models
# ---------------------------------------------------------------------------

class PriceForecastRequest(BaseModel):
    commodity: str = Field(..., description="Crop name: 'tomato' or 'onion'")
    market: str = Field(..., description="APMC Market name")
    district: Optional[str] = Field(None, description="District: 'Kolhapur' or 'Sangli'")
    horizon_days: int = Field(5, ge=1, le=5, description="Forecast horizon (1 to 5 days)")
    as_of: Optional[str] = Field(None, description="Cutoff date YYYY-MM-DD")
    start_date: Optional[str] = Field(None, description="Start date (alias for as_of)")
    quantity_quintals: Optional[float] = Field(0.0, description="Farmer harvest quantity in quintals")
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


class SyncPriceRequest(BaseModel):
    api_key: Optional[str] = Field(None, description="Optional custom data.gov.in API key")
    force_seed: bool = Field(False, description="Force continuity seed fallback")


class SyncWeatherRequest(BaseModel):
    api_key: Optional[str] = Field(None, description="Optional custom OpenWeatherMap API key")


class SyncAllRequest(BaseModel):
    api_key: Optional[str] = Field(None, description="Shared or default API key")
    price_api_key: Optional[str] = Field(None, description="Optional custom data.gov.in API key")
    weather_api_key: Optional[str] = Field(None, description="Optional custom OpenWeatherMap API key")
    force_seed: bool = Field(False, description="Force continuity seed fallback")
    retrain_if_drift: bool = Field(True, description="Retrain model if drift is detected")
    price_req: Optional[SyncPriceRequest] = Field(None, description="Nested price sync request params")
    weather_req: Optional[SyncWeatherRequest] = Field(None, description="Nested weather sync request params")


class FeedbackEvaluateRequest(BaseModel):
    retrain_if_drift: bool = Field(True, description="Automatically retrain model if drift is detected")


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

def get_price_model(app_instance: FastAPI = app) -> PriceModel:
    if not hasattr(app_instance.state, "price_model") or app_instance.state.price_model is None:
        logger.info("Initializing PriceModel on demand...")
        app_instance.state.price_model = PriceModel.load()
    return app_instance.state.price_model

def get_decay_model(app_instance: FastAPI = app) -> DecayModel:
    if not hasattr(app_instance.state, "decay_model") or app_instance.state.decay_model is None:
        logger.info("Initializing DecayModel on demand...")
        app_instance.state.decay_model = DecayModel()
    return app_instance.state.decay_model

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
    price_model: PriceModel = get_price_model(app)
    return {
        "count": len(price_model.supported_series),
        "supported_series": price_model.supported_series,
    }


@app.post("/price/forecast")
def forecast_price(req: PriceForecastRequest):
    """Generate 1-5 day direct multi-step price forecast with uncertainty bands."""
    price_model: PriceModel = get_price_model(app)
    try:
        as_of_date = req.as_of or req.start_date
        weather_fc = req.weather_forecast
        target_district = req.district
        if not target_district and req.market:
            for s in price_model.supported_series:
                if s["market"].lower() == req.market.strip().lower():
                    target_district = s["district"]
                    break

        if not weather_fc and target_district:
            try:
                weather_fc = fetch_5day_forecast(target_district)
            except Exception as e:
                logger.debug(f"OpenWeather 5-day forecast auto-fetch notice: {e}")

        result = price_model.predict(
            commodity=req.commodity,
            market=req.market,
            district=req.district,
            horizon_days=req.horizon_days,
            as_of=as_of_date,
            weather_forecast=weather_fc,
        )
        res_dict = result.to_dict()

        # Add farmer-friendly summary and UI compatibility fields
        daily = res_dict.get("daily_forecasts", [])
        if daily:
            for d in daily:
                d["predicted_min_price"] = d.get("typical_daily_spread_min") or d.get("confidence_band_low") or round(d["predicted_modal_price"] * 0.95, 2)
                d["predicted_max_price"] = d.get("typical_daily_spread_max") or d.get("confidence_band_high") or round(d["predicted_modal_price"] * 1.05, 2)
                w_info = d.get("weather")
                if not isinstance(w_info, dict) or not w_info.get("temp_max_c"):
                    temp_max = d.get("temp_c") if d.get("temp_c") is not None else 25.0
                    precip = d.get("precipitation_mm") if d.get("precipitation_mm") is not None else (25.0 if d.get("weather_risk_flag") else 0.0)
                    humidity = d.get("humidity_pct") if d.get("humidity_pct") is not None else 70.0
                    d["weather"] = {
                        "temp_max_c": round(float(temp_max), 1),
                        "precipitation_mm": round(float(precip), 1),
                        "humidity_pct": round(float(humidity), 1),
                    }

            best_day = max(daily, key=lambda d: d["predicted_modal_price"])
            worst_day = min(daily, key=lambda d: d["predicted_modal_price"])
            avg_price = round(sum(d["predicted_modal_price"] for d in daily) / len(daily), 2)

            summary_obj = res_dict.get("summary", {})
            overall_trend = summary_obj.get("overall_trend", "STABLE")
            price_trend = "UP" if overall_trend == "RISING" else ("DOWN" if overall_trend == "FALLING" else "STABLE")
            weather_risk_dates = [d["date"] for d in daily if d.get("weather_risk_flag")]

            summary_obj["forecast_avg_price"] = avg_price
            summary_obj["price_trend"] = price_trend
            summary_obj["weather_risk_days"] = len(weather_risk_dates)
            res_dict["summary"] = summary_obj

            farmer_summary = {
                "best_sell_date": best_day["date"],
                "best_sell_price": best_day["predicted_modal_price"],
                "worst_sell_date": worst_day["date"],
                "worst_sell_price": worst_day["predicted_modal_price"],
                "price_trend": price_trend,
                "weather_risk_days": weather_risk_dates,
                "recommendation": (
                    "SELL_NOW" if price_trend == "DOWN"
                    else "HOLD_FOR_BEST_PRICE" if price_trend == "UP"
                    else "SELL_ANYTIME"
                ),
            }

            qty = float(req.quantity_quintals or 0.0)
            if qty > 0:
                farmer_summary["estimated_earnings_best_day"] = round(best_day["predicted_modal_price"] * qty, 2)
                farmer_summary["estimated_earnings_today"] = round(daily[0]["predicted_modal_price"] * qty, 2)
                farmer_summary["estimated_earnings_avg"] = round(avg_price * qty, 2)
                farmer_summary["quantity_quintals"] = qty

            res_dict["farmer_summary"] = farmer_summary

        return res_dict
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
    decay_model: DecayModel = get_decay_model(app)
    try:
        weather_fc = req.weather_forecast
        if not weather_fc and req.district:
            try:
                weather_fc = fetch_5day_forecast(req.district)
            except Exception as e:
                logger.debug(f"OpenWeather 5-day forecast auto-fetch notice: {e}")

        result = decay_model.simulate(
            crop=req.crop,
            initial_quantity_quintals=req.initial_quantity_quintals,
            storage_type=req.storage_type,
            district=req.district,
            harvest_date=req.harvest_date,
            as_of=req.as_of,
            horizon_days=req.horizon_days,
            weather_forecast=weather_fc,
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
    price_model: PriceModel = get_price_model(app)
    decay_model: DecayModel = get_decay_model(app)

    try:
        weather_fc = req.weather_forecast
        target_district = req.district
        if not target_district and req.market:
            for s in price_model.supported_series:
                if s["market"].lower() == req.market.strip().lower():
                    target_district = s["district"]
                    break

        if not weather_fc and target_district:
            try:
                weather_fc = fetch_5day_forecast(target_district)
            except Exception as e:
                logger.debug(f"OpenWeather 5-day forecast auto-fetch notice: {e}")

        # 1. Price Forecast (5 days)
        price_res = price_model.predict(
            commodity=req.commodity,
            market=req.market,
            district=req.district,
            horizon_days=5,
            as_of=req.as_of,
            weather_forecast=weather_fc,
        )
        price_dict = price_res.to_dict()
        daily = price_dict.get("daily_forecasts", [])
        if daily:
            for d in daily:
                d["predicted_min_price"] = d.get("typical_daily_spread_min") or d.get("confidence_band_low") or round(d["predicted_modal_price"] * 0.95, 2)
                d["predicted_max_price"] = d.get("typical_daily_spread_max") or d.get("confidence_band_high") or round(d["predicted_modal_price"] * 1.05, 2)
                w_info = d.get("weather")
                if not isinstance(w_info, dict) or not w_info.get("temp_max_c"):
                    temp_max = d.get("temp_c") if d.get("temp_c") is not None else 25.0
                    precip = d.get("precipitation_mm") if d.get("precipitation_mm") is not None else (25.0 if d.get("weather_risk_flag") else 0.0)
                    humidity = d.get("humidity_pct") if d.get("humidity_pct") is not None else 70.0
                    d["weather"] = {
                        "temp_max_c": round(float(temp_max), 1),
                        "precipitation_mm": round(float(precip), 1),
                        "humidity_pct": round(float(humidity), 1),
                    }

        # 2. Decay Simulation
        decay_res = decay_model.simulate(
            crop=req.commodity,
            initial_quantity_quintals=req.initial_quantity_quintals,
            storage_type=req.storage_type,
            district=price_res.district,
            harvest_date=req.harvest_date,
            as_of=req.as_of,
            horizon_days=5,
            weather_forecast=weather_fc,
        )
        decay_dict = decay_res.to_dict()

        # 3. Storage cost per quintal per day from storage profiles
        storage_meta = decay_model.storage_types.get(decay_res.storage_type, {})
        storage_cost_rate = float(storage_meta.get("cost_per_quintal_per_day", 0.0))

        effective_query_date = str(req.as_of or date.today())[:10]
        decay_summary = decay_dict.get("summary", {})
        eff_mult_today = float(decay_summary.get("effective_value_multiplier_today", 1.0))

        # 4. Economic Optimization
        economic_res = evaluate_decision(
            price_forecast_schedule=price_dict["daily_forecasts"],
            decay_schedule=decay_dict["daily_schedule"],
            initial_quantity_quintals=req.initial_quantity_quintals,
            storage_cost_per_quintal_per_day=storage_cost_rate,
            liquidity_need=req.liquidity_need,
            base_price_today=price_dict["summary"]["last_observed_price"],
            as_of_date=effective_query_date,
            current_value_multiplier_today=eff_mult_today,
        )

        return {
            "commodity": price_res.commodity,
            "market": price_res.market,
            "district": price_res.district,
            "decision": economic_res.decision,
            "sell_fraction": economic_res.sell_fraction,
            "act_by_date": economic_res.act_by_date,
            "recommended_holding_days": economic_res.recommended_holding_days,
            "nrv_today": round(economic_res.nrv_today, 2),
            "nrv_best": round(economic_res.nrv_best, 2),
            "uplift_pct": round(economic_res.uplift_pct, 2),
            "confidence_label": economic_res.confidence_label,
            "break_even_price_best_day": round(economic_res.break_even_price_best_day, 2),
            "break_even_pct_best_day": round(economic_res.break_even_pct_best_day, 2),
            "reason": economic_res.reason,
            "reason_mr": economic_res.reason_mr,
            "data_as_of": price_res.data_as_of,
            "last_observed_price": round(float(price_dict.get("summary", {}).get("last_observed_price", 0.0)), 2),
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


@app.post("/price/sync")
def trigger_daily_price_sync(req: Optional[SyncPriceRequest] = None):
    """
    Fetch daily prices from data.gov.in (or continuity fallback),
    persist new records to clean & filtered datasets, and reload the PriceModel.
    """
    price_model: PriceModel = get_price_model(app)
    try:
        api_key = req.api_key if req else None
        force_seed = req.force_seed if req else False

        # 1. Fetch & ingest
        sync_meta = sync_daily_prices(api_key=api_key, force_seed=force_seed, allow_continuity_fallback=True)

        # 2. Reload PriceModel in memory
        reload_meta = price_model.reload_prices()

        return {
            "success": True,
            "sync": sync_meta,
            "model_reload": reload_meta,
            "message": "Daily prices successfully fetched and loaded into the price forecasting model.",
        }
    except Exception as e:
        logger.error(f"Daily price sync failed: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@app.get("/price/sync/status")
def get_daily_price_status():
    """Return dataset freshness and daily sync status."""
    price_model: PriceModel = get_price_model(app)
    data_status = price_model.get_data_status()

    # Read data_as_of.json if present
    meta_path = os.path.join(ML_ROOT, "models", "saved", "data_as_of.json")
    file_meta = {}
    if os.path.exists(meta_path):
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                file_meta = json.load(f)
        except Exception:
            pass

    return {
        "status": "ok",
        "data_status": data_status,
        "sync_metadata": file_meta,
    }


@app.post("/weather/sync")
def trigger_daily_weather_sync(req: Optional[SyncWeatherRequest] = None):
    """
    Fetch daily live weather and 5-day forecasts from OpenWeatherMap for Kolhapur & Sangli,
    persist observations to clean weather dataset, and update MongoDB weather_cache.
    """
    price_model: PriceModel = get_price_model(app)
    try:
        api_key = req.api_key if req else None
        sync_meta = sync_daily_weather(api_key=api_key)
        # Reload both prices and weather in memory so forecasts use latest weather
        price_model.reload_prices()
        return {
            "success": True,
            "sync": sync_meta,
            "message": "Daily weather and 5-day forecasts successfully fetched from OpenWeatherMap.",
        }
    except Exception as e:
        logger.error(f"Daily weather sync failed: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@app.get("/weather/current")
def get_current_weather_endpoint(district: str = "Kolhapur"):
    """Get live weather observation from OpenWeatherMap for district (Kolhapur / Sangli)."""
    try:
        clean_dist = district.strip().capitalize()
        data = fetch_current_weather(clean_dist)
        if not data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Weather unavailable for {district}")
        return {"status": "ok", "district": clean_dist, "current": data}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching current weather: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@app.get("/weather/forecast")
def get_weather_forecast_endpoint(district: str = "Kolhapur"):
    """Get 5-day daily aggregated meteorological forecast from OpenWeatherMap."""
    try:
        clean_dist = district.strip().capitalize()
        forecasts = fetch_5day_forecast(clean_dist)
        return {
            "status": "ok",
            "district": clean_dist,
            "count": len(forecasts),
            "forecasts": forecasts,
        }
    except Exception as e:
        logger.error(f"Error fetching weather forecast: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@app.post("/sync/all")
def trigger_all_sync(req: Optional[SyncAllRequest] = None):
    """Convenience endpoint to sync daily prices, weather, reload model, and run feedback evaluation."""
    price_model: PriceModel = get_price_model(app)
    results = {}

    p_key = (req.price_api_key or req.api_key or (req.price_req.api_key if req.price_req else None)) if req else None
    force_seed = (req.force_seed or (req.price_req.force_seed if req.price_req else False)) if req else False
    w_key = (req.weather_api_key or req.api_key or (req.weather_req.api_key if req.weather_req else None)) if req else None
    retrain = req.retrain_if_drift if req else True

    try:
        results["price_sync"] = sync_daily_prices(api_key=p_key, force_seed=force_seed, allow_continuity_fallback=True)
        results["model_reload"] = price_model.reload_prices()
    except Exception as e:
        results["price_error"] = str(e)

    try:
        results["weather_sync"] = sync_daily_weather(api_key=w_key)
        price_model.reload_prices()
    except Exception as e:
        results["weather_error"] = str(e)

    # Trigger daily feedback loop evaluation
    try:
        from models.feedback_loop import evaluate_daily_feedback
        eval_res = evaluate_daily_feedback(retrain_if_drift=retrain)
        results["feedback_evaluation"] = sanitize_for_json(eval_res)
    except Exception as e:
        results["feedback_error"] = str(e)

    return {"success": True, "results": sanitize_for_json(results)}


@app.post("/feedback/evaluate")
def run_feedback_evaluation_endpoint(
    req: Optional[FeedbackEvaluateRequest] = None,
    retrain_if_drift: Optional[bool] = None,
):
    """
    Run daily feedback evaluation: matches pending forecasts with verified market actuals,
    calculates MAPE/MAE/coverage, updates rolling bias calibration, and optionally retrains.
    """
    try:
        should_retrain = retrain_if_drift if retrain_if_drift is not None else (req.retrain_if_drift if req else True)
        from models.feedback_loop import evaluate_daily_feedback
        res = evaluate_daily_feedback(retrain_if_drift=should_retrain)
        if res.get("model_retrained"):
            price_model: PriceModel = get_price_model(app)
            price_model.reload_prices()
        return {"success": True, "data": sanitize_for_json(res)}
    except Exception as e:
        logger.error(f"Feedback evaluation failed: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@app.get("/feedback/metrics")
def get_feedback_metrics_endpoint():
    """Get high-level accuracy metrics, rolling calibration bias, and recent evaluations."""
    try:
        from models.feedback_loop import get_feedback_summary
        summary = get_feedback_summary()
        return {"success": True, "data": sanitize_for_json(summary)}
    except Exception as e:
        logger.error(f"Failed to retrieve feedback metrics: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@app.post("/feedback/retrain")
def trigger_feedback_retrain_endpoint():
    """Explicitly trigger continuous learning model retraining with newest daily data."""
    try:
        from models.feedback_loop import trigger_model_retrain
        success = trigger_model_retrain()
        if success:
            price_model: PriceModel = get_price_model(app)
            reload_meta = price_model.reload_prices()
            return {"success": True, "message": "Model retrained and reloaded successfully.", "reload": reload_meta}
        else:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Model retraining failed.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Retrain endpoint failed: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

