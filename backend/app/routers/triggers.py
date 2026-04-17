"""Parametric trigger evaluation router.

Evaluates real-time zone conditions through the ML model.
When disruption_probability >= 0.4 (optimal threshold from threshold analysis),
a Disruption record is created and a PayoutEvent is persisted — implementing the
documented flow: Disruption detected → Payout triggered.

Phase 3 addition: concurrent disruption detection.
If other zones also have DAI < 0.5 at trigger time, the event is flagged as
concurrent — indicating a city-wide condition (heavy storm, AQI emergency)
vs an isolated hyper-local event.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.disruption import Disruption
from app.models.domain import ZoneSnapshot
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
# DAI below this in other zones = they are also disrupted (concurrent check)
_CONCURRENT_DAI_THRESHOLD = 0.50


def _detect_concurrent_zones(db: Session, triggering_zone_id: int) -> list[str]:
    """Return zone names that are currently disrupted (DAI < 0.5), excluding the trigger zone.

    Queries ZoneSnapshot for any zone with DAI below the concurrent threshold.
    These zones are simultaneously under stress — flagging helps classify the
    event as city-wide vs isolated.
    """
    # Get the name of the triggering zone (to exclude it from the concurrent list)
    trigger_zone = db.query(Zone).filter(Zone.id == triggering_zone_id).first()
    trigger_name = trigger_zone.name if trigger_zone else ""

    disrupted_snaps = (
        db.query(ZoneSnapshot)
        .filter(ZoneSnapshot.dai < _CONCURRENT_DAI_THRESHOLD)
        .all()
    )
    return [
        snap.zone_name
        for snap in disrupted_snaps
        if snap.zone_name != trigger_name
    ]


@router.post("/evaluate", response_model=TriggerEvaluateResponse)
async def evaluate_parametric_trigger(
    payload: TriggerEvaluateRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> TriggerEvaluateResponse:
    """Evaluate trigger conditions and auto-fire a payout if disruption threshold is met.

    Flow: payload → ML predict-disruption → if prob >= 0.4 → create Disruption record
          → detect concurrent zones → record PayoutEvent → return.
    """
    if not getattr(request.app.state, "database_ready", False):
        raise HTTPException(status_code=503, detail="Database is unavailable.")

    # ── Policy-aware threshold selection ────────────────────────────────────
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
    concurrent_zone_names: list[str] = []
    is_concurrent = False

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
            # ── Step 1: Resolve zone ──────────────────────────────────────────
            zone_name = f"Zone-{payload.zone_id}"
            zone = db.query(Zone).filter(Zone.name == zone_name).first()
            if zone is None:
                zone = Zone(
                    name=zone_name,
                    city="Unknown",
                    baseline_orders_per_hour=0,
                    baseline_active_riders=0,
                    baseline_delivery_time_minutes=0,
                    risk_level="high",
                )
                db.add(zone)
                db.flush()

            # ── Step 2: Detect concurrent disruptions ────────────────────────
            # Check which other zones are also under stress right now.
            concurrent_zone_names = _detect_concurrent_zones(db, zone.id)
            is_concurrent = len(concurrent_zone_names) > 0

            if is_concurrent:
                logger.info(
                    "Concurrent disruption detected | trigger_zone=%s concurrent=%s",
                    zone_name, concurrent_zone_names,
                )

            # ── Step 3: Create Disruption record ─────────────────────────────
            disruption = Disruption(
                zone_id=zone.id,
                event_type="parametric_trigger",
                severity=prediction.risk_label,
                rainfall=payload.rainfall,
                aqi=payload.aqi,
                average_traffic_speed=payload.traffic_speed,
                zone_dai=payload.current_dai,
                is_concurrent=is_concurrent,
                concurrent_zones=",".join(concurrent_zone_names) if concurrent_zone_names else None,
            )
            db.add(disruption)
            db.flush()

            # ── Step 4: Record PayoutEvent ───────────────────────────────────
            event = record_payout_event(
                db=db,
                zone_name=zone_name,
                trigger_reason=trigger_reason,
                payout_amount_inr=payout_inr,
                eligible_riders=DEFAULT_ELIGIBLE_RIDERS,
            )
            payout_event_id = event.id
            logger.info(
                "Parametric trigger FIRED | zone_id=%s zone_name=%r "
                "disruption_id=%s prob=%.3f payout_event=%s concurrent=%s",
                payload.zone_id, zone_name, disruption.id,
                prediction.disruption_probability, payout_event_id,
                concurrent_zone_names or "none",
            )
        except Exception as exc:
            logger.error("Failed to record disruption/payout event: %s", exc)
            raise HTTPException(
                status_code=500,
                detail="Trigger fired but disruption/payout could not be recorded.",
            ) from exc
    else:
        logger.info(
            "Parametric trigger evaluated | zone_id=%s prob=%.3f — below threshold, no trigger",
            payload.zone_id, prediction.disruption_probability,
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
        is_concurrent=is_concurrent,
        concurrent_zone_names=concurrent_zone_names,
    )
