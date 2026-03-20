from pydantic import BaseModel, ConfigDict, Field


class DisruptionPredictionRequest(BaseModel):
    rainfall: float = Field(ge=0)
    aqi: float = Field(alias="AQI", ge=0)
    traffic_speed: float = Field(ge=0)
    current_dai: float = Field(ge=0, le=1)

    temperature: float = Field(default=30.0)
    wind_speed: float = Field(default=10.0, ge=0)
    congestion_index: float = Field(default=0.5, ge=0, le=1)

    orders_last_5min: float = Field(default=70.0, ge=0)
    orders_last_15min: float = Field(default=190.0, ge=0)
    active_riders: float = Field(default=45.0, ge=0)
    average_delivery_time: float = Field(default=24.0, ge=0)

    hour_of_day: int | None = Field(default=None, ge=0, le=23)
    day_of_week: int | None = Field(default=None, ge=0, le=6)

    historical_disruption_frequency: float = Field(default=0.25, ge=0, le=1)
    zone_risk_score: float = Field(default=0.30, ge=0, le=1)

    model_config = ConfigDict(populate_by_name=True)


class DisruptionPredictionResponse(BaseModel):
    predicted_dai: float = Field(ge=0, le=1)
    disruption_probability: float = Field(ge=0, le=1)
    risk_label: str

    model_config = ConfigDict(from_attributes=True)
