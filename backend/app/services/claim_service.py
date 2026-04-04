"""Claim service — handles all 5 claim type workflows.

Claim types:
  1. parametric_auto      — system-triggered, no rider action (existing)
  2. manual_distress      — panic button, one-question UX
  3. partial_disruption   — prorated payout when DAI in 0.40–0.55 grey zone
  4. community            — 5+ riders in same zone → community disruption signal
  5. appeal               — challenge a rejected claim

All types run through the fraud engine for trust score computation.
Trust score determines payout routing:
  ≥ 80 → instant payout
  55–79 → provisional payout with background review
  35–54 → manual review required (no payout)
  < 35  → hold or reject
"""

import logging
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models.claim import (
    Claim,
    CLAIM_TYPE_PARAMETRIC_AUTO,
    CLAIM_TYPE_MANUAL_DISTRESS,
    CLAIM_TYPE_PARTIAL_DISRUPTION,
    CLAIM_TYPE_COMMUNITY,
    CLAIM_TYPE_APPEAL,
)
from app.models.payout import Payout
from app.models.zone import Zone
from app.schemas import (
    AppealClaimRequest,
    AppealClaimResponse,
    ClaimCreate,
    ClaimDecisionResponse,
    ClaimRead,
    CommunityClaimRequest,
    CommunityClaimResponse,
    FraudEvaluationRequest,
    ManualDistressClaimRequest,
    ManualDistressClaimResponse,
    PartialDisruptionClaimRequest,
    PartialDisruptionClaimResponse,
    PayoutRead,
)
from app.services.fraud_service import evaluate_fraud_risk
from app.services.policy_service import (
    check_policy_allows_claim_type,
    get_rider_active_policy,
    get_trigger_thresholds_for_rider,
)

logger = logging.getLogger(__name__)

# Community claim: minimum unique rider signals to trigger
COMMUNITY_THRESHOLD = 5
# Default payout amounts if no policy is configured
_DEFAULT_COMMUNITY_PAYOUT_INR = 500.0

# Community trust score tiers — more riders = stronger evidence = higher trust.
# Rationale: 5 GPS-verified riders in the same zone is credible but warrants review;
# 8+ is as strong as a solo parametric trigger; 12+ exceeds typical sensor reliability.
COMMUNITY_TRUST_TIERS: list[tuple[int, float, str]] = [
    # (min_riders, trust_score, decision)
    (12, 90.0, "instant_payout"),
    (8,  82.0, "instant_payout"),
    (5,  75.0, "provisional_payout_with_review"),
]


def _community_trust_for_count(rider_count: int) -> tuple[float, str]:
    """Return (trust_score, decision) for a given community rider count."""
    for min_riders, trust, decision in COMMUNITY_TRUST_TIERS:
        if rider_count >= min_riders:
            return trust, decision
    return 75.0, "provisional_payout_with_review"


# ── Helper: Build FraudEvaluationRequest from common distress/partial fields ──

def _build_fraud_request(rider_id: int, zone_id: int, payload) -> FraudEvaluationRequest:
    """Convert a distress/partial claim payload into a FraudEvaluationRequest."""
    return FraudEvaluationRequest(
        rider_id=rider_id,
        zone_id=zone_id,
        rainfall=getattr(payload, "rainfall", 0.0),
        AQI=getattr(payload, "aqi", 100.0),
        traffic_speed=getattr(payload, "traffic_speed", 20.0),
        zone_dai=getattr(payload, "zone_dai", payload.current_dai if hasattr(payload, "current_dai") else 0.5),
        city_from_gps=getattr(payload, "city_from_gps", "Bangalore"),
        city_from_ip=getattr(payload, "city_from_ip", "Bangalore"),
        historical_zone_visits=getattr(payload, "historical_zone_visits", 5),
        claim_count_last_30_days=getattr(payload, "claim_count_last_30_days", 0),
        teleport_distance_km=getattr(payload, "teleport_distance_km", 0.5),
        teleport_time_minutes=getattr(payload, "teleport_time_minutes", 2.0),
        peer_claims_last_15m=getattr(payload, "peer_claims_last_15m", 0),
        mock_location_detected=getattr(payload, "mock_location_detected", False),
        developer_mode_enabled=getattr(payload, "developer_mode_enabled", False),
        rooted_or_emulator=getattr(payload, "rooted_or_emulator", False),
    )


def _create_payout(db: Session, claim: Claim, amount_inr: float, decision: str) -> Payout | None:
    """Create a Payout record for instant or provisional decisions."""
    if decision in {"instant_payout", "provisional_payout_with_review"}:
        payout_status = "processing" if decision == "instant_payout" else "provisional"
        payout = Payout(claim_id=claim.id, amount_inr=amount_inr, status=payout_status)
        db.add(payout)
        db.commit()
        db.refresh(payout)
        return payout
    return None


# ── 1. Parametric Auto-Claim (existing) ──────────────────────────────────────

def create_claim_with_decision(
    db: Session,
    claim_in: ClaimCreate,
    fraud_in: FraudEvaluationRequest,
) -> ClaimDecisionResponse:
    """Original parametric auto-claim handler."""
    fraud_result = evaluate_fraud_risk(fraud_in)

    claim = Claim(
        rider_id=claim_in.rider_id,
        zone_id=claim_in.zone_id,
        claim_type=CLAIM_TYPE_PARAMETRIC_AUTO,
        status=fraud_result.decision,
        trust_score=fraud_result.trust_score,
        decision=fraud_result.decision,
        reasons="; ".join(fraud_result.reasons),
    )
    db.add(claim)
    db.commit()
    db.refresh(claim)

    payout = _create_payout(db, claim, claim_in.requested_amount_inr, fraud_result.decision)

    return ClaimDecisionResponse(
        claim=ClaimRead.model_validate(claim),
        payout=PayoutRead.model_validate(payout) if payout else None,
        decision_band=fraud_result.decision_band,
        decision=fraud_result.decision,
        reasons=fraud_result.reasons,
    )


# ── 2. Manual Distress Claim (Panic Button) ──────────────────────────────────

def create_manual_distress_claim(
    db: Session,
    payload: ManualDistressClaimRequest,
) -> ManualDistressClaimResponse:
    """
    Panic-button claim: rider taps 'I Can't Work' and selects one reason.
    Trust score routes to instant / provisional / hold.
    """
    # Policy check
    allowed, reason = check_policy_allows_claim_type(db, payload.rider_id, "manual_distress")
    # manual_distress is allowed for all tiers; check only returns False if no policy or in waiting period
    if not allowed:
        raise ValueError(reason)

    fraud_req = _build_fraud_request(payload.rider_id, payload.zone_id, payload)
    fraud_result = evaluate_fraud_risk(fraud_req)

    # Determine payout amount from rider's active policy
    thresholds = get_trigger_thresholds_for_rider(db, payload.rider_id)
    payout_amount = thresholds["payout_inr"]

    claim = Claim(
        rider_id=payload.rider_id,
        zone_id=payload.zone_id,
        claim_type=CLAIM_TYPE_MANUAL_DISTRESS,
        distress_reason=payload.reason,
        status=fraud_result.decision,
        trust_score=fraud_result.trust_score,
        decision=fraud_result.decision,
        reasons="; ".join(fraud_result.reasons),
    )
    db.add(claim)
    db.commit()
    db.refresh(claim)

    payout = _create_payout(db, claim, payout_amount, fraud_result.decision)

    # UPI-style countdown: instant = ~47s, provisional = ~300s
    eta_seconds = 47 if fraud_result.decision == "instant_payout" else 300

    logger.info(
        f"Manual distress claim | rider={payload.rider_id} zone={payload.zone_id} "
        f"reason={payload.reason} trust={fraud_result.trust_score:.1f} decision={fraud_result.decision}"
    )

    return ManualDistressClaimResponse(
        claim=ClaimRead.model_validate(claim),
        payout=PayoutRead.model_validate(payout) if payout else None,
        trust_score=fraud_result.trust_score,
        decision=fraud_result.decision,
        decision_band=fraud_result.decision_band,
        estimated_payout_seconds=eta_seconds,
        reasons=fraud_result.reasons,
    )


# ── 3. Partial Disruption Claim ───────────────────────────────────────────────

def create_partial_disruption_claim(
    db: Session,
    payload: PartialDisruptionClaimRequest,
) -> PartialDisruptionClaimResponse:
    """
    Prorated payout for grey-zone disruption (DAI 0.40–0.55).

    Formula:  payout = base_payout × (1 - current_dai / normal_dai)
    Example:  DAI=0.45, normal=1.0  →  ₹500 × (1 - 0.45) = ₹275
    """
    # Policy check — only Standard Guard and Premium Armor support this
    allowed, block_reason = check_policy_allows_claim_type(db, payload.rider_id, "partial_disruption")
    if not allowed:
        raise ValueError(block_reason)

    # Validate DAI is in the grey zone (0.40–0.55)
    if not (0.40 <= payload.current_dai <= 0.55):
        raise ValueError(
            f"Partial disruption claims require DAI between 0.40 and 0.55. "
            f"Current DAI is {payload.current_dai:.2f}. "
            f"Use parametric auto-claim for DAI < 0.40."
        )

    fraud_req = _build_fraud_request(payload.rider_id, payload.zone_id, payload)
    fraud_result = evaluate_fraud_risk(fraud_req)

    # Get base payout from rider's plan
    thresholds = get_trigger_thresholds_for_rider(db, payload.rider_id)
    base_payout = thresholds["payout_inr"]

    # Look up zone's baseline DAI from the zones table.
    # Using 1.0 as the normal_dai was over-compensating riders in zones with a
    # naturally lower baseline. A zone running at 70 DAI normally would pay out
    # too much if we assumed 100 was normal.
    zone_row = db.query(Zone).filter(Zone.id == payload.zone_id).first()
    if zone_row is not None and zone_row.baseline_orders_per_hour > 0:
        # Normalise against 100 orders/hour as a reference max
        inferred_normal_dai = min(1.0, zone_row.baseline_orders_per_hour / 100.0)
    else:
        inferred_normal_dai = 1.0

    # Allow the caller to override if they have a better baseline estimate;
    # default is now zone-derived rather than blindly 1.0
    normal_dai = max(payload.normal_dai if payload.normal_dai != 1.0 else inferred_normal_dai, 1e-6)
    payout_ratio = max(0.0, 1.0 - (payload.current_dai / normal_dai))
    prorated_payout = round(base_payout * payout_ratio, 2)

    calculation = (
        f"₹{base_payout:.0f} × (1 − {payload.current_dai:.2f} / {normal_dai:.2f}) = ₹{prorated_payout:.2f}"
    )

    claim = Claim(
        rider_id=payload.rider_id,
        zone_id=payload.zone_id,
        claim_type=CLAIM_TYPE_PARTIAL_DISRUPTION,
        base_payout_inr=base_payout,
        partial_payout_ratio=payout_ratio,
        current_dai_at_claim=payload.current_dai,
        status=fraud_result.decision,
        trust_score=fraud_result.trust_score,
        decision=fraud_result.decision,
        reasons="; ".join(fraud_result.reasons),
    )
    db.add(claim)
    db.commit()
    db.refresh(claim)

    payout = _create_payout(db, claim, prorated_payout, fraud_result.decision)

    logger.info(
        f"Partial disruption claim | rider={payload.rider_id} DAI={payload.current_dai:.2f} "
        f"ratio={payout_ratio:.2f} payout=₹{prorated_payout} trust={fraud_result.trust_score:.1f}"
    )

    return PartialDisruptionClaimResponse(
        claim=ClaimRead.model_validate(claim),
        payout=PayoutRead.model_validate(payout) if payout else None,
        trust_score=fraud_result.trust_score,
        decision=fraud_result.decision,
        base_payout_inr=base_payout,
        payout_ratio=round(payout_ratio, 4),
        prorated_payout_inr=prorated_payout,
        calculation=calculation,
        reasons=fraud_result.reasons,
    )


# ── 4. Community Claim (Human Sensor Layer) ───────────────────────────────────

def evaluate_community_claim(
    db: Session,
    payload: CommunityClaimRequest,
) -> CommunityClaimResponse:
    """
    Community disruption signal: 5+ riders in the same zone signal 'I Can't Work'
    within a 10-minute window.  The batch is sent here and validated; if  the
    threshold is met, each rider gets a community payout claim created instantly.

    This is the human sensor layer — it can override or supplement ML/API signals
    when weather APIs are lagging or sensors are offline.
    """
    rider_count = len(payload.rider_signals)
    if rider_count < COMMUNITY_THRESHOLD:
        return CommunityClaimResponse(
            triggered=False,
            rider_count=rider_count,
            zone_name=payload.zone_name,
            payout_per_rider_inr=0.0,
            total_payout_inr=0.0,
            reason=f"Only {rider_count} riders signalled — need {COMMUNITY_THRESHOLD} minimum.",
            claims=[],
        )

    # Ensure zone row exists for FK
    zone = db.query(Zone).filter(Zone.id == payload.zone_id).first()
    if zone is None:
        zone = Zone(
            name=payload.zone_name,
            city="Unknown",
            baseline_orders_per_hour=100,
            baseline_active_riders=40,
            baseline_delivery_time_minutes=25,
            risk_level="high",
        )
        db.add(zone)
        db.flush()

    trigger_reason = (
        f"Community signal: {rider_count} riders in {payload.zone_name} "
        f"(DAI={payload.current_dai:.2f}, Rain={payload.rainfall:.0f}mm, AQI={payload.aqi:.0f})"
    )

    created_claims: list[ClaimRead] = []
    payout_per_rider = _DEFAULT_COMMUNITY_PAYOUT_INR

    for signal in payload.rider_signals:
        # Check rider's policy for community claim support
        allowed, _ = check_policy_allows_claim_type(db, signal.rider_id, "community")
        if not allowed:
            # Skip riders whose policy doesn't support community claims
            continue

        rider_thresholds = get_trigger_thresholds_for_rider(db, signal.rider_id)
        rider_payout = rider_thresholds["payout_inr"]

        claim = Claim(
            rider_id=signal.rider_id,
            zone_id=zone.id,
            claim_type=CLAIM_TYPE_COMMUNITY,
            community_trigger_count=rider_count,
            # Trust score scales with number of rider signals — more riders = stronger evidence.
            # See COMMUNITY_TRUST_TIERS for the tier thresholds and rationale.
            **({"trust_score": _community_trust_for_count(rider_count)[0],
               "decision": _community_trust_for_count(rider_count)[1],
               "status": _community_trust_for_count(rider_count)[1]}),
            reasons=trigger_reason,
        )
        db.add(claim)
        db.flush()

        payout = Payout(claim_id=claim.id, amount_inr=rider_payout, status="provisional")
        db.add(payout)

        created_claims.append(ClaimRead.model_validate(claim))

    db.commit()

    total_paid = sum(c.rider_id for c in created_claims) * 0 + len(created_claims) * payout_per_rider

    logger.info(
        f"Community claim TRIGGERED | zone={payload.zone_name} riders={len(created_claims)} "
        f"each=₹{payout_per_rider}"
    )

    return CommunityClaimResponse(
        triggered=True,
        rider_count=len(created_claims),
        zone_name=payload.zone_name,
        payout_per_rider_inr=payout_per_rider,
        total_payout_inr=len(created_claims) * payout_per_rider,
        reason=trigger_reason,
        claims=created_claims,
    )


# ── 5. Appeal Claim ───────────────────────────────────────────────────────────

def create_appeal_claim(
    db: Session,
    payload: AppealClaimRequest,
) -> "AppealClaimResponse":
    """
    Challenge a rejected claim.  The system checks:
    1. The original claim was actually rejected.
    2. The rider's policy has an appeal window.
    3. The appeal is within that window.

    Creates an appeal claim record for admin review.
    """
    from app.schemas import AppealClaimResponse

    # Fetch the original claim
    original = db.query(Claim).filter(
        Claim.id == payload.original_claim_id,
        Claim.rider_id == payload.rider_id,
    ).first()

    if original is None:
        raise ValueError(f"Claim #{payload.original_claim_id} not found for this rider.")

    accepted_decisions = {"instant_payout", "provisional_payout_with_review"}
    if original.decision in accepted_decisions:
        raise ValueError("Cannot appeal a claim that was already approved or paid.")

    # Check policy appeal window
    allowed, block_reason = check_policy_allows_claim_type(db, payload.rider_id, "appeal")
    if not allowed:
        raise ValueError(block_reason)

    # Fetch the window to validate timing
    enrollment = get_rider_active_policy(db, payload.rider_id)
    if enrollment and enrollment.policy:
        window_hours = enrollment.policy.appeal_window_hours
    else:
        window_hours = 0

    if window_hours > 0:
        deadline = original.created_at.replace(tzinfo=None) + timedelta(hours=window_hours)
        if datetime.utcnow() > deadline:
            raise ValueError(
                f"Appeal window expired. You had {window_hours} hours from the original decision."
            )

    appeal = Claim(
        rider_id=payload.rider_id,
        zone_id=original.zone_id,
        claim_type=CLAIM_TYPE_APPEAL,
        appeal_of_claim_id=payload.original_claim_id,
        appeal_clarification=payload.clarification_text,
        appeal_status="pending",
        # Appeal claims start with review-required status
        trust_score=original.trust_score,
        decision="manual_review_required",
        status="under_admin_review",
        reasons=f"Appeal of claim #{payload.original_claim_id}: {payload.clarification_text[:100]}",
    )
    db.add(appeal)
    db.commit()
    db.refresh(appeal)

    # Admin typically reviews appeals within 4 business hours
    review_eta = (datetime.utcnow() + timedelta(hours=4)).strftime("%I:%M %p on %b %d")

    logger.info(
        f"Appeal claim created | rider={payload.rider_id} original_claim={payload.original_claim_id} "
        f"appeal_id={appeal.id}"
    )

    return AppealClaimResponse(
        claim=ClaimRead.model_validate(appeal),
        original_claim_id=payload.original_claim_id,
        appeal_status="pending",
        appeal_window_hours=window_hours,
        review_eta=review_eta,
        reasons=[f"Appeal submitted for Claim #{payload.original_claim_id}. Admin will review within 4 hours."],
    )