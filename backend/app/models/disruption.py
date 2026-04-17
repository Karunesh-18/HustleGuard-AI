from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.sql import func

from app.database import Base


class Disruption(Base):
    __tablename__ = "disruptions"

    id = Column(Integer, primary_key=True, index=True)
    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=False, index=True)
    event_type = Column(String, nullable=False)
    severity = Column(String, nullable=False, default="moderate")
    rainfall = Column(Float, nullable=False, default=0.0)
    aqi = Column(Float, nullable=False, default=0.0)
    average_traffic_speed = Column(Float, nullable=False, default=0.0)
    zone_dai = Column(Float, nullable=False, default=1.0)
    started_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    ended_at = Column(DateTime(timezone=True), nullable=True)

    # Phase 3 — concurrent disruption detection
    # True when ≥1 other zone was also disrupted at the same time this event fired.
    # Concurrent events signal city-wide conditions (heavy storm, AQI emergency) vs
    # isolated incidents, and affect insurance exposure calculations.
    is_concurrent = Column(Boolean, nullable=False, default=False)

    # Comma-separated list of other zone names that were simultaneously disrupted.
    # e.g. "Koramangala,HSR Layout" — stored as plain string for simplicity (no PostGIS yet).
    concurrent_zones = Column(String, nullable=True)