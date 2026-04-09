"""Admin utility endpoints.

Provides tools for demo control and zone data management.

Endpoints:
  POST /api/v1/admin/refresh-zones           — regenerate synthetic zone conditions for all zones
  POST /api/v1/admin/simulate-disruption     — force extreme conditions in one zone (for live demo)
                                               also evaluates the ML trigger and records a PayoutEvent
  GET  /api/v1/admin/zone-status             — current snapshot + ML risk label for all zones
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.disruption import Disruption
from app.models.domain import ZoneSnapshot
from app.models.zone import Zone
from app.schemas import DisruptionPredictionRequest
from app.services.domain_service import record_payout_event
from app.services.ml_service import predict_disruption
from app.services.zone_simulation_service import refresh_all_zones

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/admin", tags=["admin"])

# Parametric trigger constants — keep in sync with triggers.py
_DISRUPTION_THRESHOLD = 0.40
_DEFAULT_PAYOUT_INR = 600.0
_DEFAULT_ELIGIBLE_RIDERS = 85


class SimulateDisruptionRequest(BaseModel):
    zone_name: str = Field(description="Zone to push into disruption state")


class ZoneStatusEntry(BaseModel):
    zone_name: str
    rainfall_mm: float
    aqi: int
    traffic_index: int
    dai: float
    workability_score: int
    risk_label: str
    disruption_probability: float
    updated_at: str


def _require_db(request: Request) -> None:
    if not getattr(request.app.state, "database_ready", False):
        raise HTTPException(status_code=503, detail="Database is unavailable.")


@router.post("/refresh-zones", response_model=list[dict])
async def refresh_zone_conditions(
    request: Request,
    db: Session = Depends(get_db),
) -> list[dict]:
    """Regenerate synthetic zone conditions for all zones and update ZoneSnapshot table.

    Conditions vary by current time-of-day (IST), zone risk profile, and random noise.
    The ML model computes the resulting DAI for each zone from the raw conditions.
    """
    _require_db(request)
    try:
        results = refresh_all_zones(db)
        logger.info(f"Admin: refreshed {len(results)} zone snapshots")
        return results
    except Exception as exc:
        logger.error(f"Zone refresh failed: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Zone refresh failed: {exc}") from exc


@router.post("/simulate-disruption", response_model=dict)
async def simulate_disruption(
    payload: SimulateDisruptionRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    """Force extreme weather/AQI/traffic conditions in a specific zone.

    Used during live demos to show the system detecting a disruption,
    running the ML trigger pipeline, and recording a PayoutEvent — all in real time.
    All other zones refresh normally.
    """
    _require_db(request)
    try:
        results = refresh_all_zones(db, force_disruption_zone=payload.zone_name)
        disrupted = next((r for r in results if r["zone_name"] == payload.zone_name), None)
        logger.info(f"Admin: simulated disruption in {payload.zone_name!r} — conditions: {disrupted}")

        # ── Auto-fire the parametric trigger pipeline ────────────────────────
        # After injecting extreme conditions, evaluate the ML model and record
        # a PayoutEvent if disruption is confirmed.  This closes the loop:
        # simulate-disruption → ML check → Disruption record → PayoutEvent feed.
        payout_event_id = None
        trigger_result = None
        if disrupted:
            try:
                from app.models.disruption import Disruption
                from app.models.zone import Zone
                from app.services.domain_service import record_payout_event

                dai = float(disrupted.get("dai", 0.2))
                rainfall = float(disrupted.get("rainfall_mm", 90.0))
                aqi = float(disrupted.get("aqi", 350))
                # traffic_index 0-100 → speed km/h (inverted: high index = gridlock = low speed)
                traffic_speed = float(max(5, 80 - disrupted.get("traffic_index", 90)))

                ml_req = DisruptionPredictionRequest(
                    rainfall=rainfall,
                    AQI=aqi,
                    traffic_speed=traffic_speed,
                    current_dai=dai,
                )
                prediction = predict_disruption(ml_req)

                # Trigger fires if ML probability or any hard threshold is breached
                triggered = (
                    prediction.disruption_probability >= _DISRUPTION_THRESHOLD
                    or dai < _DISRUPTION_THRESHOLD
                    or rainfall > 80.0
                    or aqi > 300.0
                )

                trigger_result = {
                    "triggered": triggered,
                    "disruption_probability": round(prediction.disruption_probability, 3),
                    "predicted_dai": round(prediction.predicted_dai, 3),
                    "risk_label": prediction.risk_label,
                }

                if triggered:
                    reasons = []
                    if rainfall > 80.0:
                        reasons.append(f"Rainfall {rainfall:.0f}mm > 80mm threshold")
                    if aqi > 300.0:
                        reasons.append(f"AQI {aqi:.0f} > 300 threshold")
                    if dai < _DISRUPTION_THRESHOLD:
                        reasons.append(f"DAI {dai:.2f} < {_DISRUPTION_THRESHOLD:.2f} threshold")
                    if prediction.disruption_probability >= _DISRUPTION_THRESHOLD:
                        reasons.append(
                            f"ML disruption probability {prediction.disruption_probability:.0%}"
                        )
                    trigger_reason = " · ".join(reasons) if reasons else "Disruption confirmed by ML model"
                    trigger_result["trigger_reason"] = trigger_reason

                    # Ensure a Zone row exists for FK linkage
                    zone_name = payload.zone_name
                    zone = db.query(Zone).filter(Zone.name == zone_name).first()
                    if zone is None:
                        zone = Zone(
                            name=zone_name,
                            city="Bangalore",
                            baseline_orders_per_hour=80,
                            baseline_active_riders=40,
                            baseline_delivery_time_minutes=25,
                            risk_level="high",
                        )
                        db.add(zone)
                        db.flush()

                    # Create Disruption record
                    disruption = Disruption(
                        zone_id=zone.id,
                        event_type="parametric_trigger",
                        severity=prediction.risk_label,
                        rainfall=rainfall,
                        aqi=aqi,
                        average_traffic_speed=traffic_speed,
                        zone_dai=dai,
                    )
                    db.add(disruption)
                    db.flush()

                    # Record PayoutEvent — this is what appears on the payout feed
                    event = record_payout_event(
                        db=db,
                        zone_name=zone_name,
                        trigger_reason=trigger_reason,
                        payout_amount_inr=_DEFAULT_PAYOUT_INR,
                        eligible_riders=_DEFAULT_ELIGIBLE_RIDERS,
                    )
                    payout_event_id = event.id
                    logger.info(
                        f"Simulate-disruption trigger FIRED | zone={zone_name!r} "
                        f"dai={dai:.3f} prob={prediction.disruption_probability:.3f} "
                        f"payout_event={payout_event_id}"
                    )
                else:
                    logger.info(
                        f"Simulate-disruption evaluated — below threshold | zone={payload.zone_name!r} "
                        f"dai={dai:.3f} prob={prediction.disruption_probability:.3f}"
                    )
            except Exception as trigger_exc:
                # Trigger failure should not block the simulation response
                logger.error(
                    f"Auto-trigger evaluation failed after simulation: {trigger_exc}", exc_info=True
                )

        return {
            "message": f"Disruption simulated in {payload.zone_name!r}",
            "zone_conditions": disrupted,
            "trigger": trigger_result,
            "payout_event_id": payout_event_id,
        }
    except Exception as exc:
        logger.error(f"Disruption simulation failed: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/zone-status", response_model=list[ZoneStatusEntry])
async def get_zone_status(
    request: Request,
    db: Session = Depends(get_db),
) -> list[ZoneStatusEntry]:
    """Return all zone snapshots enriched with ML risk labels.

    Useful for the admin dashboard to show which zones are in high-risk state
    and what premiums riders in each zone are currently being quoted.
    """
    _require_db(request)
    snaps = db.query(ZoneSnapshot).order_by(ZoneSnapshot.zone_name.asc()).all()
    if not snaps:
        # No data yet — refresh first
        refresh_all_zones(db)
        snaps = db.query(ZoneSnapshot).order_by(ZoneSnapshot.zone_name.asc()).all()

    results = []
    for snap in snaps:
        try:
            estimated_speed = max(5.0, 80.0 - snap.traffic_index * 0.75)
            ml_req = DisruptionPredictionRequest(
                rainfall=snap.rainfall_mm,
                AQI=float(snap.aqi),
                traffic_speed=estimated_speed,
                current_dai=snap.dai,
            )
            pred = predict_disruption(ml_req)
            risk_label = pred.risk_label
            disruption_prob = pred.disruption_probability
        except Exception:
            risk_label = "unknown"
            disruption_prob = 0.0

        results.append(ZoneStatusEntry(
            zone_name=snap.zone_name,
            rainfall_mm=snap.rainfall_mm,
            aqi=snap.aqi,
            traffic_index=snap.traffic_index,
            dai=snap.dai,
            workability_score=snap.workability_score,
            risk_label=risk_label,
            disruption_probability=round(disruption_prob, 3),
            updated_at=snap.updated_at.isoformat() if snap.updated_at else "",
        ))

    return results
