"""Domain models for live data, subscriptions, and payout events.

The Rider model is defined in models/rider.py (unified with onboarding fields).
This module re-exports it for convenience and adds Subscription, ZoneSnapshot,
PayoutEvent, and FraudAuditLog.
"""
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, JSON
from sqlalchemy.orm import relationship

from app.database import Base

# Re-export the unified Rider from rider.py (single definition)
from app.models.rider import Rider  # noqa: F401


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    rider_id = Column(Integer, ForeignKey("riders.id", ondelete="CASCADE"), nullable=False, index=True)
    plan_name = Column(String, nullable=False)
    weekly_premium = Column(Float, nullable=False)
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    rider = relationship("Rider", foreign_keys=[rider_id])


class ZoneSnapshot(Base):
    __tablename__ = "zone_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    zone_name = Column(String, nullable=False, unique=True)
    rainfall_mm = Column(Float, nullable=False)
    aqi = Column(Integer, nullable=False)
    traffic_index = Column(Integer, nullable=False)
    dai = Column(Float, nullable=False)
    workability_score = Column(Integer, nullable=False)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Phase 3 — real API enrichment fields (nullable for backward compat)
    # "real" when fetched from live APIs, "simulated" when using the simulation layer
    data_source = Column(String, nullable=True, default="simulated")
    temperature_celsius = Column(Float, nullable=True)     # from OWM / WeatherAPI
    dominant_pollutant = Column(String, nullable=True)     # from AQICN (e.g. "pm25")
    traffic_speed_kmh = Column(Float, nullable=True)       # from Google Maps


class PayoutEvent(Base):
    __tablename__ = "payout_events"

    id = Column(Integer, primary_key=True, index=True)
    zone_name = Column(String, nullable=False, index=True)
    trigger_reason = Column(String, nullable=False)
    payout_amount_inr = Column(Float, nullable=False)
    eligible_riders = Column(Integer, nullable=False)
    event_time = Column(DateTime, nullable=False, default=datetime.utcnow)


class FraudAuditLog(Base):
    """Persists fraud evaluation decisions for audit trails and trend analysis."""

    __tablename__ = "fraud_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    rider_id = Column(Integer, nullable=False, index=True)
    zone_id = Column(Integer, nullable=False)
    # Numeric trust score (0-100) from the fraud evaluation
    trust_score = Column(Float, nullable=False)
    # Decision band: green / yellow / orange / red
    decision_band = Column(String, nullable=False, index=True)
    # Decision string: instant_payout / provisional_payout_with_review / manual_review_required / hold_or_reject
    decision = Column(String, nullable=False)
    # Serialised list of reason strings
    reasons = Column(String, nullable=False)  # JSON-encoded list
    evaluated_at = Column(DateTime, nullable=False, default=datetime.utcnow)
