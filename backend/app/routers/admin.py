"""Admin utility endpoints.

Provides tools for demo control and zone data management.

Endpoints:
  POST /api/v1/admin/refresh-zones           — regenerate synthetic zone conditions for all zones
  POST /api/v1/admin/simulate-disruption     — force extreme conditions in one zone (for live demo)
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

# Default eligible riders for a simulated disruption payout event
_SIM_ELIGIBLE_RIDERS = 85
_SIM_PAYOUT_INR = 600.0
router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


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
    updating premiums, and triggering the payout flow — all in real time.
    After refreshing zone conditions, this endpoint automatically runs the
    ML trigger evaluation on the disrupted zone and records a PayoutEvent
    so payments appear immediately in the admin dashboard.
    All other zones refresh normally.
    """
    _require_db(request)
    try:
        results = refresh_all_zones(db, force_disruption_zone=payload.zone_name)
        disrupted = next((r for r in results if r["zone_name"] == payload.zone_name), None)
        logger.info(f"Admin: simulated disruption in {payload.zone_name!r} — conditions: {disrupted}")

        # ── Auto-fire trigger evaluation so a PayoutEvent is recorded ────────
        payout_event_id: int | None = None
        trigger_reason: str | None = None
        disruption_probability: float = 0.0
        if disrupted:
            try:
                traffic_speed = float(max(5, 80 - disrupted["traffic_index"]))
                ml_req = DisruptionPredictionRequest(
                    rainfall=disrupted["rainfall_mm"],
                    AQI=float(disrupted["aqi"]),
                    traffic_speed=traffic_speed,
                    current_dai=disrupted["dai"],
                )
                pred = predict_disruption(ml_req)
                disruption_probability = pred.disruption_probability

                # Build trigger reason string
                reasons = []
                if disrupted["rainfall_mm"] > 80:
                    reasons.append(f"Rainfall {disrupted['rainfall_mm']:.0f}mm >{80:.0f}mm threshold")
                if disrupted["aqi"] > 300:
                    reasons.append(f"AQI {disrupted['aqi']} >300 threshold")
                if disrupted["dai"] < 0.40:
                    reasons.append(f"DAI {disrupted['dai']:.2f} < 0.40 threshold")
                trigger_reason = " · ".join(reasons) if reasons else f"Simulated disruption in {payload.zone_name} (prob {pred.disruption_probability:.0%})"

                # Create Disruption record
                zone_row = db.query(Zone).filter(Zone.name == payload.zone_name).first()
                if zone_row is None:
                    zone_row = Zone(
                        name=payload.zone_name,
                        city="Bangalore",
                        baseline_orders_per_hour=100,
                        baseline_active_riders=40,
                        baseline_delivery_time_minutes=25,
                        risk_level="high",
                    )
                    db.add(zone_row)
                    db.flush()

                disruption = Disruption(
                    zone_id=zone_row.id,
                    event_type="admin_simulation",
                    severity=pred.risk_label,
                    rainfall=disrupted["rainfall_mm"],
                    aqi=disrupted["aqi"],
                    average_traffic_speed=traffic_speed,
                    zone_dai=disrupted["dai"],
                )
                db.add(disruption)
                db.flush()

                event = record_payout_event(
                    db=db,
                    zone_name=payload.zone_name,
                    trigger_reason=trigger_reason,
                    payout_amount_inr=_SIM_PAYOUT_INR,
                    eligible_riders=_SIM_ELIGIBLE_RIDERS,
                )
                payout_event_id = event.id
                logger.info(
                    f"Admin simulation PAYOUT FIRED | zone={payload.zone_name!r} "
                    f"disruption_id={disruption.id} prob={pred.disruption_probability:.3f} "
                    f"payout_event={payout_event_id}"
                )
            except Exception as trigger_exc:
                logger.warning(f"Trigger evaluation failed during simulation: {trigger_exc}")
                # Non-fatal — zone conditions were refreshed; trigger just didn't fire

        return {
            "message": f"Disruption simulated in {payload.zone_name!r} — payout event #{payout_event_id} recorded",
            "zone_conditions": disrupted,
            "payout_event_id": payout_event_id,
            "trigger_reason": trigger_reason,
            "disruption_probability": round(disruption_probability, 3),
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
