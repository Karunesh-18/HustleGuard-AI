from sqlalchemy.orm import Session

from app.models import Claim, Payout
from app.schemas import ClaimCreate, ClaimDecisionResponse, ClaimRead, FraudEvaluationRequest, PayoutRead
from app.services.fraud_service import evaluate_fraud_risk


def create_claim_with_decision(
    db: Session,
    claim_in: ClaimCreate,
    fraud_in: FraudEvaluationRequest,
) -> ClaimDecisionResponse:
    fraud_result = evaluate_fraud_risk(fraud_in)

    claim = Claim(
        rider_id=claim_in.rider_id,
        zone_id=claim_in.zone_id,
        status=fraud_result.decision,
        trust_score=fraud_result.trust_score,
        decision=fraud_result.decision,
        reasons="; ".join(fraud_result.reasons),
    )
    db.add(claim)
    db.commit()
    db.refresh(claim)

    payout = None
    if fraud_result.decision in {"instant_payout", "provisional_payout_with_review"}:
        payout_status = "processing" if fraud_result.decision == "instant_payout" else "provisional"
        payout = Payout(claim_id=claim.id, amount_inr=claim_in.requested_amount_inr, status=payout_status)
        db.add(payout)
        db.commit()
        db.refresh(payout)

    return ClaimDecisionResponse(
        claim=ClaimRead.model_validate(claim),
        payout=PayoutRead.model_validate(payout) if payout else None,
        decision_band=fraud_result.decision_band,
        decision=fraud_result.decision,
        reasons=fraud_result.reasons,
    )