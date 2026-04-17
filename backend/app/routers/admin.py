"""Admin utility endpoints — protected by ADMIN_API_KEY bearer token.

All /api/v1/admin/* routes require the header:
  Authorization: Bearer <ADMIN_API_KEY>

This matches the frontend admin layout PIN guard — the PIN is a UX layer,
while this is the actual server-side security boundary.

Endpoints:
  POST /api/v1/admin/refresh-zones           — regenerate zone conditions
  POST /api/v1/admin/simulate-disruption     — force extreme conditions + ML trigger
  GET  /api/v1/admin/zone-status             — all zone snapshots with ML risk labels
"""

import logging
import os

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.domain import ZoneSnapshot
from app.schemas import DisruptionPredictionRequest
from app.services.ml_service import predict_disruption
from app.services.zone_simulation_service import refresh_all_zones

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/admin", tags=["admin"])

# Parametric trigger constants — keep in sync with triggers.py
_DISRUPTION_THRESHOLD = 0.40
_DEFAULT_PAYOUT_INR = 600.0
_DEFAULT_ELIGIBLE_RIDERS = 85


def _require_admin(authorization: str | None = Header(default=None)) -> None:
    """Validate Bearer token against ADMIN_API_KEY env var.

    In development, if ADMIN_API_KEY is not set, all requests are allowed
    so local dev doesn't require extra setup. In production (Render), the
    env var MUST be set or the startup check will log a warning.
    """
    api_key = os.getenv("ADMIN_API_KEY")
    if not api_key:
        # No key configured — allow all (dev mode). Log so it's visible.
        logger.debug("ADMIN_API_KEY not set — admin routes are unprotected (dev mode).")
        return

    expected = f"Bearer {api_key}"
    if authorization != expected:
        raise HTTPException(
            status_code=401,
            detail="Admin access requires a valid Authorization: Bearer <ADMIN_API_KEY> header.",
        )


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
    _: None = Depends(_require_admin),
) -> list[dict]:
    """Regenerate zone conditions for all zones (admin only)."""
    _require_db(request)
    try:
        results = refresh_all_zones(db)
        logger.info("Admin: refreshed %d zone snapshots", len(results))
        return results
    except Exception as exc:
        logger.error("Zone refresh failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Zone refresh failed: {exc}") from exc


@router.post("/simulate-disruption", response_model=dict)
async def simulate_disruption(
    payload: SimulateDisruptionRequest,
    request: Request,
    db: Session = Depends(get_db),
    _: None = Depends(_require_admin),
) -> dict:
    """Force extreme conditions in a zone and run the full trigger pipeline (admin only)."""
    _require_db(request)
    try:
        results = refresh_all_zones(db, force_disruption_zone=payload.zone_name)
        disrupted = next((r for r in results if r["zone_name"] == payload.zone_name), None)
        logger.info("Admin: simulated disruption in %r — conditions: %s", payload.zone_name, disrupted)

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
                traffic_speed = float(max(5, 80 - disrupted.get("traffic_index", 90)))

                ml_req = DisruptionPredictionRequest(
                    rainfall=rainfall, AQI=aqi, traffic_speed=traffic_speed, current_dai=dai,
                )
                prediction = predict_disruption(ml_req)
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
                        reasons.append(f"ML probability {prediction.disruption_probability:.0%}")
                    trigger_reason = " · ".join(reasons) if reasons else "Disruption confirmed by ML model"
                    trigger_result["trigger_reason"] = trigger_reason

                    zone = db.query(Zone).filter(Zone.name == payload.zone_name).first()
                    if zone is None:
                        zone = Zone(
                            name=payload.zone_name, city="Bangalore",
                            baseline_orders_per_hour=80, baseline_active_riders=40,
                            baseline_delivery_time_minutes=25, risk_level="high",
                        )
                        db.add(zone)
                        db.flush()

                    disruption = Disruption(
                        zone_id=zone.id, event_type="parametric_trigger",
                        severity=prediction.risk_label, rainfall=rainfall, aqi=aqi,
                        average_traffic_speed=traffic_speed, zone_dai=dai,
                    )
                    db.add(disruption)
                    db.flush()

                    event = record_payout_event(
                        db=db, zone_name=payload.zone_name, trigger_reason=trigger_reason,
                        payout_amount_inr=_DEFAULT_PAYOUT_INR, eligible_riders=_DEFAULT_ELIGIBLE_RIDERS,
                    )
                    payout_event_id = event.id
            except Exception as trigger_exc:
                logger.error("Auto-trigger evaluation failed after simulation: %s", trigger_exc, exc_info=True)

        return {
            "message": f"Disruption conditions injected into {payload.zone_name!r}",
            "zone_conditions": disrupted,
            "trigger": trigger_result,
            "payout_event_id": payout_event_id,
        }
    except Exception as exc:
        logger.error("Disruption simulation failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/zone-status", response_model=list[ZoneStatusEntry])
async def get_zone_status(
    request: Request,
    db: Session = Depends(get_db),
    _: None = Depends(_require_admin),
) -> list[ZoneStatusEntry]:
    """Return all zone snapshots with ML risk labels (admin only)."""
    _require_db(request)
    snaps = db.query(ZoneSnapshot).order_by(ZoneSnapshot.zone_name.asc()).all()
    if not snaps:
        refresh_all_zones(db)
        snaps = db.query(ZoneSnapshot).order_by(ZoneSnapshot.zone_name.asc()).all()

    results = []
    for snap in snaps:
        try:
            estimated_speed = max(5.0, 80.0 - snap.traffic_index * 0.75)
            ml_req = DisruptionPredictionRequest(
                rainfall=snap.rainfall_mm, AQI=float(snap.aqi),
                traffic_speed=estimated_speed, current_dai=snap.dai,
            )
            pred = predict_disruption(ml_req)
            risk_label, disruption_prob = pred.risk_label, pred.disruption_probability
        except Exception:
            risk_label, disruption_prob = "unknown", 0.0

        results.append(ZoneStatusEntry(
            zone_name=snap.zone_name, rainfall_mm=snap.rainfall_mm, aqi=snap.aqi,
            traffic_index=snap.traffic_index, dai=snap.dai, workability_score=snap.workability_score,
            risk_label=risk_label, disruption_probability=round(disruption_prob, 3),
            updated_at=snap.updated_at.isoformat() if snap.updated_at else "",
        ))

    return results
