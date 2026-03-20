from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


# ─── Existing zone / rider / claim / payout schemas (unchanged) ───────────────

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


# ─── Zone live data (matches ZoneSnapshot in models/domain.py) ────────────────

class ZoneLiveDataRead(BaseModel):
    zone_name: str
    rainfall_mm: float
    aqi: int
    traffic_index: int
    dai: float
    workability_score: int
    updated_at: str  # ISO string for JSON serialisation


# ─── Payout events (matches PayoutEvent in models/domain.py) ─────────────────

class PayoutEventRead(BaseModel):
    id: int
    zone_name: str
    trigger_reason: str
    payout_amount_inr: float
    eligible_riders: int
    event_time: str  # ISO string


# ─── Rider onboard — frontend-compatible schema ──────────────────────────────

class RiderOnboardCreate(BaseModel):
    name: str
    email: str
    city: str
    home_zone: str
    reliability_score: int = Field(default=60, ge=0, le=100)


class RiderOnboardRead(BaseModel):
    id: int
    name: str
    email: str
    city: str
    home_zone: str
    reliability_score: int
    created_at: str  # ISO string


# ─── Subscriptions ────────────────────────────────────────────────────────────

class SubscriptionCreate(BaseModel):
    rider_id: int = Field(gt=0)
    plan_name: str = "Weekly Shield"


class SubscriptionRead(BaseModel):
    id: int
    rider_id: int
    plan_name: str
    weekly_premium: float
    active: bool
    created_at: str  # ISO string


# ─── Premium calculation ─────────────────────────────────────────────────────

class PremiumCalculateRequest(BaseModel):
    zone_risk_level: str = Field(default="medium", description="low | medium | high")
    reliability_score: float = Field(default=60.0, ge=0, le=100)


class PremiumCalculateResponse(BaseModel):
    weekly_premium_inr: float
    coverage_amount_inr: float
    risk_tier: str


# ─── Parametric trigger evaluation ───────────────────────────────────────────

class TriggerEvaluateRequest(BaseModel):
    zone_id: int = Field(gt=0)
    rainfall: float = Field(ge=0)
    aqi: float = Field(alias="AQI", ge=0)
    traffic_speed: float = Field(ge=0)
    current_dai: float = Field(ge=0, le=1)

    model_config = ConfigDict(populate_by_name=True)


class TriggerEvaluateResponse(BaseModel):
    triggered: bool
    disruption_probability: float
    predicted_dai: float
    risk_label: str
    trigger_reason: str | None = None
    payout_event_id: int | None = None


from app.schemas.fraud import FraudEvaluationRequest  # noqa: E402

ClaimEvaluationRequest.model_rebuild()
