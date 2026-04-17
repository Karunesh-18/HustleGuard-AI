"""Mobility router — GPS location logging from the mobile app.

GPS is mandatory for HustleGuard — users must grant location permission
to register and use the app. These endpoints are called by the frontend
using the native browser Geolocation API (navigator.geolocation).

Endpoints:
  POST /api/v1/mobility/log       — log a GPS ping (called on app open, claim, trigger ack)
  GET  /api/v1/mobility/{rider_id}/recent  — last 10 pings for a rider (admin / debug)
  POST /api/v1/mobility/teleport-check     — compute teleport risk for inline fraud scoring
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.mobility_service import (
    get_recent_logs,
    get_teleport_risk,
    get_zone_visit_count,
    log_location,
    resolve_zone_from_coords,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/mobility", tags=["mobility"])

_DB_GUARD = "Database is unavailable."


# ── Schemas ───────────────────────────────────────────────────────────────────

class LocationLogRequest(BaseModel):
    rider_id: int = Field(gt=0)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    accuracy_metres: float | None = Field(default=None, ge=0, le=50000)
    source: str = Field(default="gps", description="'gps' | 'ip'")
    context: str | None = Field(default=None, description="'app_open' | 'claim' | 'trigger_ack'")


class LocationLogResponse(BaseModel):
    id: int
    rider_id: int
    latitude: float
    longitude: float
    zone_name: str | None
    source: str
    context: str | None
    logged_at: str


class TeleportCheckRequest(BaseModel):
    rider_id: int = Field(gt=0)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class TeleportCheckResponse(BaseModel):
    distance_km: float
    elapsed_seconds: int
    speed_kmh: float
    is_suspicious: bool
    last_zone: str | None
    current_zone: str | None
    zone_visit_count_30d: int


class RecentLogEntry(BaseModel):
    id: int
    latitude: float
    longitude: float
    zone_name: str | None
    source: str
    context: str | None
    logged_at: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/log", response_model=LocationLogResponse)
async def log_gps_ping(
    payload: LocationLogRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> LocationLogResponse:
    """Log a GPS ping from the mobile app.

    Called automatically by the frontend on:
    - App open / foreground (context='app_open')
    - Manual distress claim form open (context='claim')
    - Trigger acknowledgement (context='trigger_ack')

    GPS is mandatory — the frontend must obtain permission before calling this.
    """
    if not getattr(request.app.state, "database_ready", False):
        raise HTTPException(status_code=503, detail=_DB_GUARD)

    entry = log_location(
        db=db,
        rider_id=payload.rider_id,
        latitude=payload.latitude,
        longitude=payload.longitude,
        accuracy_metres=payload.accuracy_metres,
        source=payload.source,
        context=payload.context,
    )
    return LocationLogResponse(
        id=entry.id,
        rider_id=entry.rider_id,
        latitude=entry.latitude,
        longitude=entry.longitude,
        zone_name=entry.zone_name,
        source=entry.source,
        context=entry.context,
        logged_at=entry.logged_at.isoformat(),
    )


@router.post("/teleport-check", response_model=TeleportCheckResponse)
async def check_teleport(
    payload: TeleportCheckRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> TeleportCheckResponse:
    """Compute teleport risk between last known GPS and current location.

    Used by the fraud engine when evaluating a claim. Returns:
    - distance and speed since last ping
    - is_suspicious flag (speed > 80km/h in city = likely fraud)
    - zone familiarity count (visits to claim zone in last 30d)
    """
    if not getattr(request.app.state, "database_ready", False):
        raise HTTPException(status_code=503, detail=_DB_GUARD)

    risk = get_teleport_risk(db, payload.rider_id, payload.latitude, payload.longitude)
    current_zone = resolve_zone_from_coords(payload.latitude, payload.longitude)
    visit_count = get_zone_visit_count(db, payload.rider_id, current_zone or "") if current_zone else 0

    return TeleportCheckResponse(
        distance_km=risk["distance_km"],
        elapsed_seconds=risk["elapsed_seconds"],
        speed_kmh=risk["speed_kmh"],
        is_suspicious=risk["is_suspicious"],
        last_zone=risk["last_zone"],
        current_zone=current_zone,
        zone_visit_count_30d=visit_count,
    )


@router.get("/{rider_id}/recent", response_model=list[RecentLogEntry])
async def get_recent_location_logs(
    rider_id: int,
    request: Request,
    db: Session = Depends(get_db),
) -> list[RecentLogEntry]:
    """Return the last 10 GPS pings for a rider (admin / debug use)."""
    if not getattr(request.app.state, "database_ready", False):
        raise HTTPException(status_code=503, detail=_DB_GUARD)

    logs = get_recent_logs(db, rider_id, limit=10)
    return [
        RecentLogEntry(
            id=l.id,
            latitude=l.latitude,
            longitude=l.longitude,
            zone_name=l.zone_name,
            source=l.source,
            context=l.context,
            logged_at=l.logged_at.isoformat(),
        )
        for l in logs
    ]
