from fastapi import APIRouter

from app.schemas import FraudEvaluationRequest, FraudEvaluationResponse
from app.services.fraud_service import evaluate_fraud_risk

router = APIRouter(prefix="/api/v1/fraud", tags=["fraud"])


@router.post("/evaluate", response_model=FraudEvaluationResponse)
async def evaluate_fraud(payload: FraudEvaluationRequest) -> FraudEvaluationResponse:
    return evaluate_fraud_risk(payload)