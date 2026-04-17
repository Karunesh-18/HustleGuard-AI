"""Policies router — manage insurance tier definitions and rider enrollments.

Endpoints:
  GET  /api/v1/policies                        — list all available tiers
  GET  /api/v1/policies/recommend/{rider_id}   — dynamically recommend one plan
  GET  /api/v1/policies/{policy_name}          — single tier detail
  POST /api/v1/policies/subscribe              — subscribe rider to a tier
  GET  /api/v1/policies/rider/{rider_id}       — active policy for a rider
"""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.claim import Claim
from app.models.rider import Rider
from app.schemas import PolicyRead, RiderPolicyCreate, RiderPolicyRead
from app.schemas.domain import PolicyQuoteRequest, PolicyQuoteResponse, PolicyQuotedPlan
from app.services.policy_service import (
    get_all_policies,
    get_policy_by_name,
    get_rider_active_policy,
    quote_policies_for_zone,
    subscribe_rider_to_policy,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/policies", tags=["policies"])


# ── Recommendation schema ──────────────────────────────────────────────────────

class PolicyRecommendation(BaseModel):
    recommended_plan: PolicyQuotedPlan
    reason: str                       # human-readable why this plan was selected
    risk_label: str
    disruption_probability: float
    claim_count_30d: int
    reliability_score: int
    zone_name: str
    quote: PolicyQuoteResponse        # full quote context for T&C display


@router.get("/recommend/{rider_id}", response_model=PolicyRecommendation)
async def recommend_policy(
    rider_id: int,
    request: Request,
    db: Session = Depends(get_db),
) -> PolicyRecommendation:
    """Dynamically recommend exactly one insurance plan for a rider.

    Selection algorithm (no manual choice — rider gets one best-fit plan):
      1. Fetch rider's zone and reliability score from DB
      2. Run ML quote for that zone → get risk_label + disruption_probability
      3. Count rider's claims in last 30 days (fraud/frequency signal)
      4. Apply selection matrix:
           High risk OR >= 2 recent claims → Premium Armor
           Moderate risk OR 1 recent claim → Standard Guard
           Normal risk, 0 claims          → Basic Shield
           But reliability >= 75 upgrades one tier (rewarding safe riders)
      5. Return the selected plan with a narrative explanation
    """
    if not getattr(request.app.state, "database_ready", False):
        raise HTTPException(status_code=503, detail="Database is unavailable.")

    # ── 1. Get rider data ─────────────────────────────────────────────────────
    rider = db.query(Rider).filter(Rider.id == rider_id).first()
    if rider is None:
        raise HTTPException(status_code=404, detail=f"Rider {rider_id} not found.")

    zone_name: str = getattr(rider, "home_zone", None) or "Koramangala"
    reliability: int = int(getattr(rider, "reliability_score", 60) or 60)

    # ── 2. ML quote for zone ──────────────────────────────────────────────────
    try:
        quote = quote_policies_for_zone(
            db,
            PolicyQuoteRequest(zone_name=zone_name, reliability_score=reliability),
        )
    except Exception as exc:
        logger.warning("Quote failed for rider %s zone %s: %s", rider_id, zone_name, exc)
        raise HTTPException(status_code=500, detail="Could not generate recommendation.") from exc

    risk_label = quote.risk_label
    prob = quote.disruption_probability

    # ── 3. Recent claim count (last 30 days) ──────────────────────────────────
    # Gracefully falls back to 0 if the claims table schema is incomplete (migration pending)
    from datetime import datetime, timedelta
    from sqlalchemy import text
    cutoff = datetime.utcnow() - timedelta(days=30)
    try:
        claim_count = (
            db.query(Claim.id)
            .filter(Claim.rider_id == rider_id, Claim.created_at >= cutoff)
            .count()
        )
    except Exception as count_exc:
        logger.warning("Could not count claims for rider %s, defaulting to 0: %s", rider_id, count_exc)
        db.rollback()
        claim_count = 0

    # ── 4. Selection matrix ───────────────────────────────────────────────────
    # Base tier from risk
    if risk_label == "high" or claim_count >= 2:
        base_tier = "Premium Armor"
    elif risk_label == "moderate" or claim_count == 1:
        base_tier = "Standard Guard"
    else:
        base_tier = "Basic Shield"

    # Reliability boost: score >= 75 → upgrade one tier
    TIER_ORDER = ["Basic Shield", "Standard Guard", "Premium Armor"]
    tier_idx = TIER_ORDER.index(base_tier)
    if reliability >= 75 and tier_idx < len(TIER_ORDER) - 1:
        tier_idx += 1
        reliability_boost = True
    else:
        reliability_boost = False

    selected_name = TIER_ORDER[tier_idx]
    selected_plan = next(
        (p for p in quote.plans if p.policy_name == selected_name),
        quote.plans[min(1, len(quote.plans) - 1)] if quote.plans else None,
    )
    if selected_plan is None:
        raise HTTPException(status_code=500, detail="No policy plans found in database. Seed may be required.")


    # ── 5. Build narrative ────────────────────────────────────────────────────
    risk_phrases = {
        "high": f"Your zone ({zone_name}) is currently high-risk with a {prob:.0%} disruption probability",
        "moderate": f"Your zone ({zone_name}) shows moderate disruption risk ({prob:.0%})",
        "normal": f"Your zone ({zone_name}) is currently low-risk ({prob:.0%} disruption probability)",
    }
    risk_part = risk_phrases.get(risk_label, risk_phrases["normal"])
    rel_part = (
        f"Your reliability score of {reliability} qualifies you for an upgraded tier." if reliability_boost
        else f"Your reliability score is {reliability}."
    )
    claim_part = (
        f" Your recent activity ({claim_count} claim(s) in 30 days) suggests you need broader coverage." if claim_count > 0 else ""
    )
    reason = f"{risk_part}.{claim_part} {rel_part} Based on this, we recommend {selected_name} — the best fit for your risk profile."

    logger.info(
        "Recommendation for rider %s zone=%s risk=%s claims=%d reliability=%d -> %s",
        rider_id, zone_name, risk_label, claim_count, reliability, selected_name,
    )

    return PolicyRecommendation(
        recommended_plan=selected_plan,
        reason=reason,
        risk_label=risk_label,
        disruption_probability=prob,
        claim_count_30d=claim_count,
        reliability_score=reliability,
        zone_name=zone_name,
        quote=quote,
    )




@router.get("", response_model=list[PolicyRead])
async def list_policies(
    request: Request,
    db: Session = Depends(get_db),
) -> list[PolicyRead]:
    """Return all active insurance policy tiers.

    Returns the full spec for Basic Shield, Standard Guard, and Premium Armor,
    including trigger thresholds, payout amounts, and feature flags.
    """
    if not getattr(request.app.state, "database_ready", False):
        raise HTTPException(status_code=503, detail="Database is unavailable.")
    policies = get_all_policies(db)
    return [PolicyRead.model_validate(p) for p in policies]


@router.get("/rider/{rider_id}", response_model=RiderPolicyRead | None)
async def get_rider_policy(
    rider_id: int,
    request: Request,
    db: Session = Depends(get_db),
) -> RiderPolicyRead | None:
    """Return the currently active policy for a rider, or null if uninsured."""
    if not getattr(request.app.state, "database_ready", False):
        raise HTTPException(status_code=503, detail="Database is unavailable.")
    enrollment = get_rider_active_policy(db, rider_id)
    if enrollment is None:
        return None
    return RiderPolicyRead.model_validate(enrollment)


@router.get("/{policy_name}", response_model=PolicyRead)
async def get_policy(
    policy_name: str,
    request: Request,
    db: Session = Depends(get_db),
) -> PolicyRead:
    """Return the full spec for a specific policy tier by name."""
    if not getattr(request.app.state, "database_ready", False):
        raise HTTPException(status_code=503, detail="Database is unavailable.")
    policy = get_policy_by_name(db, policy_name)
    if policy is None:
        raise HTTPException(
            status_code=404,
            detail=f"Policy '{policy_name}' not found. Available: Basic Shield, Standard Guard, Premium Armor.",
        )
    return PolicyRead.model_validate(policy)


@router.post("/subscribe", response_model=RiderPolicyRead, status_code=201)
async def subscribe_to_policy(
    payload: RiderPolicyCreate,
    request: Request,
    db: Session = Depends(get_db),
) -> RiderPolicyRead:
    """Subscribe a rider to an insurance policy tier.

    Any existing active subscription is deactivated before the new one is created.
    The waiting period begins immediately; eligible_from indicates the first claim date.
    """
    if not getattr(request.app.state, "database_ready", False):
        raise HTTPException(status_code=503, detail="Database is unavailable.")
    try:
        return subscribe_rider_to_policy(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/quote", response_model=PolicyQuoteResponse)
async def quote_policy(
    payload: PolicyQuoteRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> PolicyQuoteResponse:
    """Return ML risk-adjusted premium quotes for a rider's home zone.

    Fetches current zone conditions (simulated if no live data yet), runs the
    disruption ML model, converts the risk_label to a price multiplier, and
    returns all three plan tiers with both base and quoted premiums.

    The quoted_premium_inr on each plan is what the rider will be charged —
    it reflects real-time disruption risk in their zone, not a flat catalogue price.
    """
    if not getattr(request.app.state, "database_ready", False):
        raise HTTPException(status_code=503, detail="Database is unavailable.")
    try:
        return quote_policies_for_zone(db, payload)
    except Exception as exc:
        logger.error(f"Premium quote failed for zone={payload.zone_name!r}: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Could not generate quote: {exc}") from exc


@router.get("/exclusions", tags=["policies"])
async def get_exclusions() -> dict:
    """Return the mandatory insurance exclusions for all policy tiers.

    These exclusions are non-negotiable and cannot be waived or appealed.
    The frontend displays them in the plan picker 'What's Not Covered' section.
    Reference: IRDAI Master Circular 2023 Section 4 — General Exclusions.
    """
    # Defined here (mirrors claim_service.py check_exclusions) so the endpoint
    # is self-contained and requires no import from the service layer.
    MANDATORY_EXCLUSIONS = [
        {"id": "war",               "icon": "⚔️",  "label": "War & Armed Conflict"},
        {"id": "pandemic",          "icon": "🦠",  "label": "Pandemic / Gov't Lockdown"},
        {"id": "terrorism",         "icon": "💣",  "label": "Terrorism & Political Violence"},
        {"id": "nuclear",           "icon": "☢️",  "label": "Nuclear & Radiological Events"},
        {"id": "curfew_government", "icon": "🚫",  "label": "Govt.-Ordered Curfew (Sec. 144)"},
    ]
    return {
        "policy_scope": "All tiers — HustleGuard Protection",
        "note": (
            "HustleGuard covers weather, AQI, and traffic disruptions only. "
            "The following events are categorically excluded under all policy tiers."
        ),
        "exclusions": MANDATORY_EXCLUSIONS,
        "reference": "IRDAI Master Circular 2023, Section 4",
    }


@router.get("/document", tags=["policies"])
async def get_policy_document() -> dict:
    """Return the HustleGuard Protection policy document.

    Machine-readable version of coverage terms, mandatory exclusions, and
    trigger thresholds. The frontend displays this in the profile T&C section
    and at the bottom of the onboarding plan selector.
    """
    return {
        "product_name": "HustleGuard Protection",
        "product_type": "Parametric Micro-Insurance",
        "issuer": "HustleGuard AI",
        "regulatory_note": "This is a parametric product tied to objective data triggers, not loss assessment.",
        "coverage_triggers": {
            "description": "Payouts are automatic when zone data breaches any of the following thresholds:",
            "Basic Shield":    { "dai_below": 0.35, "rainfall_above_mm": 90, "aqi_above": 450 },
            "Standard Guard":  { "dai_below": 0.40, "rainfall_above_mm": 80, "aqi_above": 350 },
            "Premium Armor":   { "dai_below": 0.50, "rainfall_above_mm": 65, "aqi_above": 250 },
        },
        "covered_events": [
            "Heavy rainfall / flooding causing delivery stoppage",
            "Hazardous AQI levels (PM2.5 / ozone)",
            "Severe traffic gridlock (traffic speed < 10 km/h)",
            "Combined adverse conditions measured by zone Delivery Activity Index (DAI)",
        ],
        "mandatory_exclusions": {
            "description": (
                "The following events are categorically excluded from coverage under all policy tiers. "
                "These exclusions cannot be waived, overridden, or appealed. "
                "Reference: IRDAI Master Circular 2023, Section 4 — General Exclusions."
            ),
            "exclusions": [
                {
                    "id": "war",
                    "label": "War & Armed Conflict",
                    "detail": (
                        "Any loss arising from war, invasion, acts of foreign enemies, hostilities "
                        "(whether war be declared or not), civil war, mutiny, or military uprising."
                    ),
                },
                {
                    "id": "pandemic",
                    "label": "Pandemic & National Health Emergency",
                    "detail": (
                        "Any loss during a period of government-declared pandemic, epidemic, or "
                        "national public health emergency including government-mandated lockdowns. "
                        "Note: weather disruptions occurring concurrently with (but independent of) "
                        "a pandemic ARE covered if they meet parametric thresholds."
                    ),
                },
                {
                    "id": "terrorism",
                    "label": "Terrorism & Political Violence",
                    "detail": (
                        "Any loss directly caused by or arising from an act of terrorism, sabotage, "
                        "political violence, or civil commotion motivated by political, religious, or "
                        "ideological beliefs."
                    ),
                },
                {
                    "id": "nuclear",
                    "label": "Nuclear, Chemical & Radiological Incidents",
                    "detail": (
                        "Any loss caused by nuclear reaction, radiation, radioactive contamination, "
                        "chemical or biological weapons, or any allied or associated event."
                    ),
                },
                {
                    "id": "curfew_government",
                    "label": "Government-Imposed Curfew (Section 144 / Police Order)",
                    "detail": (
                        "Losses arising solely from a government-ordered curfew or Section 144 order "
                        "are excluded. Traffic / delivery curfews caused by weather events (flooding, "
                        "cyclones) ARE covered if parametric thresholds are independently met."
                    ),
                },
            ],
        },
        "payout_process": {
            "parametric_auto": "Automatic — no rider action required. Triggered by zone data breach.",
            "manual_distress": "Rider-initiated via panic button. Fraud-scored within 47–300 seconds.",
            "partial_disruption": "Prorated payout for grey-zone DAI (0.40–0.55). Standard Guard+ only.",
            "community": "5+ riders signal distress in 10 minutes triggers community payout.",
            "appeal": "Rejected claims can be appealed within 24–72 hours depending on tier.",
        },
        "waiting_period": {
            "Basic Shield": "7 days from enrollment",
            "Standard Guard": "3 days from enrollment",
            "Premium Armor": "No waiting period",
            "emergency_override": "Waiting period waived during active zone disruption (DAI < 0.50 or rainfall > 60mm)",
        },
        "data_sources": [
            "OpenWeatherMap — real-time rainfall and temperature",
            "WeatherAPI — backup weather source",
            "AQICN / WAQI — real-time AQI by coordinates",
            "Google Maps — live traffic speed estimation",
            "HustleGuard ML Model — Delivery Activity Index (DAI) prediction",
        ],
        "version": "2.1.0",
        "effective_date": "2026-04-01",
    }
