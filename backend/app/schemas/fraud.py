from pydantic import BaseModel, ConfigDict, Field


class FraudSignalBreakdown(BaseModel):
    environmental_consistency: float = Field(ge=0, le=100)
    dai_zone_consistency: float = Field(ge=0, le=100)
    behavioral_continuity: float = Field(ge=0, le=100)
    motion_realism: float = Field(ge=0, le=100)
    ip_network_consistency: float = Field(ge=0, le=100)
    peer_coordination_safety: float = Field(ge=0, le=100)


class FraudEvaluationRequest(BaseModel):
    rider_id: int = Field(gt=0)
    zone_id: int = Field(gt=0)

    rainfall: float = Field(ge=0)
    aqi: float = Field(alias="AQI", ge=0)
    traffic_speed: float = Field(ge=0)
    zone_dai: float = Field(ge=0, le=1)

    city_from_gps: str
    city_from_ip: str

    historical_zone_visits: int = Field(ge=0)
    claim_count_last_30_days: int = Field(ge=0)
    teleport_distance_km: float = Field(ge=0)
    teleport_time_minutes: float = Field(gt=0)

    developer_mode_enabled: bool = False
    mock_location_detected: bool = False
    rooted_or_emulator: bool = False

    peer_claims_last_15m: int = Field(default=0, ge=0)
    subnet_cluster_size: int = Field(default=0, ge=0)

    model_config = ConfigDict(populate_by_name=True)


class FraudEvaluationResponse(BaseModel):
    trust_score: float = Field(ge=0, le=100)
    decision_band: str
    decision: str
    reasons: list[str]
    signal_breakdown: FraudSignalBreakdown
