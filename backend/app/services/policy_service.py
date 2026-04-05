"""Policy service — manages the 3 insurance tier definitions and rider enrollments.

The three tiers (Basic Shield, Standard Guard, Premium Armor) are seeded at
startup.  The service layer provides:
  - seed_default_policies()      — ensures the 3 tiers exist in the DB on startup
  - get_all_policies()           — list all active tiers
  - get_policy_by_name()         — fetch a single tier by name
  - get_rider_active_policy()    — return the active RiderPolicy for a rider
  - subscribe_rider_to_policy()  — deactivate old, create new enrollment
  - get_trigger_thresholds()     — return threshold dict based on rider's tier
  - check_policy_allows()        — validate that a claim type is allowed by tier
  - quote_policies_for_zone()    — ML-driven premium quote for a specific zone
"""

import logging
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from app.models.policy import Policy
from app.models.rider_policy import RiderPolicy
from app.schemas import PolicyRead, RiderPolicyCreate, RiderPolicyRead
from app.schemas.domain import (
    PolicyQuotedPlan,
    PolicyQuoteRequest,
    PolicyQuoteResponse,
    ZoneConditionsSnapshot,
)

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
    # Use is_(True) for proper SQLAlchemy boolean comparison
    policies = db.query(Policy).filter(Policy.is_active.is_(True)).all()
    if not policies:
        # Fallback: return all policies regardless of is_active flag
        policies = db.query(Policy).all()
    return policies


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
    # waive_waiting_period=True skips the delay — used after confirmed payment.
    # The waiting period prevents opportunistic fraud (signing up right before a storm),
    # but completing payment is proof of good faith, so we waive it here.
    eligible_from = now if data.waive_waiting_period else now + timedelta(days=policy.waiting_period_days)

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
    zone_dai: float | None = None,
    rainfall: float | None = None,
) -> tuple[bool, str]:
    """Check whether a rider's active policy permits the requested claim type.

    Returns (allowed, reason_if_not_allowed).

    Emergency override: if zone_dai < 0.5 OR rainfall > 60mm, the waiting period
    is bypassed for manual_distress claims. An active disruption should never
    lock a rider out of the panic button — the waiting period is meant to prevent
    abuse on fair-weather days, not during actual emergencies.
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
        # Emergency override: bypass waiting period when active disruption is confirmed
        # This allows riders who just enrolled to claim during an ongoing event.
        is_emergency = (
            claim_type == "manual_distress"
            and ((zone_dai is not None and zone_dai < 0.50) or (rainfall is not None and rainfall > 60.0))
        )
        if not is_emergency:
            days_remaining = (enrollment.eligible_from - datetime.utcnow()).days + 1
            return False, f"Policy waiting period active — eligible in {days_remaining} day(s)."
        else:
            logger.info(
                f"Rider {rider_id}: waiting period bypassed — active disruption confirmed "
                f"(dai={zone_dai}, rain={rainfall}mm)"
            )

    return True, ""


# ─── ML-Driven Premium Quoting ────────────────────────────────────────────────

# Risk multipliers mapped from ML risk_label output.
# Capped at 1.45× — no "critical" surcharge in the rider-facing product.
_QUOTE_MULTIPLIERS: dict[str, float] = {
    "normal":   1.00,
    "moderate": 1.20,
    "high":     1.45,
}

# Reliability discount: better riders pay less (±₹5 max, capped conservatively)
_MAX_RELIABILITY_DISCOUNT_INR = 5.0


def quote_policies_for_zone(db: Session, request: PolicyQuoteRequest) -> PolicyQuoteResponse:
    """Return ML risk-adjusted premium quotes for all active policy tiers.

    Flow:
      1. Look up ZoneSnapshot for the requested zone
      2. If no snapshot exists, generate one via the simulation service
      3. Build a DisruptionPredictionRequest from zone conditions
      4. Call the ML model → { disruption_probability, risk_label, predicted_dai }
      5. Map risk_label → multiplier
      6. Apply multiplier + reliability discount to each plan's base premium
      7. Return PolicyQuoteResponse with all 3 quoted plans + ML context
    """
    from app.models.domain import ZoneSnapshot
    from app.schemas import DisruptionPredictionRequest
    from app.services.ml_service import predict_disruption

    # ── Step 1: Fetch zone conditions ────────────────────────────────────────
    snap = db.query(ZoneSnapshot).filter_by(zone_name=request.zone_name).first()
    if snap is None:
        # Zone not yet in DB — generate synthetic conditions and persist
        logger.info(f"No ZoneSnapshot for {request.zone_name!r}, generating via simulation")
        from app.services.zone_simulation_service import generate_zone_conditions
        cond = generate_zone_conditions(request.zone_name)
        snap = ZoneSnapshot(
            zone_name=request.zone_name,
            rainfall_mm=cond["rainfall_mm"],
            aqi=cond["aqi"],
            traffic_index=cond["traffic_index"],
            dai=cond.get("dai", cond["workability_score"] / 100.0),
            workability_score=cond["workability_score"],
        )
        db.add(snap)
        try:
            db.commit()
            db.refresh(snap)
        except Exception:
            db.rollback()

    zone_conditions = ZoneConditionsSnapshot(
        rainfall_mm=snap.rainfall_mm,
        aqi=snap.aqi,
        traffic_index=snap.traffic_index,
        dai=snap.dai,
    )

    # ── Step 2: Run ML model ─────────────────────────────────────────────────
    # traffic_index 0-100 → approximate speed: index 0 = 80 km/h, index 100 = 5 km/h
    estimated_speed = max(5.0, 80.0 - snap.traffic_index * 0.75)

    ml_req = DisruptionPredictionRequest(
        rainfall=snap.rainfall_mm,
        AQI=float(snap.aqi),
        traffic_speed=estimated_speed,
        current_dai=snap.dai,
    )
    prediction = predict_disruption(ml_req)

    risk_label = prediction.risk_label
    multiplier = _QUOTE_MULTIPLIERS.get(risk_label, 1.0)

    logger.info(
        f"Premium quote | zone={request.zone_name!r} "
        f"rain={snap.rainfall_mm}mm AQI={snap.aqi} DAI={snap.dai:.2f} "
        f"-> risk={risk_label} mult={multiplier}× prob={prediction.disruption_probability:.2f}"
    )

    # ── Step 3: Apply multiplier to each plan ────────────────────────────────
    policies = get_all_policies(db)
    reliability_discount = (request.reliability_score - 50.0) * 0.10
    reliability_discount = max(-_MAX_RELIABILITY_DISCOUNT_INR, min(_MAX_RELIABILITY_DISCOUNT_INR, reliability_discount))

    quoted_plans: list[PolicyQuotedPlan] = []
    for p in policies:
        raw_quoted = p.weekly_premium_inr * multiplier - reliability_discount
        quoted_premium = round(max(p.weekly_premium_inr * 0.8, raw_quoted))  # floor at 80% of base

        quoted_plans.append(PolicyQuotedPlan(
            policy_id=p.id,
            policy_name=p.name,
            base_premium_inr=p.weekly_premium_inr,
            quoted_premium_inr=float(quoted_premium),
            risk_multiplier=multiplier,
            payout_per_disruption_inr=p.payout_per_disruption_inr,
            dai_trigger_threshold=p.dai_trigger_threshold,
            max_claims_per_week=p.max_claims_per_week,
            supports_partial_disruption=p.supports_partial_disruption,
            supports_community_claims=p.supports_community_claims,
            waiting_period_days=p.waiting_period_days,
        ))

    return PolicyQuoteResponse(
        zone_name=request.zone_name,
        risk_label=risk_label,
        disruption_probability=round(prediction.disruption_probability, 3),
        predicted_dai=round(prediction.predicted_dai, 3),
        risk_multiplier=multiplier,
        zone_conditions=zone_conditions,
        plans=quoted_plans,
    )
