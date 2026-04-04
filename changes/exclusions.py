"""
Policy Exclusions Schema — HustleGuard AI

Defines the standard insurance exclusions that every viable parametric
insurance product must include. These are mandatory underwriting requirements:

- Correlated catastrophic risks (pandemic, war, nuclear) would cause simultaneous
  mass claims that would instantly make the insurer insolvent.
- Without these exclusions, no reinsurer will back the product and no regulator
  will license it.

This module adds what was previously missing from the HustleGuard platform.
"""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ─── Exclusion Categories ─────────────────────────────────────────────────────

class ExclusionCategory(str, Enum):
    """Standard insurance exclusion categories required by underwriting standards."""

    WAR = "war"
    PANDEMIC = "pandemic"
    TERRORISM = "terrorism"
    NUCLEAR = "nuclear"
    GOVERNMENT_ORDER = "government_order"
    FORCE_MAJEURE = "force_majeure"
    PRE_EXISTING = "pre_existing"
    INTENTIONAL = "intentional"
    NONE = "none"  # No exclusion applies — claim is eligible


class ExclusionSeverity(str, Enum):
    ABSOLUTE = "absolute"    # Claim is always denied regardless of evidence
    CONDITIONAL = "conditional"  # Claim may be reviewed if evidence clears the exclusion


# ─── Exclusion Definitions ────────────────────────────────────────────────────

class PolicyExclusion(BaseModel):
    """A single exclusion clause in the insurance policy."""

    category: ExclusionCategory
    severity: ExclusionSeverity
    title: str
    description: str
    trigger_keywords: list[str] = Field(
        default_factory=list,
        description="Keywords in disruption reason that activate this exclusion check"
    )
    reinsurer_required: bool = Field(
        default=True,
        description="Whether reinsurance backing is needed if this exclusion is lifted"
    )


class ExclusionCheckRequest(BaseModel):
    """Input for checking whether an exclusion applies to a claim."""

    zone_id: int = Field(gt=0)
    event_type: str
    trigger_reason: str
    rainfall_mm: float = Field(ge=0)
    aqi: float = Field(ge=0)
    government_alert_active: bool = False
    alert_description: Optional[str] = None


class ExclusionCheckResult(BaseModel):
    """Result of an exclusion check — whether the claim is blocked and why."""

    is_excluded: bool
    exclusion_category: ExclusionCategory
    exclusion_title: Optional[str] = None
    exclusion_description: Optional[str] = None
    severity: Optional[ExclusionSeverity] = None
    can_appeal: bool = Field(
        default=False,
        description="Whether the rider can submit an appeal with evidence"
    )
    appeal_instructions: Optional[str] = None
    regulatory_basis: Optional[str] = None


class PolicyTermsResponse(BaseModel):
    """Full policy terms returned to the frontend — what is and isn't covered."""

    product_name: str
    version: str
    effective_date: str
    covered_events: list[str]
    exclusions: list[PolicyExclusion]
    coverage_limits: dict[str, float]
    appeal_process: str
    regulator_note: str
