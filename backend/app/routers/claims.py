from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import ClaimDecisionResponse, ClaimEvaluationRequest
from app.services.claim_service import create_claim_with_decision

router = APIRouter(prefix="/api/v1/claims", tags=["claims"])


@router.post("/evaluate-and-create", response_model=ClaimDecisionResponse)
async def evaluate_and_create_claim(
    payload: ClaimEvaluationRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> ClaimDecisionResponse:
    if not getattr(request.app.state, "database_ready", False):
        raise HTTPException(status_code=503, detail="Database is unavailable.")

    if payload.claim.rider_id != payload.fraud.rider_id or payload.claim.zone_id != payload.fraud.zone_id:
        raise HTTPException(status_code=400, detail="Claim and fraud payload IDs must match.")

    return create_claim_with_decision(db, payload.claim, payload.fraud)