from datetime import datetime, timezone
from typing import Any, cast

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.domain import PayoutEvent, Rider, Subscription, ZoneSnapshot
from app.schemas.domain import RiderOnboardCreate, SubscriptionCreate


def seed_default_live_data(db: Session) -> None:
    zone_count = db.query(ZoneSnapshot).count()
    if zone_count == 0:
        zones = [
            ZoneSnapshot(
                zone_name="Koramangala",
                rainfall_mm=92.0,
                aqi=186,
                traffic_index=82,
                dai=0.32,
                workability_score=42,
            ),
            ZoneSnapshot(
                zone_name="Indiranagar",
                rainfall_mm=22.0,
                aqi=110,
                traffic_index=58,
                dai=0.74,
                workability_score=78,
            ),
            ZoneSnapshot(
                zone_name="HSR Layout",
                rainfall_mm=48.0,
                aqi=150,
                traffic_index=70,
                dai=0.51,
                workability_score=61,
            ),
        ]
        db.add_all(zones)

    payout_count = db.query(PayoutEvent).count()
    if payout_count == 0:
        payouts = [
            PayoutEvent(
                zone_name="Koramangala",
                trigger_reason="Heavy rain + DAI drop",
                payout_amount_inr=300.0,
                eligible_riders=128,
                event_time=datetime.now(timezone.utc),
            ),
            PayoutEvent(
                zone_name="HSR Layout",
                trigger_reason="AQI spike + low workability",
                payout_amount_inr=200.0,
                eligible_riders=74,
                event_time=datetime.now(timezone.utc),
            ),
        ]
        db.add_all(payouts)

    db.commit()


def get_zone_snapshots(db: Session) -> list[ZoneSnapshot]:
    return db.query(ZoneSnapshot).order_by(ZoneSnapshot.workability_score.asc()).all()


def get_recent_payouts(db: Session, limit: int = 10) -> list[PayoutEvent]:
    return (
        db.query(PayoutEvent)
        .order_by(PayoutEvent.event_time.desc())
        .limit(limit)
        .all()
    )


def create_rider(db: Session, rider_in: RiderOnboardCreate) -> Rider:
    rider = Rider(
        name=rider_in.name,
        email=rider_in.email.lower(),
        city=rider_in.city,
        home_zone=rider_in.home_zone,
        reliability_score=65,
    )
    db.add(rider)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ValueError("A rider with this email already exists.")
    db.refresh(rider)
    return rider


def create_subscription(db: Session, subscription_in: SubscriptionCreate) -> Subscription:
    rider = db.query(Rider).filter(Rider.id == subscription_in.rider_id).first()
    if rider is None:
        raise LookupError("Rider not found.")

    score_value = cast(Any, rider.reliability_score)
    score = score_value if isinstance(score_value, int) else 60

    risk_multiplier = 1.0
    if score < 50:
        risk_multiplier = 1.4
    elif score < 70:
        risk_multiplier = 1.15

    base_premium = 30.0
    weekly_premium = round(base_premium * risk_multiplier, 2)

    db.query(Subscription).filter(Subscription.rider_id == rider.id, Subscription.active.is_(True)).update(
        {Subscription.active: False}
    )

    subscription = Subscription(
        rider_id=subscription_in.rider_id,
        plan_name=subscription_in.plan_name,
        weekly_premium=weekly_premium,
        active=True,
    )

    db.add(subscription)
    db.commit()
    db.refresh(subscription)
    return subscription


def get_active_subscription(db: Session, rider_id: int) -> Subscription | None:
    return (
        db.query(Subscription)
        .filter(Subscription.rider_id == rider_id, Subscription.active.is_(True))
        .order_by(Subscription.created_at.desc())
        .first()
    )
