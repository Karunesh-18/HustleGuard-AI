import logging
from datetime import datetime, timezone

from fastapi import HTTPException

from app.schemas import DisruptionPredictionRequest, DisruptionPredictionResponse
from ml import registry

logger = logging.getLogger(__name__)


def predict_disruption(payload: DisruptionPredictionRequest) -> DisruptionPredictionResponse:
    now = datetime.now(tz=timezone.utc)

    feature_map = {
        "rainfall": payload.rainfall,
        "temperature": payload.temperature,
        "wind_speed": payload.wind_speed,
        "aqi": payload.aqi,
        "average_traffic_speed": payload.traffic_speed,
        # MODEL_2_FEATURES uses "traffic_speed" — keep both keys so either lookup succeeds
        "traffic_speed": payload.traffic_speed,
        "congestion_index": payload.congestion_index,
        "orders_last_5min": payload.orders_last_5min,
        "orders_last_15min": payload.orders_last_15min,
        "active_riders": payload.active_riders,
        "average_delivery_time": payload.average_delivery_time,
        "hour_of_day": payload.hour_of_day if payload.hour_of_day is not None else now.hour,
        "day_of_week": payload.day_of_week if payload.day_of_week is not None else now.weekday(),
        "current_dai": payload.current_dai,
        "historical_disruption_frequency": payload.historical_disruption_frequency,
        "zone_risk_score": payload.zone_risk_score,
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
        logger.error(f"ML prediction failed: {exc}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="ML prediction service unavailable — see server logs.",
        ) from exc

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
