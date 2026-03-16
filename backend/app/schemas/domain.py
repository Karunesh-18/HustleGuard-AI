from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ZoneLiveData(BaseModel):
    zone_name: str
    rainfall_mm: float
    aqi: int
    traffic_index: int
    dai: float
    workability_score: int
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PayoutRead(BaseModel):
    id: int
    zone_name: str
    trigger_reason: str
    payout_amount_inr: float
    eligible_riders: int
    event_time: datetime

    model_config = ConfigDict(from_attributes=True)


class RiderOnboardCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str
    city: str = Field(min_length=2, max_length=80)
    home_zone: str = Field(min_length=2, max_length=80)


class RiderRead(BaseModel):
    id: int
    name: str
    email: str
    city: str
    home_zone: str
    reliability_score: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SubscriptionCreate(BaseModel):
    rider_id: int
    plan_name: str = Field(min_length=3, max_length=80)


class SubscriptionRead(BaseModel):
    id: int
    rider_id: int
    plan_name: str
    weekly_premium: float
    active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
