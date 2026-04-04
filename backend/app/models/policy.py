"""Policy tier model.

Stores the three insurance product tiers (Basic Shield, Standard Guard, Premium Armor).
Each tier carries its own trigger thresholds (DAI, rainfall, AQI), payout amount,
weekly premium, and feature flags (partial disruption, community claims, appeal window).

This is seeded at startup via policy_service.seed_default_policies() so the tiers
are always present without a manual migration step.
"""

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String

from app.database import Base


class Policy(Base):
    __tablename__ = "policies"

    id = Column(Integer, primary_key=True, index=True)

    # Human-readable tier name: "Basic Shield" | "Standard Guard" | "Premium Armor"
    name = Column(String, nullable=False, unique=True, index=True)

    # Weekly premium the rider pays
    weekly_premium_inr = Column(Float, nullable=False)

    # Fixed payout amount per disruption event
    payout_per_disruption_inr = Column(Float, nullable=False)

    # Parametric trigger thresholds — lower DAI = wider coverage for Premium
    dai_trigger_threshold = Column(Float, nullable=False)   # trigger fires when DAI < this
    rainfall_trigger_mm = Column(Float, nullable=False)      # trigger fires when rain > this
    aqi_trigger_threshold = Column(Float, nullable=False)    # trigger fires when AQI > this

    # Claim limits
    max_claims_per_week = Column(Integer, nullable=False)

    # Feature flags
    supports_partial_disruption = Column(Boolean, nullable=False, default=False)
    supports_community_claims = Column(Boolean, nullable=False, default=False)

    # Appeal window in hours; 0 = no appeals allowed
    appeal_window_hours = Column(Integer, nullable=False, default=0)

    # Waiting period after subscription before first claim is allowed
    waiting_period_days = Column(Integer, nullable=False, default=7)

    # Soft-delete: inactive policies won't appear in the policy list
    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
