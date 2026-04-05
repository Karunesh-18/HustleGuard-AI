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

import threading
import time
from collections import defaultdict

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/claims", tags=["claims"])

_DB_GUARD = "Database is unavailable."

# ── In-process rate limiter for manual-distress endpoint ─────────────────────
# Limits each rider_id to DISTRESS_MAX_PER_WINDOW calls in DISTRESS_WINDOW_SECONDS.
# Uses a sliding window (per-rider timestamp list) protected by a lock.
# This is suitable for a single-process server; for multi-worker deployments
# switch to a Redis-backed counter (e.g. slowapi with Redis backend).
_DISTRESS_WINDOW_SECONDS = 60
_DISTRESS_MAX_PER_WINDOW = 5
_distress_calls: dict[int, list[float]] = defaultdict(list)
_distress_lock = threading.Lock()


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

    # Rate limit: max 5 distress submissions per rider per 60 seconds
    now = time.monotonic()
    with _distress_lock:
        timestamps = _distress_calls[payload.rider_id]
        # Evict calls outside the sliding window
        timestamps[:] = [t for t in timestamps if now - t < _DISTRESS_WINDOW_SECONDS]
        if len(timestamps) >= _DISTRESS_MAX_PER_WINDOW:
            retry_in = int(_DISTRESS_WINDOW_SECONDS - (now - timestamps[0])) + 1
            raise HTTPException(
                status_code=429,
                detail=(
                    f"Too many distress submissions — please wait {retry_in}s before trying again."
                ),
                headers={"Retry-After": str(retry_in)},
            )
        timestamps.append(now)

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
    """Return all claims filed by a rider, newest first. Returns empty list if rider has no claims."""
    _require_db(request)
    try:
        claims = (
            db.query(Claim)
            .filter(Claim.rider_id == rider_id)
            .order_by(Claim.created_at.desc())
            .offset(skip)
            .limit(min(limit, 200))
            .all()
        )
        return [ClaimRead.model_validate(c) for c in claims]
    except Exception as exc:
        logger.warning(f"Failed to fetch claims for rider {rider_id}: {exc}")
        return []