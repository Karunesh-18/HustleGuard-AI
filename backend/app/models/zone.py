from sqlalchemy import Column, DateTime, Float, Integer, String
from sqlalchemy.sql import func

from app.database import Base


class Zone(Base):
    __tablename__ = "zones"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    city = Column(String, nullable=False)
    baseline_orders_per_hour = Column(Float, nullable=False, default=100.0)
    baseline_active_riders = Column(Float, nullable=False, default=40.0)
    baseline_delivery_time_minutes = Column(Float, nullable=False, default=25.0)
    risk_level = Column(String, nullable=False, default="medium")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())