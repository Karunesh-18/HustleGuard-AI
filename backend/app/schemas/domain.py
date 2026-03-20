from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ZoneCreate(BaseModel):
    name: str
    city: str
    baseline_orders_per_hour: float = Field(default=100.0, gt=0)
    baseline_active_riders: float = Field(default=40.0, gt=0)
    baseline_delivery_time_minutes: float = Field(default=25.0, gt=0)
    risk_level: str = Field(default="medium")


class ZoneRead(BaseModel):
    id: int
    name: str
    city: str
    baseline_orders_per_hour: float
    baseline_active_riders: float
    baseline_delivery_time_minutes: float
    risk_level: str

    model_config = ConfigDict(from_attributes=True)


class RiderCreate(BaseModel):
    external_worker_id: str
    display_name: str
    reliability_score: float = Field(default=50.0, ge=0, le=100)
    reputation_tier: str = Field(default="silver")
    is_probation: bool = False


class RiderRead(BaseModel):
    id: int
    external_worker_id: str
    display_name: str
    reliability_score: float
    reputation_tier: str
    is_probation: bool

    model_config = ConfigDict(from_attributes=True)


class ClaimCreate(BaseModel):
    rider_id: int = Field(gt=0)
    zone_id: int = Field(gt=0)
    requested_amount_inr: float = Field(gt=0)


class ClaimEvaluationRequest(BaseModel):
    claim: ClaimCreate
    fraud: "FraudEvaluationRequest"


class ClaimRead(BaseModel):
    id: int
    rider_id: int
    zone_id: int
    status: str
    trust_score: float
    decision: str
    reasons: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PayoutRead(BaseModel):
    id: int
    claim_id: int
    amount_inr: float
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ClaimDecisionResponse(BaseModel):
    claim: ClaimRead
    payout: PayoutRead | None = None
    decision_band: str
    decision: str
    reasons: list[str]


from app.schemas.fraud import FraudEvaluationRequest  # noqa: E402

ClaimEvaluationRequest.model_rebuild()
