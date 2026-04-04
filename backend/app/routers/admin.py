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
from app.models.domain import ZoneSnapshot
from app.schemas import DisruptionPredictionRequest
from app.services.ml_service import predict_disruption
from app.services.zone_simulation_service import refresh_all_zones

logger = logging.getLogger(__name__)
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
    All other zones refresh normally.
    """
    _require_db(request)
    try:
        results = refresh_all_zones(db, force_disruption_zone=payload.zone_name)
        disrupted = next((r for r in results if r["zone_name"] == payload.zone_name), None)
        logger.info(f"Admin: simulated disruption in {payload.zone_name!r} — conditions: {disrupted}")
        return {
            "message": f"Disruption conditions injected into {payload.zone_name!r}",
            "zone_conditions": disrupted,
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
