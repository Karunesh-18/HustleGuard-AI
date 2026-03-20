"""Unified Rider model — single source of truth for the 'riders' table.

Merges the original ORM fields (external_worker_id, display_name,
reputation_tier, is_probation) with the onboarding schema fields needed by
the frontend (name, email, city, home_zone). All identity columns use nullable
where needed to support both creation paths.
"""
from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String
from sqlalchemy.sql import func

from app.database import Base


class Rider(Base):
    __tablename__ = "riders"

    id = Column(Integer, primary_key=True, index=True)

    # Original ORM fields (used by /api/v1/riders endpoint)
    external_worker_id = Column(String, nullable=True, unique=True)
    display_name = Column(String, nullable=True)
    reputation_tier = Column(String, nullable=False, default="silver")
    is_probation = Column(Boolean, nullable=False, default=False)

    # Reliability score (shared between both flows)
    reliability_score = Column(Float, nullable=False, default=50.0)

    # Frontend onboarding fields (used by /riders/onboard endpoint)
    name = Column(String, nullable=True)
    email = Column(String, nullable=True)
    city = Column(String, nullable=True)
    home_zone = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())