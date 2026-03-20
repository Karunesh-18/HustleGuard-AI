"""Fraud evaluation router.

Evaluates rider fraud risk using environmental, behavioral, and network signals.
All evaluations are persisted to fraud_audit_logs for downstream audit trails.
"""

import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.domain import FraudAuditLog
from app.schemas import FraudEvaluationRequest, FraudEvaluationResponse
from app.services.fraud_service import evaluate_fraud_risk

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/fraud", tags=["fraud"])


@router.post("/evaluate", response_model=FraudEvaluationResponse)
async def evaluate_fraud(
    payload: FraudEvaluationRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> FraudEvaluationResponse:
    """Evaluate fraud risk for a rider claim and persist the audit log entry."""
    if not getattr(request.app.state, "database_ready", False):
        raise HTTPException(status_code=503, detail="Database is unavailable.")

    result = evaluate_fraud_risk(payload)

    # Persist audit log — every evaluation is recorded for trend analysis and compliance
    try:
        audit_entry = FraudAuditLog(
            rider_id=payload.rider_id,
            zone_id=payload.zone_id,
            trust_score=result.trust_score,
            decision_band=result.decision_band,
            decision=result.decision,
            reasons=json.dumps(result.reasons),
        )
        db.add(audit_entry)
        db.commit()
        logger.info(
            f"Fraud audit logged | rider={payload.rider_id} zone={payload.zone_id} "
            f"score={result.trust_score:.1f} decision={result.decision}"
        )
    except Exception as exc:
        # Audit log failure should not block the response — log and continue
        db.rollback()
        logger.error(f"Failed to persist fraud audit log: {exc}")

    return result