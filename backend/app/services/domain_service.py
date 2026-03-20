from sqlalchemy.orm import Session

from app.models import Rider, Zone
from app.schemas import RiderCreate, ZoneCreate


def create_zone(db: Session, zone_in: ZoneCreate) -> Zone:
    zone = Zone(
        name=zone_in.name,
        city=zone_in.city,
        baseline_orders_per_hour=zone_in.baseline_orders_per_hour,
        baseline_active_riders=zone_in.baseline_active_riders,
        baseline_delivery_time_minutes=zone_in.baseline_delivery_time_minutes,
        risk_level=zone_in.risk_level,
    )
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return zone


def list_zones(db: Session) -> list[Zone]:
    return db.query(Zone).order_by(Zone.id.asc()).all()


def create_rider(db: Session, rider_in: RiderCreate) -> Rider:
    rider = Rider(
        external_worker_id=rider_in.external_worker_id,
        display_name=rider_in.display_name,
        reliability_score=rider_in.reliability_score,
        reputation_tier=rider_in.reputation_tier,
        is_probation=rider_in.is_probation,
    )
    db.add(rider)
    db.commit()
    db.refresh(rider)
    return rider


def list_riders(db: Session) -> list[Rider]:
    return db.query(Rider).order_by(Rider.id.asc()).all()


def compute_workability_score(rainfall: float, aqi: float, traffic_speed: float, zone_dai: float) -> float:
    rainfall_penalty = min(40.0, rainfall * 0.45)
    aqi_penalty = max(0.0, (aqi - 100) * 0.06)
    traffic_penalty = max(0.0, (25 - traffic_speed) * 1.5)
    dai_penalty = max(0.0, (1.0 - zone_dai) * 50)
    score = 100.0 - rainfall_penalty - aqi_penalty - traffic_penalty - dai_penalty
    return round(max(0.0, min(100.0, score)), 2)