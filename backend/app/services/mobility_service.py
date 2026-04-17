"""Mobility service — GPS location logging and teleport risk scoring.

GPS is mandatory for HustleGuard. This service:
  - Persists location logs from the mobile app
  - Computes teleport speed (km/h between last two pings)
  - Scores zone familiarity (how many prior pings in this zone)
  - Resolves which zone a lat/lon falls within (nearest centroid match)

Used by claim_service.py to replace the hardcoded fraud signal defaults
with real location evidence from the DB.
"""

import logging
import math
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from app.models.rider_location_log import RiderLocationLog

logger = logging.getLogger(__name__)

# ── Bangalore zone centroids (lat, lon) — used for nearest-zone resolution ────
# These are approximate town-centre coordinates for each seeded zone.
_ZONE_CENTROIDS: dict[str, tuple[float, float]] = {
    "Koramangala":  (12.9352, 77.6245),
    "HSR Layout":   (12.9116, 77.6389),
    "Indiranagar":  (12.9719, 77.6412),
    "Whitefield":   (12.9698, 77.7499),
    "Electronic City": (12.8399, 77.6770),
    "Bellandur":    (12.9256, 77.6763),
    "Marathahalli": (12.9591, 77.6974),
    "BTM Layout":   (12.9165, 77.6101),
    "Jayanagar":    (12.9299, 77.5831),
    "Yelahanka":    (13.1005, 77.5963),
}

# Teleport speed above this is flagged as suspicious (ambulance ~ 60km/h in city)
_TELEPORT_SPEED_THRESHOLD_KMPH = 80.0

# Minimum seconds between pings before teleport check makes sense
_MIN_SECONDS_FOR_SPEED_CHECK = 30


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine great-circle distance in kilometres."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def resolve_zone_from_coords(lat: float, lon: float) -> Optional[str]:
    """Return the name of the nearest seeded zone centroid within 5km.

    Returns None if no zone is close enough (e.g. rider is outside Bangalore).
    """
    best_zone: Optional[str] = None
    best_dist = float("inf")
    for zone, (clat, clon) in _ZONE_CENTROIDS.items():
        d = _haversine_km(lat, lon, clat, clon)
        if d < best_dist:
            best_dist = d
            best_zone = zone
    # Only claim the zone if within 5km — avoids assigning zones to riders in other cities
    return best_zone if best_dist <= 5.0 else None


def log_location(
    db: Session,
    rider_id: int,
    latitude: float,
    longitude: float,
    accuracy_metres: Optional[float] = None,
    source: str = "gps",
    context: Optional[str] = None,
) -> RiderLocationLog:
    """Insert a GPS ping into rider_location_logs and return the row."""
    zone_name = resolve_zone_from_coords(latitude, longitude)
    entry = RiderLocationLog(
        rider_id=rider_id,
        latitude=latitude,
        longitude=longitude,
        accuracy_metres=accuracy_metres,
        zone_name=zone_name,
        source=source,
        context=context,
        logged_at=datetime.utcnow(),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    logger.debug(
        "Location logged | rider=%s lat=%.4f lon=%.4f zone=%r source=%s context=%s",
        rider_id, latitude, longitude, zone_name, source, context,
    )
    return entry


def get_recent_logs(db: Session, rider_id: int, limit: int = 10) -> list[RiderLocationLog]:
    """Return the most recent location logs for a rider (newest first)."""
    return (
        db.query(RiderLocationLog)
        .filter(RiderLocationLog.rider_id == rider_id)
        .order_by(RiderLocationLog.logged_at.desc())
        .limit(limit)
        .all()
    )


def get_teleport_risk(
    db: Session,
    rider_id: int,
    current_lat: float,
    current_lon: float,
) -> dict:
    """Compute teleport risk relative to the last known GPS ping.

    Returns:
        distance_km: Great-circle distance from last ping
        elapsed_seconds: Time since last ping
        speed_kmh: Computed travel speed
        is_suspicious: True when speed exceeds realistic mobility threshold
        last_zone: Zone name from the most recent prior ping (None if first ping)
    """
    last = (
        db.query(RiderLocationLog)
        .filter(RiderLocationLog.rider_id == rider_id)
        .order_by(RiderLocationLog.logged_at.desc())
        .first()
    )
    if last is None:
        return {
            "distance_km": 0.0,
            "elapsed_seconds": 0,
            "speed_kmh": 0.0,
            "is_suspicious": False,
            "last_zone": None,
        }

    dist = _haversine_km(last.latitude, last.longitude, current_lat, current_lon)
    elapsed = max(1, (datetime.utcnow() - last.logged_at).total_seconds())
    speed = (dist / elapsed) * 3600  # km/h

    suspicious = elapsed >= _MIN_SECONDS_FOR_SPEED_CHECK and speed > _TELEPORT_SPEED_THRESHOLD_KMPH
    if suspicious:
        logger.warning(
            "Teleport detected | rider=%s dist=%.2fkm elapsed=%ds speed=%.0fkm/h",
            rider_id, dist, elapsed, speed,
        )

    return {
        "distance_km": round(dist, 3),
        "elapsed_seconds": int(elapsed),
        "speed_kmh": round(speed, 1),
        "is_suspicious": suspicious,
        "last_zone": last.zone_name,
    }


def get_zone_visit_count(
    db: Session,
    rider_id: int,
    zone_name: str,
    lookback_days: int = 30,
) -> int:
    """Count how many GPS pings the rider has in this zone in the last N days.

    High count = zone is familiar (fraud risk reduced).
    Zero or low count = unusual claim location (fraud risk elevated).
    """
    since = datetime.utcnow() - timedelta(days=lookback_days)
    count = (
        db.query(RiderLocationLog)
        .filter(
            RiderLocationLog.rider_id == rider_id,
            RiderLocationLog.zone_name == zone_name,
            RiderLocationLog.logged_at >= since,
        )
        .count()
    )
    return count
