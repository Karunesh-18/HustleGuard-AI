"""RiderPolicy enrollment model.

Links a Rider to a Policy tier.  Only one record should be active at a time
per rider; the service layer enforces this by deactivating any previous
enrollment when a new one is created.
"""

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class RiderPolicy(Base):
    __tablename__ = "rider_policies"

    id = Column(Integer, primary_key=True, index=True)

    rider_id = Column(Integer, ForeignKey("riders.id", ondelete="CASCADE"), nullable=False, index=True)
    policy_id = Column(Integer, ForeignKey("policies.id"), nullable=False, index=True)

    # Denormalised for display without join
    policy_name = Column(String, nullable=False)

    active = Column(Boolean, nullable=False, default=True)

    # When the rider became eligible to claim (start + waiting_period_days)
    eligible_from = Column(DateTime, nullable=True)
    enrolled_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # ORM relationships
    rider = relationship("Rider", foreign_keys=[rider_id])
    policy = relationship("Policy", foreign_keys=[policy_id])
