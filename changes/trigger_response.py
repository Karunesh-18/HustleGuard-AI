"""
Domain schemas update — TriggerEvaluateResponse extended with exclusion fields.

The original TriggerEvaluateResponse only returned triggered/payout info.
This version adds exclusion details so the frontend can display a clear,
transparent explanation when a payout is blocked by a policy exclusion.

Riders deserve to know WHY their claim was blocked — this is both
regulatory best practice and basic UX fairness.
"""

from typing import Optional
from pydantic import BaseModel, Field


class TriggerEvaluateResponse(BaseModel):
    """
    Response from parametric trigger evaluation.

    When triggered=True:  payout_event_id is set, no exclusion fields
    When triggered=False: either ML threshold not met, or exclusion blocked it.
                          If exclusion blocked: exclusion_* fields explain why.
    """
    triggered: bool

    # ML prediction outputs (always present)
    disruption_probability: float
    predicted_dai: float
    risk_label: str

    # Trigger details (present when ML threshold was met)
    trigger_reason: Optional[str] = None

    # Payout record (only when triggered=True and no exclusion)
    payout_event_id: Optional[int] = None

    # ── Exclusion fields (NEW — present when exclusion blocked the payout) ──
    exclusion_category: Optional[str] = Field(
        default=None,
        description="Which exclusion category blocked the payout (e.g. 'pandemic', 'war')"
    )
    exclusion_title: Optional[str] = Field(
        default=None,
        description="Human-readable exclusion title from the policy"
    )
    exclusion_description: Optional[str] = Field(
        default=None,
        description="Full exclusion clause text for transparency"
    )
    can_appeal: bool = Field(
        default=False,
        description="Whether rider can submit an appeal for this exclusion decision"
    )
    appeal_instructions: Optional[str] = Field(
        default=None,
        description="Steps to appeal a conditional exclusion decision"
    )
