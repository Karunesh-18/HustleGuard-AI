from datetime import datetime
from typing import Literal, Optional

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
    """Extended ClaimRead — covers all 5 claim types."""
    id: int
    rider_id: int
    zone_id: int
    status: str
    trust_score: float
    decision: str
    reasons: str
    created_at: datetime

    # Claim type and type-specific fields
    claim_type: str = "parametric_auto"
    distress_reason: Optional[str] = None
    base_payout_inr: Optional[float] = None
    partial_payout_ratio: Optional[float] = None
    current_dai_at_claim: Optional[float] = None
    community_trigger_count: Optional[int] = None
    appeal_of_claim_id: Optional[int] = None
    appeal_clarification: Optional[str] = None
    appeal_status: Optional[str] = None

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
    # Optional rider_id for policy-aware threshold selection
    rider_id: Optional[int] = Field(default=None, gt=0)

    model_config = ConfigDict(populate_by_name=True)


class TriggerEvaluateResponse(BaseModel):
    triggered: bool
    disruption_probability: float
    predicted_dai: float
    risk_label: str
    trigger_reason: str | None = None
    payout_event_id: int | None = None
    # Policy context shown when rider_id is provided
    policy_name: str | None = None
    dai_threshold_used: float | None = None


# ─── Policy Tiers ─────────────────────────────────────────────────────────────

class PolicyRead(BaseModel):
    """Full policy tier specification returned to the frontend."""
    id: int
    name: str
    weekly_premium_inr: float
    payout_per_disruption_inr: float
    dai_trigger_threshold: float
    rainfall_trigger_mm: float
    aqi_trigger_threshold: float
    max_claims_per_week: int
    supports_partial_disruption: bool
    supports_community_claims: bool
    appeal_window_hours: int
    waiting_period_days: int
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class RiderPolicyCreate(BaseModel):
    rider_id: int = Field(gt=0)
    policy_name: str = Field(description="Basic Shield | Standard Guard | Premium Armor")


class RiderPolicyRead(BaseModel):
    id: int
    rider_id: int
    policy_id: int
    policy_name: str
    active: bool
    enrolled_at: datetime
    eligible_from: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ─── Manual Distress Claim (Panic Button) ─────────────────────────────────────

class ManualDistressClaimRequest(BaseModel):
    rider_id: int = Field(gt=0)
    zone_id: int = Field(gt=0)
    # The one question the rider answers
    reason: Literal["Rain", "Traffic", "Curfew", "Other"]
    # Fraud signals (simplified subset for distress flow)
    zone_dai: float = Field(ge=0, le=1, description="Current zone DAI")
    rainfall: float = Field(default=0.0, ge=0)
    aqi: float = Field(default=100.0, alias="AQI", ge=0)
    traffic_speed: float = Field(default=20.0, ge=0)
    city_from_gps: str = Field(default="Bangalore")
    city_from_ip: str = Field(default="Bangalore")
    historical_zone_visits: int = Field(default=5, ge=0)
    claim_count_last_30_days: int = Field(default=0, ge=0)
    teleport_distance_km: float = Field(default=0.5, ge=0)
    teleport_time_minutes: float = Field(default=2.0, gt=0)
    peer_claims_last_15m: int = Field(default=0, ge=0)
    mock_location_detected: bool = False
    developer_mode_enabled: bool = False
    rooted_or_emulator: bool = False

    model_config = ConfigDict(populate_by_name=True)


class ManualDistressClaimResponse(BaseModel):
    claim: ClaimRead
    payout: PayoutRead | None = None
    trust_score: float
    decision: str
    decision_band: str
    # Estimated seconds until payout hits the rider's UPI
    estimated_payout_seconds: int
    reasons: list[str]


# ─── Partial Disruption Claim ─────────────────────────────────────────────────

class PartialDisruptionClaimRequest(BaseModel):
    rider_id: int = Field(gt=0)
    zone_id: int = Field(gt=0)
    current_dai: float = Field(ge=0, le=1, description="Observed DAI at time of claim")
    normal_dai: float = Field(default=1.0, ge=0, le=1, description="Baseline expected DAI")
    # Fraud signals
    zone_dai: float = Field(ge=0, le=1)
    rainfall: float = Field(default=0.0, ge=0)
    aqi: float = Field(default=100.0, alias="AQI", ge=0)
    traffic_speed: float = Field(default=20.0, ge=0)
    city_from_gps: str = Field(default="Bangalore")
    city_from_ip: str = Field(default="Bangalore")
    historical_zone_visits: int = Field(default=5, ge=0)
    claim_count_last_30_days: int = Field(default=0, ge=0)
    teleport_distance_km: float = Field(default=0.5, ge=0)
    teleport_time_minutes: float = Field(default=2.0, gt=0)
    peer_claims_last_15m: int = Field(default=0, ge=0)
    mock_location_detected: bool = False
    developer_mode_enabled: bool = False
    rooted_or_emulator: bool = False

    model_config = ConfigDict(populate_by_name=True)


class PartialDisruptionClaimResponse(BaseModel):
    claim: ClaimRead
    payout: PayoutRead | None = None
    trust_score: float
    decision: str
    # Payout math breakdown
    base_payout_inr: float
    payout_ratio: float           # 1 - (current_dai / normal_dai)
    prorated_payout_inr: float    # base * ratio
    calculation: str              # human-readable formula
    reasons: list[str]


# ─── Community Claim ──────────────────────────────────────────────────────────

class CommunityClaim(BaseModel):
    """Single rider signal within a community claim."""
    rider_id: int = Field(gt=0)
    zone_id: int = Field(gt=0)


class CommunityClaimRequest(BaseModel):
    """
    Submitted when 5+ riders in the same zone all tap 'I Can't Work' within 10 min.
    The frontend collects the cohort and sends them as a batch.
    """
    zone_id: int = Field(gt=0)
    zone_name: str
    rider_signals: list[CommunityClaim] = Field(min_length=5)
    # Current zone conditions at the time of community signal
    current_dai: float = Field(ge=0, le=1)
    rainfall: float = Field(default=0.0, ge=0)
    aqi: float = Field(default=100.0, alias="AQI", ge=0)

    model_config = ConfigDict(populate_by_name=True)


class CommunityClaimResponse(BaseModel):
    triggered: bool
    rider_count: int
    zone_name: str
    payout_per_rider_inr: float
    total_payout_inr: float
    reason: str
    claims: list[ClaimRead]


# ─── Appeal Claim ─────────────────────────────────────────────────────────────

class AppealClaimRequest(BaseModel):
    original_claim_id: int = Field(gt=0)
    rider_id: int = Field(gt=0)
    clarification_text: str = Field(min_length=10, max_length=1000)


class AppealClaimResponse(BaseModel):
    claim: ClaimRead
    original_claim_id: int
    appeal_status: str      # pending | approved | rejected
    appeal_window_hours: int
    review_eta: str
    reasons: list[str]


from app.schemas.fraud import FraudEvaluationRequest  # noqa: E402

ClaimEvaluationRequest.model_rebuild()



class ZoneRead(BaseModel):
    id: int
    name: str
    city: str
    baseline_orders_per_hour: float
    baseline_active_riders: float
    baseline_delivery_time_minutes: float
    risk_level: str

    model_config = ConfigDict(from_attributes=True)


# ─── ML-Driven Premium Quoting ────────────────────────────────────────────────

class PolicyQuoteRequest(BaseModel):
    """Request to get ML-adjusted premium quotes for a rider's home zone."""
    zone_name: str = Field(description="Rider's selected home zone")
    reliability_score: float = Field(default=60.0, ge=0, le=100, description="Rider reliability (0–100)")


class ZoneConditionsSnapshot(BaseModel):
    """Current zone conditions used to drive the ML premium calculation."""
    rainfall_mm: float
    aqi: int
    traffic_index: int
    dai: float


class PolicyQuotedPlan(BaseModel):
    """A single plan with both its base and ML risk-adjusted premium."""
    policy_id: int
    policy_name: str
    base_premium_inr: float          # flat seeded price from DB
    quoted_premium_inr: float        # ML-adjusted price for this zone right now
    risk_multiplier: float           # e.g. 1.45 for high-risk zone
    payout_per_disruption_inr: float
    dai_trigger_threshold: float
    max_claims_per_week: int
    supports_partial_disruption: bool
    supports_community_claims: bool
    waiting_period_days: int


class PolicyQuoteResponse(BaseModel):
    """Full quote response: ML context + one quoted plan per tier."""
    zone_name: str
    risk_label: str                  # "normal" | "moderate" | "high"
    disruption_probability: float    # 0.0–1.0 from ML classifier
    predicted_dai: float             # ML-predicted zone DAI
    risk_multiplier: float           # multiplier applied to all plan premiums
    zone_conditions: ZoneConditionsSnapshot
    plans: list[PolicyQuotedPlan]




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


from app.schemas.fraud import FraudEvaluationRequest  # noqa: E402

ClaimEvaluationRequest.model_rebuild()
