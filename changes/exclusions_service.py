"""
Policy Exclusions Service — HustleGuard AI

Implements the exclusion checking logic that must run BEFORE any payout is
triggered. This is what was missing from the original implementation.

Every insurance product worldwide must exclude:
  1. War / armed conflict
  2. Pandemics / epidemics (correlated mass-claim risk)
  3. Terrorism
  4. Nuclear / radioactive / chemical / biological weapons
  5. Government shutdown orders (separate from weather disruption)
  6. Force majeure events beyond the policy scope

Without these checks, a single pandemic event would bankrupt the insurer
as every rider claims simultaneously — exactly what happened to many
insurers without pandemic exclusions in 2020.
"""

import logging
import re
from typing import Optional

from app.schemas.exclusions import (
    ExclusionCategory,
    ExclusionCheckRequest,
    ExclusionCheckResult,
    ExclusionSeverity,
    PolicyExclusion,
    PolicyTermsResponse,
)

logger = logging.getLogger(__name__)


# ─── Master Exclusion Registry ────────────────────────────────────────────────
# These are the standard exclusion clauses. Any reinsurer or regulator
# reviewing this product would expect to see all of these.

STANDARD_EXCLUSIONS: list[PolicyExclusion] = [
    PolicyExclusion(
        category=ExclusionCategory.WAR,
        severity=ExclusionSeverity.ABSOLUTE,
        title="War and Armed Conflict",
        description=(
            "This policy does not cover income loss arising from or connected to "
            "any act of war, declared or undeclared, invasion, acts of foreign enemies, "
            "hostilities, civil war, rebellion, revolution, insurrection, or military "
            "or usurped power."
        ),
        trigger_keywords=["war", "armed conflict", "military", "invasion", "curfew war",
                          "civil war", "insurgency", "rebel", "coup"],
        reinsurer_required=True,
    ),
    PolicyExclusion(
        category=ExclusionCategory.PANDEMIC,
        severity=ExclusionSeverity.ABSOLUTE,
        title="Pandemic and Epidemic Events",
        description=(
            "This policy does not cover income loss arising from any pandemic, epidemic, "
            "outbreak of communicable disease, or any government measures taken in response "
            "thereto, including lockdowns, quarantine orders, or restrictions on movement "
            "declared in connection with a public health emergency. This exclusion applies "
            "even when such events incidentally reduce delivery activity in a zone."
        ),
        trigger_keywords=["pandemic", "epidemic", "covid", "lockdown", "quarantine",
                          "public health emergency", "disease outbreak", "containment zone",
                          "health emergency"],
        reinsurer_required=True,
    ),
    PolicyExclusion(
        category=ExclusionCategory.TERRORISM,
        severity=ExclusionSeverity.ABSOLUTE,
        title="Terrorism and Sabotage",
        description=(
            "This policy does not cover income loss arising directly or indirectly from "
            "any act of terrorism, sabotage, or threat thereof. An act of terrorism means "
            "any act intended to influence a government or intimidate the public, committed "
            "for political, religious, ideological, or similar purposes."
        ),
        trigger_keywords=["terrorism", "terrorist", "bomb", "blast", "sabotage",
                          "attack", "explosion", "threat"],
        reinsurer_required=True,
    ),
    PolicyExclusion(
        category=ExclusionCategory.NUCLEAR,
        severity=ExclusionSeverity.ABSOLUTE,
        title="Nuclear, Chemical, Biological, and Radiological Events",
        description=(
            "This policy does not cover income loss arising from nuclear reaction, nuclear "
            "radiation, radioactive contamination, or any chemical, biological, or radiological "
            "weapon, whether accidental or deliberate. This exclusion applies regardless of "
            "whether any other cause contributed to the loss."
        ),
        trigger_keywords=["nuclear", "radiation", "radioactive", "chemical weapon",
                          "biological weapon", "CBRN", "radiological", "contamination"],
        reinsurer_required=True,
    ),
    PolicyExclusion(
        category=ExclusionCategory.GOVERNMENT_ORDER,
        severity=ExclusionSeverity.CONDITIONAL,
        title="Government Shutdown and Regulatory Orders",
        description=(
            "This policy does not cover income loss arising solely from government-mandated "
            "shutdowns, platform bans, or regulatory orders that are unrelated to qualifying "
            "environmental disruptions. Income loss caused by government orders issued "
            "in response to weather events covered under this policy may be reviewed "
            "on a case-by-case basis."
        ),
        trigger_keywords=["shutdown", "ban", "government order", "regulatory",
                          "platform suspension", "license revocation", "court order"],
        reinsurer_required=False,
    ),
    PolicyExclusion(
        category=ExclusionCategory.FORCE_MAJEURE,
        severity=ExclusionSeverity.CONDITIONAL,
        title="Force Majeure and Acts of God Beyond Policy Scope",
        description=(
            "This policy covers specific environmental disruptions (rainfall, AQI, traffic). "
            "Income loss from events outside these defined triggers — including earthquakes, "
            "tsunamis, volcanic eruptions, or meteor strikes — is not covered unless explicitly "
            "added as a rider to the base policy."
        ),
        trigger_keywords=["earthquake", "tsunami", "volcano", "meteor", "landslide",
                          "sinhole", "act of god"],
        reinsurer_required=False,
    ),
    PolicyExclusion(
        category=ExclusionCategory.INTENTIONAL,
        severity=ExclusionSeverity.ABSOLUTE,
        title="Intentional Acts and Fraud",
        description=(
            "This policy does not cover any loss arising from the intentional, dishonest, "
            "fraudulent, or criminal act of the insured or any person acting with their "
            "knowledge or connivance. Claims identified as fraudulent will be denied and "
            "may be reported to relevant authorities."
        ),
        trigger_keywords=["fraud", "fake", "fabricated", "collusion", "ring"],
        reinsurer_required=False,
    ),
]


# ─── Covered Events (the positive side of the policy) ────────────────────────

COVERED_EVENTS: list[str] = [
    "Rainfall exceeding 80mm in a 24-hour period within the rider's active zone",
    "Air Quality Index (AQI) exceeding 300 in the rider's active zone",
    "Zone Delivery Activity Index (DAI) falling below 0.40 due to weather or traffic",
    "Average traffic speed below 10 km/h due to congestion caused by weather",
    "Government-declared weather emergencies (rainfall, cyclone, flood) — NOT pandemic/war",
]

COVERAGE_LIMITS: dict[str, float] = {
    "max_payout_per_event_inr": 600.0,
    "max_events_per_month": 8.0,
    "max_annual_payout_inr": 15000.0,
    "waiting_period_hours": 0.0,  # Parametric — instant, no waiting period
    "min_weekly_premium_inr": 20.0,
    "max_weekly_premium_inr": 45.0,
}


# ─── Core Exclusion Check Function ────────────────────────────────────────────

def check_exclusions(request: ExclusionCheckRequest) -> ExclusionCheckResult:
    """
    Check whether a claim trigger is subject to any policy exclusion.

    This MUST be called before any payout is triggered. If an exclusion applies,
    the payout is blocked (absolute) or flagged for review (conditional).

    Args:
        request: The disruption event details to check against exclusions

    Returns:
        ExclusionCheckResult indicating whether payout should proceed
    """
    combined_text = (
        f"{request.event_type} {request.trigger_reason} "
        f"{request.alert_description or ''}"
    ).lower()

    for exclusion in STANDARD_EXCLUSIONS:
        for keyword in exclusion.trigger_keywords:
            if keyword.lower() in combined_text:
                logger.warning(
                    f"Exclusion triggered | zone={request.zone_id} "
                    f"category={exclusion.category} keyword='{keyword}' "
                    f"severity={exclusion.severity}"
                )

                can_appeal = exclusion.severity == ExclusionSeverity.CONDITIONAL
                appeal_instructions = (
                    "Submit supporting evidence to support@hustleguard.ai within 14 days. "
                    "Include zone weather data, platform activity logs, and a written "
                    "explanation of how the event relates to a qualifying trigger."
                    if can_appeal else None
                )

                return ExclusionCheckResult(
                    is_excluded=True,
                    exclusion_category=exclusion.category,
                    exclusion_title=exclusion.title,
                    exclusion_description=exclusion.description,
                    severity=exclusion.severity,
                    can_appeal=can_appeal,
                    appeal_instructions=appeal_instructions,
                    regulatory_basis=(
                        "IRDAI Parametric Insurance Guidelines 2023 — "
                        "Section 4(b): Mandatory Exclusion Clauses"
                    ),
                )

    # Government alert check — if an alert is active, verify it's weather-related
    if request.government_alert_active and request.alert_description:
        alert_lower = request.alert_description.lower()
        non_weather_keywords = ["pandemic", "lockdown", "covid", "war", "terrorism",
                                "nuclear", "shutdown", "ban", "quarantine"]
        for kw in non_weather_keywords:
            if kw in alert_lower:
                return ExclusionCheckResult(
                    is_excluded=True,
                    exclusion_category=ExclusionCategory.GOVERNMENT_ORDER,
                    exclusion_title="Government Non-Weather Order",
                    exclusion_description=(
                        f"The active government alert appears to be non-weather related: "
                        f"'{request.alert_description}'. This policy only covers government "
                        f"alerts issued in response to qualifying weather events."
                    ),
                    severity=ExclusionSeverity.CONDITIONAL,
                    can_appeal=True,
                    appeal_instructions=(
                        "If this alert was issued alongside a qualifying weather event, "
                        "please submit weather data and alert documentation to "
                        "support@hustleguard.ai within 14 days."
                    ),
                    regulatory_basis="IRDAI Guidelines — Government Order Exclusion Clause",
                )

    # No exclusion applies — claim is eligible for payout evaluation
    logger.info(
        f"Exclusion check passed | zone={request.zone_id} "
        f"event_type={request.event_type} — no exclusions triggered"
    )
    return ExclusionCheckResult(
        is_excluded=False,
        exclusion_category=ExclusionCategory.NONE,
        can_appeal=False,
    )


def get_policy_terms() -> PolicyTermsResponse:
    """Return the full policy terms for display in the frontend."""
    return PolicyTermsResponse(
        product_name="HustleGuard Weekly Shield",
        version="2.1.0",
        effective_date="2026-01-01",
        covered_events=COVERED_EVENTS,
        exclusions=STANDARD_EXCLUSIONS,
        coverage_limits=COVERAGE_LIMITS,
        appeal_process=(
            "Riders may appeal conditional exclusion decisions within 14 days of denial. "
            "Appeals must include supporting documentation and are reviewed within 5 business days. "
            "Contact: support@hustleguard.ai | Grievance Officer: grievance@hustleguard.ai"
        ),
        regulator_note=(
            "This product is subject to Insurance Regulatory and Development Authority of India "
            "(IRDAI) guidelines on parametric insurance products. Policy terms are subject to "
            "change with 30 days' notice to policyholders."
        ),
    )
