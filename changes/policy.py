"""
Policy Exclusions Router — HustleGuard AI

Exposes endpoints for:
  - GET /api/v1/policy/terms     → Full policy terms (what's covered, what's excluded)
  - POST /api/v1/policy/check-exclusion  → Check if a specific event is excluded
"""

import logging

from fastapi import APIRouter

from app.schemas.exclusions import (
    ExclusionCheckRequest,
    ExclusionCheckResult,
    PolicyTermsResponse,
)
from app.services.exclusions_service import check_exclusions, get_policy_terms

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/policy", tags=["policy"])


@router.get("/terms", response_model=PolicyTermsResponse)
async def get_full_policy_terms() -> PolicyTermsResponse:
    """
    Return the complete policy terms including all exclusions.

    This endpoint is called by:
    - Rider dashboard → Policy Terms section
    - Onboarding flow → Before subscription activation
    - Admin panel → Policy Management view
    """
    return get_policy_terms()


@router.post("/check-exclusion", response_model=ExclusionCheckResult)
async def check_event_exclusion(payload: ExclusionCheckRequest) -> ExclusionCheckResult:
    """
    Check whether a specific disruption event is subject to a policy exclusion.

    Called internally by the trigger evaluation flow before any payout fires.
    Also available externally for transparency — riders can check whether a
    specific event type would be covered before filing.
    """
    result = check_exclusions(payload)
    if result.is_excluded:
        logger.warning(
            f"Exclusion check API returned excluded | zone={payload.zone_id} "
            f"category={result.exclusion_category} severity={result.severity}"
        )
    return result
