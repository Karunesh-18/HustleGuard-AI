"""Premium calculation service.

Weekly premium is determined by zone risk level and rider reliability.
Coverage amount is set to ~18× the weekly premium so that a ₹32/week
rider gets ₹600 per disruption event.
"""

import logging

from app.schemas import PremiumCalculateRequest, PremiumCalculateResponse

logger = logging.getLogger(__name__)

# Risk multipliers by zone risk level
_RISK_MULTIPLIERS: dict[str, float] = {
    "low": 0.80,
    "medium": 1.00,
    "high": 1.40,
    "critical": 1.80,
}

_BASE_PREMIUM_INR = 25.0
_COVERAGE_MULTIPLIER = 18.75  # 25 * 1.0 * 18.75 = ₹468 → ~₹600 for high risk


def calculate_weekly_premium(request: PremiumCalculateRequest) -> PremiumCalculateResponse:
    """Calculate weekly premium and coverage amount based on zone risk and reliability score."""
    risk_tier = request.zone_risk_level.lower()
    multiplier = _RISK_MULTIPLIERS.get(risk_tier, 1.0)

    # Reliability discount: better riders pay slightly less (±10 INR max)
    reliability_discount = (request.reliability_score - 50.0) * 0.10
    reliability_discount = max(-10.0, min(10.0, reliability_discount))

    weekly_premium = round(_BASE_PREMIUM_INR * multiplier - reliability_discount, 2)
    weekly_premium = max(10.0, weekly_premium)  # floor at ₹10/week

    coverage_amount = round(weekly_premium * _COVERAGE_MULTIPLIER, 2)

    logger.info(
        f"Premium calc | zone_risk={risk_tier} reliability={request.reliability_score:.0f} "
        f"-> premium=₹{weekly_premium} coverage=₹{coverage_amount}"
    )

    return PremiumCalculateResponse(
        weekly_premium_inr=weekly_premium,
        coverage_amount_inr=coverage_amount,
        risk_tier=risk_tier,
    )


def premium_from_components(zone_risk_level: str, reliability_score: float) -> float:
    """Helper used by subscription creation to get premium without building the full schema."""
    req = PremiumCalculateRequest(
        zone_risk_level=zone_risk_level,
        reliability_score=reliability_score,
    )
    return calculate_weekly_premium(req).weekly_premium_inr
