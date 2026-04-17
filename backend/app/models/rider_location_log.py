"""RiderLocationLog — persists GPS pings from the mobile app.

GPS is mandatory to use HustleGuard. Location is logged at:
  - App open / foreground
  - Manual distress claim submission
  - Parametric trigger acknowledgement

Used by mobility_service.py to compute:
  - teleport risk (impossibly fast movement = fraud signal)
  - historical zone familiarity (low visits = higher fraud risk)
  - zone consistency (claim zone matches last known GPS zone)
"""

from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String

from app.database import Base


class RiderLocationLog(Base):
    __tablename__ = "rider_location_logs"

    id = Column(Integer, primary_key=True, index=True)

    # FK back to the rider
    rider_id = Column(Integer, ForeignKey("riders.id", ondelete="CASCADE"), nullable=False, index=True)

    # GPS coordinates from the mobile browser / native API
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)

    # Accuracy reported by the device (metres); NULL when not provided
    accuracy_metres = Column(Float, nullable=True)

    # Zone resolved from coordinates (matched against zone_snapshots)
    zone_name = Column(String, nullable=True, index=True)

    # "gps" = native Geolocation API, "ip" = IP geolocation fallback
    source = Column(String, nullable=False, default="gps")

    # Optional: what triggered this log ("app_open" | "claim" | "trigger_ack")
    context = Column(String, nullable=True)

    logged_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
