from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from app.database import Base

# Valid claim types
CLAIM_TYPE_PARAMETRIC_AUTO = "parametric_auto"
CLAIM_TYPE_MANUAL_DISTRESS = "manual_distress"
CLAIM_TYPE_PARTIAL_DISRUPTION = "partial_disruption"
CLAIM_TYPE_COMMUNITY = "community"
CLAIM_TYPE_APPEAL = "appeal"


class Claim(Base):
    __tablename__ = "claims"

    id = Column(Integer, primary_key=True, index=True)
    rider_id = Column(Integer, ForeignKey("riders.id"), nullable=False, index=True)
    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=False, index=True)

    # ── Core decision fields ─────────────────────────────────────────────────
    status = Column(String, nullable=False, default="under_review")
    trust_score = Column(Float, nullable=False)
    decision = Column(String, nullable=False)
    reasons = Column(Text, nullable=False, default="")

    # ── Claim type — drives which logic path was used ────────────────────────
    # One of: parametric_auto | manual_distress | partial_disruption | community | appeal
    claim_type = Column(String, nullable=False, default=CLAIM_TYPE_PARAMETRIC_AUTO, index=True)

    # ── Manual Distress (panic button) ───────────────────────────────────────
    # Reason rider selected: Rain | Traffic | Curfew | Other
    distress_reason = Column(String, nullable=True)

    # ── Partial Disruption ───────────────────────────────────────────────────
    # Base payout before prorating. Prorated = base * (1 - current_dai / normal_dai)
    base_payout_inr = Column(Float, nullable=True)
    partial_payout_ratio = Column(Float, nullable=True)   # 0.0–1.0; null if full payout
    current_dai_at_claim = Column(Float, nullable=True)

    # ── Community Claim ──────────────────────────────────────────────────────
    # Number of riders in the zone who triggered this community claim
    community_trigger_count = Column(Integer, nullable=True)

    # ── Appeal ───────────────────────────────────────────────────────────────
    # FK to the original claim being challenged
    appeal_of_claim_id = Column(Integer, ForeignKey("claims.id"), nullable=True)
    appeal_clarification = Column(Text, nullable=True)
    # pending | approved | rejected | null (not an appeal)
    appeal_status = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
