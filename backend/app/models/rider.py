from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String
from sqlalchemy.sql import func

from app.database import Base


class Rider(Base):
    __tablename__ = "riders"

    id = Column(Integer, primary_key=True, index=True)
    external_worker_id = Column(String, nullable=False, unique=True)
    display_name = Column(String, nullable=False)
    reliability_score = Column(Float, nullable=False, default=50.0)
    reputation_tier = Column(String, nullable=False, default="silver")
    is_probation = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())