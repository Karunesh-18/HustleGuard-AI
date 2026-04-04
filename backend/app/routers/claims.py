"""Claims router — all 5 claim type endpoints.

Endpoints:
  POST /api/v1/claims/evaluate-and-create    — parametric auto-claim (existing)
  POST /api/v1/claims/manual-distress        — panic button claim
  POST /api/v1/claims/partial-disruption     — prorated payout for grey-zone DAI
  POST /api/v1/claims/community              — community human-sensor claim
  POST /api/v1/claims/appeal                 — challenge a rejected claim
  GET  /api/v1/claims/rider/{rider_id}       — list all claims for a rider
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.claim import Claim
from app.schemas import (
    AppealClaimRequest,
    AppealClaimResponse,
    ClaimDecisionResponse,
    ClaimEvaluationRequest,
    ClaimRead,
    CommunityClaimRequest,
    CommunityClaimResponse,
    ManualDistressClaimRequest,
    ManualDistressClaimResponse,
    PartialDisruptionClaimRequest,
    PartialDisruptionClaimResponse,
)
from app.services.claim_service import (
    create_appeal_claim,
    create_claim_with_decision,
    create_manual_distress_claim,
    create_partial_disruption_claim,
    evaluate_community_claim,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/claims", tags=["claims"])

_DB_GUARD = "Database is unavailable."


def _require_db(request: Request) -> None:
    if not getattr(request.app.state, "database_ready", False):
        raise HTTPException(status_code=503, detail=_DB_GUARD)


# ── 1. Parametric Auto-Claim (existing) ──────────────────────────────────────

@router.post("/evaluate-and-create", response_model=ClaimDecisionResponse)
async def evaluate_and_create_claim(
    payload: ClaimEvaluationRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> ClaimDecisionResponse:
    """Create a parametric auto-claim (triggered by the system, not the rider).

    Validates fraud signals and creates an instant or provisional payout depending
    on the resulting trust score.
    """
    _require_db(request)

    if payload.claim.rider_id != payload.fraud.rider_id or payload.claim.zone_id != payload.fraud.zone_id:
        raise HTTPException(status_code=400, detail="Claim and fraud payload IDs must match.")

    return create_claim_with_decision(db, payload.claim, payload.fraud)


# ── 2. Manual Distress Claim (Panic Button) ──────────────────────────────────

@router.post("/manual-distress", response_model=ManualDistressClaimResponse, status_code=201)
async def manual_distress_claim(
    payload: ManualDistressClaimRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> ManualDistressClaimResponse:
    """Panic-button claim: rider taps 'I Can't Work' and picks one reason.

    No forms, no uploads.  The fraud engine auto-validates using GPS location,
    peer correlation, and zone DAI.  Returns a UPI-style payout countdown if
    trust score ≥ 80.
    """
    _require_db(request)
    try:
        return create_manual_distress_claim(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# ── 3. Partial Disruption Claim ───────────────────────────────────────────────

@router.post("/partial-disruption", response_model=PartialDisruptionClaimResponse, status_code=201)
async def partial_disruption_claim(
    payload: PartialDisruptionClaimRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> PartialDisruptionClaimResponse:
    """Prorated payout for grey-zone disruption (DAI 0.40–0.55).

    Payout = Base × (1 − current_DAI / normal_DAI)

    Only available for Standard Guard and Premium Armor policy holders.
    Returns the full calculation breakdown in the response.
    """
    _require_db(request)
    try:
        return create_partial_disruption_claim(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# ── 4. Community Claim (Human Sensor Layer) ───────────────────────────────────

@router.post("/community", response_model=CommunityClaimResponse, status_code=201)
async def community_claim(
    payload: CommunityClaimRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> CommunityClaimResponse:
    """Community disruption signal: 5+ riders in the same zone all signal distress.

    When 5+ riders tap 'I Can't Work' in the same zone within 10 minutes, the
    system treats it as ground truth even if weather APIs or AQI sensors are offline.
    This is the human sensor layer that supplements ML signals.

    Only available for Standard Guard and Premium Armor policy holders.
    """
    _require_db(request)
    try:
        return evaluate_community_claim(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# ── 5. Appeal Claim ───────────────────────────────────────────────────────────

@router.post("/appeal", response_model=AppealClaimResponse, status_code=201)
async def appeal_claim(
    payload: AppealClaimRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> AppealClaimResponse:
    """Challenge a rejected claim decision.

    The rider provides one clarification text. The system auto-pulls the rejection
    reason from the original claim and flags it for admin review.

    Appeal window: 24 hrs (Standard Guard) | 72 hrs (Premium Armor) | none (Basic Shield)
    """
    _require_db(request)
    try:
        return create_appeal_claim(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# ── GET — List claims for a rider ─────────────────────────────────────────────

@router.get("/rider/{rider_id}", response_model=list[ClaimRead])
async def list_rider_claims(
    rider_id: int,
    request: Request,
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 50,
) -> list[ClaimRead]:
    """Return all claims filed by a rider, newest first."""
    _require_db(request)
    claims = (
        db.query(Claim)
        .filter(Claim.rider_id == rider_id)
        .order_by(Claim.created_at.desc())
        .offset(skip)
        .limit(min(limit, 200))
        .all()
    )
    return [ClaimRead.model_validate(c) for c in claims]