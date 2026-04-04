"""Parametric trigger evaluation router.

Evaluates real-time zone conditions through the ML model.
When disruption_probability >= 0.4 (optimal threshold from threshold analysis),
a Disruption record is created and a PayoutEvent is persisted — implementing the
documented flow: Disruption detected → Payout triggered.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.disruption import Disruption
from app.models.zone import Zone
from app.schemas import DisruptionPredictionRequest, TriggerEvaluateRequest, TriggerEvaluateResponse
from app.services.domain_service import record_payout_event
from app.services.ml_service import predict_disruption
from app.services.policy_service import get_trigger_thresholds_for_rider

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/triggers", tags=["triggers"])

# Parametric trigger threshold — matches threshold_analysis.json optimal value
DISRUPTION_THRESHOLD = 0.40
# Estimated riders eligible per zone disruption event (would be dynamic in production)
DEFAULT_ELIGIBLE_RIDERS = 85
# Default payout per event (INR)
DEFAULT_PAYOUT_INR = 600.0


@router.post("/evaluate", response_model=TriggerEvaluateResponse)
async def evaluate_parametric_trigger(
    payload: TriggerEvaluateRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> TriggerEvaluateResponse:
    """Evaluate trigger conditions and auto-fire a payout if disruption threshold is met.

    Flow: payload → ML predict-disruption → if prob >= 0.4 → create Disruption record
          → record PayoutEvent → return.
    """
    if not getattr(request.app.state, "database_ready", False):
        raise HTTPException(status_code=503, detail="Database is unavailable.")

    # ── Policy-aware threshold selection ────────────────────────────────────
    # If rider_id is provided, use their policy tier's thresholds.
    # Riders on Premium Armor fire earlier (DAI < 0.50), Basic Shield only at DAI < 0.35.
    policy_thresholds = None
    policy_name = None
    if payload.rider_id:
        policy_thresholds = get_trigger_thresholds_for_rider(db, payload.rider_id)
        policy_name = policy_thresholds.get("policy_name")

    dai_threshold = policy_thresholds["dai_threshold"] if policy_thresholds else DISRUPTION_THRESHOLD
    rainfall_threshold = policy_thresholds["rainfall_threshold"] if policy_thresholds else 80.0
    aqi_threshold = policy_thresholds["aqi_threshold"] if policy_thresholds else 300.0
    payout_inr = policy_thresholds["payout_inr"] if policy_thresholds else DEFAULT_PAYOUT_INR

    # Build ML prediction request from trigger payload
    ml_request = DisruptionPredictionRequest(
        rainfall=payload.rainfall,
        AQI=payload.aqi,
        traffic_speed=payload.traffic_speed,
        current_dai=payload.current_dai,
    )
    prediction = predict_disruption(ml_request)

    # Trigger fires if ML probability is high OR if any single threshold is breached
    ml_triggered = prediction.disruption_probability >= dai_threshold
    threshold_triggered = (
        payload.current_dai < dai_threshold
        or payload.rainfall > rainfall_threshold
        or payload.aqi > aqi_threshold
    )
    triggered = ml_triggered or threshold_triggered
    payout_event_id: int | None = None
    trigger_reason: str | None = None

    if triggered:
        # Build a human-readable trigger reason
        reasons = []
        if payload.rainfall > rainfall_threshold:
            reasons.append(f"Rainfall {payload.rainfall:.0f}mm > {rainfall_threshold:.0f}mm threshold")
        if payload.aqi > aqi_threshold:
            reasons.append(f"AQI {payload.aqi:.0f} > {aqi_threshold:.0f} threshold")
        if payload.traffic_speed < 10:
            reasons.append(f"Traffic speed {payload.traffic_speed:.0f} km/h < 10 km/h threshold")
        if payload.current_dai < dai_threshold:
            reasons.append(f"DAI {payload.current_dai:.2f} < {dai_threshold:.2f} threshold ({policy_name or 'default'})")
        trigger_reason = " · ".join(reasons) if reasons else f"Disruption probability {prediction.disruption_probability:.0%}"

        try:
            # ── Step 1: Create a Disruption record (zone-linked) ──────────────
            # Look up or create the Zone row for FK linkage.
            zone_name = f"Zone-{payload.zone_id}"
            zone = db.query(Zone).filter(Zone.name == zone_name).first()
            if zone is None:
                # Auto-provision a minimal zone entry so the FK constraint is satisfied.
                zone = Zone(
                    name=zone_name,
                    city="Unknown",
                    baseline_orders_per_hour=0,
                    baseline_active_riders=0,
                    baseline_delivery_time_minutes=0,
                    risk_level="high",
                )
                db.add(zone)
                db.flush()  # get zone.id without committing yet

            disruption = Disruption(
                zone_id=zone.id,
                event_type="parametric_trigger",
                severity=prediction.risk_label,
                rainfall=payload.rainfall,
                aqi=payload.aqi,
                average_traffic_speed=payload.traffic_speed,
                zone_dai=payload.current_dai,
            )
            db.add(disruption)
            db.flush()  # get disruption.id before payout record

            # ── Step 2: Record PayoutEvent (linked to the disruption zone) ───
            event = record_payout_event(
                db=db,
                zone_name=zone_name,
                trigger_reason=trigger_reason,
                payout_amount_inr=payout_inr,
                eligible_riders=DEFAULT_ELIGIBLE_RIDERS,
            )
            payout_event_id = event.id
            logger.info(
                f"Parametric trigger FIRED | zone_id={payload.zone_id} zone_name={zone_name!r} "
                f"disruption_id={disruption.id} prob={prediction.disruption_probability:.3f} "
                f"payout_event={payout_event_id}"
            )
        except Exception as exc:
            logger.error(f"Failed to record disruption/payout event: {exc}")
            raise HTTPException(status_code=500, detail="Trigger fired but disruption/payout could not be recorded.") from exc
    else:
        logger.info(
            f"Parametric trigger evaluated | zone_id={payload.zone_id} "
            f"prob={prediction.disruption_probability:.3f} — below threshold, no trigger"
        )

    return TriggerEvaluateResponse(
        triggered=triggered,
        disruption_probability=prediction.disruption_probability,
        predicted_dai=prediction.predicted_dai,
        risk_label=prediction.risk_label,
        trigger_reason=trigger_reason,
        payout_event_id=payout_event_id,
        policy_name=policy_name,
        dai_threshold_used=round(dai_threshold, 2),
    )
