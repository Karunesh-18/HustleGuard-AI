from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class Rider(Base):
    __tablename__ = "riders"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False, unique=True, index=True)
    city = Column(String, nullable=False)
    home_zone = Column(String, nullable=False)
    reliability_score = Column(Integer, nullable=False, default=60)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    subscriptions = relationship("Subscription", back_populates="rider", cascade="all, delete-orphan")


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    rider_id = Column(Integer, ForeignKey("riders.id", ondelete="CASCADE"), nullable=False, index=True)
    plan_name = Column(String, nullable=False)
    weekly_premium = Column(Float, nullable=False)
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    rider = relationship("Rider", back_populates="subscriptions")


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


class PayoutEvent(Base):
    __tablename__ = "payout_events"

    id = Column(Integer, primary_key=True, index=True)
    zone_name = Column(String, nullable=False, index=True)
    trigger_reason = Column(String, nullable=False)
    payout_amount_inr = Column(Float, nullable=False)
    eligible_riders = Column(Integer, nullable=False)
    event_time = Column(DateTime, nullable=False, default=datetime.utcnow)
