import logging
from datetime import datetime, timezone

from fastapi import HTTPException

from app.schemas import DisruptionPredictionRequest, DisruptionPredictionResponse
from ml import registry

logger = logging.getLogger(__name__)


def _heuristic_predict(payload: DisruptionPredictionRequest) -> tuple[float, float]:
    """Low-memory fallback when ML artifacts are unavailable in production.

    This avoids hard downtime on constrained instances (e.g., 512MB) where
    training or loading heavyweight ML dependencies may fail.
    """
    rain_score = min(1.0, payload.rainfall / 120.0)
    aqi_score = min(1.0, max(0.0, (payload.aqi - 80.0) / 320.0))
    traffic_score = min(1.0, max(0.0, (45.0 - payload.traffic_speed) / 40.0))
    dai_stress = min(1.0, max(0.0, (0.65 - payload.current_dai) / 0.65))

    disruption_probability = (
        0.35 * rain_score
        + 0.25 * aqi_score
        + 0.20 * traffic_score
        + 0.20 * dai_stress
    )
    disruption_probability = max(0.0, min(1.0, disruption_probability))
    predicted_dai = max(0.0, min(1.0, 1.0 - disruption_probability * 0.85))
    return predicted_dai, disruption_probability


def predict_disruption(payload: DisruptionPredictionRequest) -> DisruptionPredictionResponse:
    now = datetime.now(tz=timezone.utc)

    hour = payload.hour_of_day if payload.hour_of_day is not None else now.hour
    dow  = payload.day_of_week if payload.day_of_week is not None else now.weekday()

    # Provide all features that Model 1 and Model 2 may look up.
    # Optional fields use sensible Bangalore defaults so zone_simulation_service
    # can call predict_disruption with only the fields it knows (rainfall, AQI,
    # traffic_speed, current_dai) without triggering a KeyError.
    feature_map = {
        # ── Model 1 features ────────────────────────────────────────────
        "rainfall":               payload.rainfall,
        "temperature":            payload.temperature,          # default 30.0 from schema
        "wind_speed":             payload.wind_speed,            # default 10.0 from schema
        "aqi":                    payload.aqi,
        "average_traffic_speed":  payload.traffic_speed,
        "congestion_index":       payload.congestion_index,      # default 0.5 from schema
        "orders_last_5min":       payload.orders_last_5min,      # default 70.0 from schema
        "orders_last_15min":      payload.orders_last_15min,     # default 190.0 from schema
        "active_riders":          payload.active_riders,         # default 45.0 from schema
        "average_delivery_time":  payload.average_delivery_time, # default 24.0 from schema
        "hour_of_day":            hour,
        "day_of_week":            dow,
        # ── Shared / Model 2 extra features ─────────────────────────────
        # "traffic_speed" is the legacy column name used in MODEL_2_FEATURES;
        # keep both so either lookup path succeeds.
        "traffic_speed":                        payload.traffic_speed,
        "current_dai":                          payload.current_dai,
        "historical_disruption_frequency":      payload.historical_disruption_frequency,
        "zone_risk_score":                      payload.zone_risk_score,
    }

    try:
        predicted_dai, disruption_probability = registry.predict(feature_map)
    except KeyError as exc:
        logger.error(f"Missing feature in prediction input: {exc}")
        raise HTTPException(
            status_code=422,
            detail=f"Missing required model feature: {exc}",
        ) from exc
    except Exception as exc:
        logger.warning(
            "ML registry unavailable (%s). Falling back to heuristic scorer.",
            exc,
            exc_info=True,
        )
        predicted_dai, disruption_probability = _heuristic_predict(payload)

    risk_label = "normal"
    if disruption_probability >= 0.50:
        risk_label = "high"
    elif disruption_probability >= 0.40:  # matches threshold_analysis.json optimal threshold
        risk_label = "moderate"

    logger.info(
        f"Prediction | rainfall={payload.rainfall:.1f}mm AQI={payload.aqi:.0f} "
        f"traffic_speed={payload.traffic_speed:.0f} current_dai={payload.current_dai:.2f} "
        f"-> predicted_dai={predicted_dai:.3f} disruption_prob={disruption_probability:.3f} risk={risk_label}"
    )

    return DisruptionPredictionResponse(
        predicted_dai=predicted_dai,
        disruption_probability=disruption_probability,
        risk_label=risk_label,
    )
