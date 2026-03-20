from fastapi import APIRouter

from app.schemas import DisruptionPredictionRequest, DisruptionPredictionResponse
from app.services.ml_service import predict_disruption

router = APIRouter(tags=["ml"])


@router.post("/predict-disruption", response_model=DisruptionPredictionResponse)
async def predict_disruption_endpoint(payload: DisruptionPredictionRequest) -> DisruptionPredictionResponse:
    return predict_disruption(payload)
