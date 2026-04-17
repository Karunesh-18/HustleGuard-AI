"""Domain service layer.

Handles zone data, rider management, subscription creation, and live data queries.
The ZoneSnapshot / PayoutEvent / DomainRider / Subscription models live in
app/models/domain.py (separate from the Zone/Rider ORM models used by the
existing backend routes).
"""

import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import Rider, Zone
from app.models.domain import PayoutEvent, Rider as DomainRider, Subscription, ZoneSnapshot
from app.schemas import RiderCreate, ZoneCreate
from app.schemas.domain import (
    PayoutEventRead,
    RiderOnboardCreate,
    RiderOnboardRead,
    SubscriptionCreate,
    SubscriptionRead,
    ZoneLiveDataRead,
)

logger = logging.getLogger(__name__)

# Synthetic demo seed data — used when ZoneSnapshot table is empty
_DEMO_ZONES: list[dict] = [
    {"zone_name": "Koramangala", "rainfall_mm": 92.0, "aqi": 143, "traffic_index": 38, "dai": 0.28, "workability_score": 31},
    {"zone_name": "HSR Layout",  "rainfall_mm": 45.0, "aqi": 118, "traffic_index": 54, "dai": 0.51, "workability_score": 57},
    {"zone_name": "Indiranagar", "rainfall_mm": 12.0, "aqi":  86, "traffic_index": 72, "dai": 0.83, "workability_score": 82},
    {"zone_name": "Whitefield",  "rainfall_mm":  8.0, "aqi":  79, "traffic_index": 68, "dai": 0.79, "workability_score": 79},
    {"zone_name": "Electronic City", "rainfall_mm": 37.0, "aqi": 109, "traffic_index": 48, "dai": 0.44, "workability_score": 52},
]

# Synthetic demo payouts — used when PayoutEvent table is empty
_DEMO_PAYOUTS: list[dict] = [
    {"id": 1, "zone_name": "Koramangala", "trigger_reason": "Heavy rain · DAI 0.28", "payout_amount_inr": 600.0, "eligible_riders": 137, "event_time": "2026-03-20T10:02:00+00:00"},
    {"id": 2, "zone_name": "Koramangala", "trigger_reason": "Flood alert · DAI 0.31", "payout_amount_inr": 600.0, "eligible_riders": 89,  "event_time": "2026-03-17T08:45:00+00:00"},
    {"id": 3, "zone_name": "HSR Layout",  "trigger_reason": "AQI > 420 · DAI 0.41",  "payout_amount_inr": 400.0, "eligible_riders": 42,  "event_time": "2026-03-12T14:20:00+00:00"},
]


# ─── Zone live data ───────────────────────────────────────────────────────────

def get_zone_live_data(db: Session) -> list[ZoneLiveDataRead]:
    """Return current zone snapshots with all real-API enrichment fields."""
    rows = db.query(ZoneSnapshot).order_by(ZoneSnapshot.zone_name.asc()).all()
    if rows:
        return [
            ZoneLiveDataRead(
                zone_name=row.zone_name,
                rainfall_mm=row.rainfall_mm,
                aqi=row.aqi,
                traffic_index=row.traffic_index,
                dai=row.dai,
                workability_score=row.workability_score,
                updated_at=row.updated_at.isoformat(),
                data_source=getattr(row, "data_source", "simulated") or "simulated",
                temperature_celsius=getattr(row, "temperature_celsius", None),
                dominant_pollutant=getattr(row, "dominant_pollutant", None),
                traffic_speed_kmh=getattr(row, "traffic_speed_kmh", None),
            )
            for row in rows
        ]

    # No snapshots yet — trigger a real API refresh (first boot / cleared DB).
    logger.info("ZoneSnapshot table empty — triggering initial zone refresh from real APIs")
    try:
        from app.services.zone_simulation_service import refresh_all_zones
        refresh_all_zones(db)
    except Exception as exc:
        logger.error(f"Initial zone refresh failed: {exc}")

    rows = db.query(ZoneSnapshot).order_by(ZoneSnapshot.zone_name.asc()).all()
    if rows:
        return [
            ZoneLiveDataRead(
                zone_name=row.zone_name,
                rainfall_mm=row.rainfall_mm,
                aqi=row.aqi,
                traffic_index=row.traffic_index,
                dai=row.dai,
                workability_score=row.workability_score,
                updated_at=row.updated_at.isoformat(),
                data_source=getattr(row, "data_source", "simulated") or "simulated",
                temperature_celsius=getattr(row, "temperature_celsius", None),
                dominant_pollutant=getattr(row, "dominant_pollutant", None),
                traffic_speed_kmh=getattr(row, "traffic_speed_kmh", None),
            )
            for row in rows
        ]

    # Absolute last resort — static fallback
    now = datetime.now(tz=timezone.utc)
    return [ZoneLiveDataRead(**d, updated_at=now.isoformat()) for d in _DEMO_ZONES]


# ─── Recent payout events ─────────────────────────────────────────────────────

def get_recent_payouts(db: Session, limit: int = 10) -> list[PayoutEventRead]:
    """Return the most recent payout events, falling back to synthetic demo data."""
    rows = db.query(PayoutEvent).order_by(PayoutEvent.event_time.desc()).limit(limit).all()
    if rows:
        return [
            PayoutEventRead(
                id=row.id,
                zone_name=row.zone_name,
                trigger_reason=row.trigger_reason,
                payout_amount_inr=row.payout_amount_inr,
                eligible_riders=row.eligible_riders,
                event_time=row.event_time.isoformat(),
            )
            for row in rows
        ]
    return [PayoutEventRead(**d) for d in _DEMO_PAYOUTS]


# ─── Rider onboarding (frontend-compatible) ───────────────────────────────────

def onboard_rider(db: Session, payload: RiderOnboardCreate) -> RiderOnboardRead:
    """Create a new rider using the frontend-compatible schema (name/email/city/home_zone)."""
    rider = DomainRider(
        name=payload.name,
        email=payload.email,
        city=payload.city,
        home_zone=payload.home_zone,
        reliability_score=payload.reliability_score,
    )
    db.add(rider)
    db.commit()
    db.refresh(rider)
    logger.info(f"Rider onboarded: id={rider.id} name={rider.name!r} zone={rider.home_zone!r}")
    return RiderOnboardRead(
        id=rider.id,
        name=rider.name,
        email=rider.email,
        city=rider.city,
        home_zone=rider.home_zone,
        reliability_score=rider.reliability_score,
        created_at=rider.created_at.isoformat(),
    )


def signin_rider(db: Session, phone: str) -> RiderOnboardRead:
    """Look up an existing rider by their phone number (stored as email).

    The frontend stores the phone as <digits>@rider.hustleguard.com.
    Accepts either the raw phone number (digits only) or the full email.

    Raises ValueError if no account is found.
    """
    # Normalise: strip non-digits, construct the email key
    digits = "".join(c for c in phone if c.isdigit())
    email_key = f"{digits}@rider.hustleguard.com"

    rider = db.query(DomainRider).filter(
        DomainRider.email == email_key
    ).first()

    if rider is None:
        raise ValueError(
            f"No account found for phone '{phone}'. "
            "Please register using 'Get Protected'."
        )

    logger.info(f"Rider sign-in: id={rider.id} name={rider.name!r} zone={rider.home_zone!r}")
    return RiderOnboardRead(
        id=rider.id,
        name=rider.name,
        email=rider.email,
        city=rider.city,
        home_zone=rider.home_zone,
        reliability_score=rider.reliability_score,
        created_at=rider.created_at.isoformat(),
    )


# ─── Subscription creation ────────────────────────────────────────────────────

def create_subscription(db: Session, payload: SubscriptionCreate) -> SubscriptionRead:
    """Create (or reactivate) a subscription for a rider and calculate the weekly premium."""
    from app.services.premium_service import premium_from_components

    rider = db.query(DomainRider).filter(DomainRider.id == payload.rider_id).first()
    if rider is None:
        raise ValueError(f"Rider {payload.rider_id} not found.")

    # Use medium risk as default — in production this would look up zone risk
    weekly_premium = premium_from_components("medium", rider.reliability_score)

    sub = Subscription(
        rider_id=rider.id,
        plan_name=payload.plan_name,
        weekly_premium=weekly_premium,
        active=True,
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    logger.info(f"Subscription created: rider={rider.id} plan={sub.plan_name!r} premium=₹{weekly_premium}")
    return SubscriptionRead(
        id=sub.id,
        rider_id=sub.rider_id,
        plan_name=sub.plan_name,
        weekly_premium=sub.weekly_premium,
        active=sub.active,
        created_at=sub.created_at.isoformat(),
    )


# ─── Existing helpers (unchanged) ─────────────────────────────────────────────

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


def list_zones(db: Session, skip: int = 0, limit: int = 50) -> list[Zone]:
    return db.query(Zone).order_by(Zone.id.asc()).offset(skip).limit(limit).all()


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


def list_riders(db: Session, skip: int = 0, limit: int = 50) -> list[Rider]:
    return db.query(Rider).order_by(Rider.id.asc()).offset(skip).limit(limit).all()


def compute_workability_score(rainfall: float, aqi: float, traffic_speed: float, zone_dai: float) -> float:
    rainfall_penalty = min(40.0, rainfall * 0.45)
    aqi_penalty = max(0.0, (aqi - 100) * 0.06)
    traffic_penalty = max(0.0, (25 - traffic_speed) * 1.5)
    dai_penalty = max(0.0, (1.0 - zone_dai) * 50)
    score = 100.0 - rainfall_penalty - aqi_penalty - traffic_penalty - dai_penalty
    return round(max(0.0, min(100.0, score)), 2)


# ─── Parametric trigger payout recording ─────────────────────────────────────

def record_payout_event(
    db: Session,
    zone_name: str,
    trigger_reason: str,
    payout_amount_inr: float,
    eligible_riders: int,
) -> PayoutEvent:
    """Persist a parametric payout event when a trigger fires."""
    event = PayoutEvent(
        zone_name=zone_name,
        trigger_reason=trigger_reason,
        payout_amount_inr=payout_amount_inr,
        eligible_riders=eligible_riders,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    logger.info(f"Payout event recorded: id={event.id} zone={zone_name!r} amount=₹{payout_amount_inr}")
    return event