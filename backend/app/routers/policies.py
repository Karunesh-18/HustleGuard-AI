"""Policies router — manage insurance tier definitions and rider enrollments.

Endpoints:
  GET  /api/v1/policies                  — list all available tiers
  GET  /api/v1/policies/{policy_name}    — single tier detail
  POST /api/v1/policies/subscribe        — subscribe rider to a tier
  GET  /api/v1/policies/rider/{rider_id} — active policy for a rider
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import PolicyRead, RiderPolicyCreate, RiderPolicyRead
from app.services.policy_service import (
    get_all_policies,
    get_policy_by_name,
    get_rider_active_policy,
    subscribe_rider_to_policy,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/policies", tags=["policies"])


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
