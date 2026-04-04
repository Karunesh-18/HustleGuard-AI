"""Policy service — manages the 3 insurance tier definitions and rider enrollments.

The three tiers (Basic Shield, Standard Guard, Premium Armor) are seeded at
startup.  The service layer provides:
  - seed_default_policies()    — ensures the 3 tiers exist in the DB on startup
  - get_all_policies()         — list all active tiers
  - get_policy_by_name()       — fetch a single tier by name
  - get_rider_active_policy()  — return the active RiderPolicy for a rider
  - subscribe_rider_to_policy() — deactivate old, create new enrollment
  - get_trigger_thresholds()   — return threshold dict based on rider's tier
  - check_policy_allows()      — validate that a claim type is allowed by tier
"""

import logging
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from app.models.policy import Policy
from app.models.rider_policy import RiderPolicy
from app.schemas import PolicyRead, RiderPolicyCreate, RiderPolicyRead

logger = logging.getLogger(__name__)

# ─── Canonical tier definitions ───────────────────────────────────────────────
# These match the hackathon spec exactly.

_DEFAULT_POLICIES: list[dict] = [
    {
        "name": "Basic Shield",
        "weekly_premium_inr": 20.0,
        "payout_per_disruption_inr": 300.0,
        "dai_trigger_threshold": 0.35,     # triggers when DAI < 0.35
        "rainfall_trigger_mm": 90.0,        # triggers when rain > 90mm
        "aqi_trigger_threshold": 450.0,     # triggers when AQI > 450
        "max_claims_per_week": 2,
        "supports_partial_disruption": False,
        "supports_community_claims": False,
        "appeal_window_hours": 0,           # no appeals
        "waiting_period_days": 7,
    },
    {
        "name": "Standard Guard",
        "weekly_premium_inr": 32.0,
        "payout_per_disruption_inr": 500.0,
        "dai_trigger_threshold": 0.40,
        "rainfall_trigger_mm": 80.0,
        "aqi_trigger_threshold": 350.0,
        "max_claims_per_week": 3,
        "supports_partial_disruption": True,
        "supports_community_claims": True,
        "appeal_window_hours": 24,
        "waiting_period_days": 3,
    },
    {
        "name": "Premium Armor",
        "weekly_premium_inr": 45.0,
        "payout_per_disruption_inr": 700.0,
        "dai_trigger_threshold": 0.50,      # broadest coverage — triggers earliest
        "rainfall_trigger_mm": 65.0,
        "aqi_trigger_threshold": 250.0,
        "max_claims_per_week": 5,
        "supports_partial_disruption": True,
        "supports_community_claims": True,
        "appeal_window_hours": 72,
        "waiting_period_days": 0,           # immediate coverage
    },
]


def seed_default_policies(db: Session) -> None:
    """Idempotently upsert the 3 default policy tiers.

    Called at startup so the tiers are always available without a migration.
    """
    for pd in _DEFAULT_POLICIES:
        existing = db.query(Policy).filter(Policy.name == pd["name"]).first()
        if existing is None:
            db.add(Policy(**pd))
            logger.info(f"Seeded policy tier: {pd['name']}")
        else:
            # Update fields in case spec changed (e.g. payout amounts)
            for key, val in pd.items():
                setattr(existing, key, val)
    db.commit()
    logger.info("Policy tiers seed complete.")


def get_all_policies(db: Session) -> list[Policy]:
    """Return all active (non-soft-deleted) policy tiers."""
    return db.query(Policy).filter(Policy.is_active is True).all()


def get_policy_by_name(db: Session, name: str) -> Optional[Policy]:
    """Fetch a single policy tier by its exact name (case-insensitive)."""
    return (
        db.query(Policy)
        .filter(Policy.name.ilike(name))
        .first()
    )


def get_rider_active_policy(db: Session, rider_id: int) -> Optional[RiderPolicy]:
    """Return the currently active RiderPolicy enrollment for a rider."""
    return (
        db.query(RiderPolicy)
        .filter(RiderPolicy.rider_id == rider_id, RiderPolicy.active.is_(True))
        .order_by(RiderPolicy.enrolled_at.desc())
        .first()
    )


def subscribe_rider_to_policy(db: Session, data: RiderPolicyCreate) -> RiderPolicyRead:
    """Enroll a rider in a policy tier.

    Any previously active enrollment is deactivated first so only one
    tier is active at a time per rider.
    """
    policy = get_policy_by_name(db, data.policy_name)
    if policy is None:
        raise ValueError(f"Policy '{data.policy_name}' not found. Choose from: Basic Shield, Standard Guard, Premium Armor.")

    # Deactivate existing active enrollments
    db.query(RiderPolicy).filter(
        RiderPolicy.rider_id == data.rider_id,
        RiderPolicy.active.is_(True),
    ).update({"active": False})

    now = datetime.utcnow()
    eligible_from = now + timedelta(days=policy.waiting_period_days)

    enrollment = RiderPolicy(
        rider_id=data.rider_id,
        policy_id=policy.id,
        policy_name=policy.name,
        active=True,
        enrolled_at=now,
        eligible_from=eligible_from,
    )
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)

    logger.info(
        f"Rider {data.rider_id} enrolled in '{policy.name}' "
        f"(eligible from {eligible_from.date()})"
    )
    return RiderPolicyRead.model_validate(enrollment)


def get_trigger_thresholds_for_rider(db: Session, rider_id: int) -> dict:
    """Return trigger threshold dict based on rider's active policy.

    Falls back to Basic Shield thresholds when no active policy is found.
    """
    enrollment = get_rider_active_policy(db, rider_id)
    if enrollment and enrollment.policy:
        p = enrollment.policy
        return {
            "dai_threshold": p.dai_trigger_threshold,
            "rainfall_threshold": p.rainfall_trigger_mm,
            "aqi_threshold": p.aqi_trigger_threshold,
            "payout_inr": p.payout_per_disruption_inr,
            "policy_name": p.name,
        }

    # Default to Basic Shield values if no policy
    return {
        "dai_threshold": 0.35,
        "rainfall_threshold": 90.0,
        "aqi_threshold": 450.0,
        "payout_inr": 300.0,
        "policy_name": None,
    }


def check_policy_allows_claim_type(
    db: Session,
    rider_id: int,
    claim_type: str,
) -> tuple[bool, str]:
    """Check whether a rider's active policy permits the requested claim type.

    Returns (allowed, reason_if_not_allowed).
    """
    enrollment = get_rider_active_policy(db, rider_id)
    if enrollment is None:
        return False, "No active policy found for rider. Please subscribe to a plan first."

    policy = enrollment.policy
    if claim_type == "partial_disruption" and not policy.supports_partial_disruption:
        return False, f"'{policy.name}' does not include partial disruption claims. Upgrade to Standard Guard or Premium Armor."

    if claim_type == "community" and not policy.supports_community_claims:
        return False, f"'{policy.name}' does not include community claims. Upgrade to Standard Guard or Premium Armor."

    if claim_type == "appeal" and policy.appeal_window_hours == 0:
        return False, f"'{policy.name}' does not include an appeal window. Upgrade to Standard Guard or Premium Armor."

    # Check eligibility window (waiting period)
    if enrollment.eligible_from and datetime.utcnow() < enrollment.eligible_from:
        days_remaining = (enrollment.eligible_from - datetime.utcnow()).days + 1
        return False, f"Policy waiting period active — eligible in {days_remaining} day(s)."

    return True, ""
