from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.sql import func

from app.database import Base


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=False, index=True)
    rider_id = Column(Integer, ForeignKey("riders.id"), nullable=False, index=True)
    status = Column(String, nullable=False, default="completed")
    distance_km = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    delivered_at = Column(DateTime(timezone=True), nullable=True)