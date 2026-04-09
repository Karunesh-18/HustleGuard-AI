"""Canonical feature name contracts for the HustleGuard ML pipeline.

Why this file exists:
  Model 2 dropped to 2 features in Phase 2 because "traffic_speed" and
  "average_traffic_speed" were treated as different columns in different modules.
  All feature-consuming code must import names from here — never use string
  literals for feature names outside this module.

Usage:
    from ml.feature_contracts import FEAT_RAINFALL, MODEL1_FEATURES

IMPORTANT — Feature set alignment:
  MODEL1_FEATURES and MODEL2_FEATURES below reflect what pipeline.py
  actually trains on (the saved .pkl files).  If you change these lists
  you MUST retrain the models — the pkl files will be mismatched otherwise.
"""

from __future__ import annotations

# ── Raw input features (canonical names) ──────────────────────────────────────

FEAT_RAINFALL = "rainfall"
FEAT_AQI = "aqi"
FEAT_TRAFFIC_SPEED = "average_traffic_speed"   # Canonical — do NOT use "traffic_speed"
FEAT_CURRENT_DAI = "current_dai"
FEAT_HOUR_OF_DAY = "hour_of_day"
FEAT_DAY_OF_WEEK = "day_of_week"
FEAT_ORDERS_LAST_5MIN = "orders_last_5min"
FEAT_ORDERS_LAST_15MIN = "orders_last_15min"
FEAT_ACTIVE_RIDERS = "active_riders"
FEAT_AVG_DELIVERY_TIME = "average_delivery_time"
FEAT_CONGESTION_INDEX = "congestion_index"
FEAT_ZONE_RISK_SCORE = "zone_risk_score"
FEAT_HISTORICAL_DISRUPTION_FREQ = "historical_disruption_frequency"

# ── Columns with two common alias names ───────────────────────────────────────
# pipeline.py stores both "average_traffic_speed" and "traffic_speed" columns
# in the synthetic dataset for backward compatibility.  MODEL_2_FEATURES uses
# "traffic_speed" because that's the column name Model 2 was trained with.
FEAT_TRAFFIC_SPEED_ALIAS = "traffic_speed"

# ── Target variables ───────────────────────────────────────────────────────────

TARGET_FUTURE_DAI = "future_dai"
TARGET_DISRUPTION = "disruption"

# ── Phase 2 engineered features ────────────────────────────────────────────────

FEAT_HOUR_SIN = "hour_sin"
FEAT_HOUR_COS = "hour_cos"
FEAT_DAY_SIN = "day_sin"
FEAT_DAY_COS = "day_cos"
FEAT_IS_WEEKEND = "is_weekend"
FEAT_IS_PEAK_HOUR = "is_peak_hour"
FEAT_HOUR_CATEGORY = "hour_category"

FEAT_RAINFALL_TRAFFIC_RISK = "rainfall_traffic_risk"
FEAT_AQI_WORKLOAD_RISK = "aqi_workload_risk"
FEAT_DAI_RAINFALL_RISK = "dai_rainfall_risk"
FEAT_CONGESTION_LOAD_STRESS = "congestion_load_stress"
FEAT_OVERALL_ADVERSE = "overall_adverse_conditions"
FEAT_ZONE_DISRUPTION_TIER = "zone_disruption_tier"
FEAT_ZONE_AVG_DELIVERY_TIME = "zone_avg_delivery_time"
FEAT_ZONE_CONGESTION_LEVEL = "zone_congestion_level"
FEAT_DISRUPTION_RISK_SCORE = "disruption_risk_score"
FEAT_DELIVERY_EFFICIENCY = "delivery_efficiency"
FEAT_ENVIRONMENTAL_STRESS = "environmental_stress"

# ── Model feature sets ─────────────────────────────────────────────────────────
# These MUST match the feature lists in pipeline.py MODEL_1_FEATURES and
# MODEL_2_FEATURES.  They represent what the saved .pkl models were trained on.
#
# Model 1 — DAI Regression (12 features, from pipeline.py MODEL_1_FEATURES)
MODEL1_FEATURES: list[str] = [
    "rainfall",
    "temperature",
    "wind_speed",
    "aqi",
    "average_traffic_speed",
    "congestion_index",
    "orders_last_5min",
    "orders_last_15min",
    "active_riders",
    "average_delivery_time",
    "hour_of_day",
    "day_of_week",
]

# Model 2 — Disruption Classification (9 features, from pipeline.py MODEL_2_FEATURES)
# Note: "traffic_speed" (not "average_traffic_speed") is the column name used
# at training time; both columns exist in the synthetic dataset.
MODEL2_FEATURES: list[str] = [
    "rainfall",
    "aqi",
    "wind_speed",
    "traffic_speed",
    "congestion_index",
    "current_dai",
    "predicted_dai",
    "historical_disruption_frequency",
    "zone_risk_score",
]

# ── Alias resolution ───────────────────────────────────────────────────────────
# Maps legacy or alternative spelling → canonical name.
# Used by ml_service.py to normalize incoming API fields before prediction.

FEATURE_ALIASES: dict[str, str] = {
    "traffic_speed": FEAT_TRAFFIC_SPEED,
    "trafficSpeed": FEAT_TRAFFIC_SPEED,
    "AQI": FEAT_AQI,
    "Aqi": FEAT_AQI,
    "rain": FEAT_RAINFALL,
    "rainfall_mm": FEAT_RAINFALL,
    "current_dai_value": FEAT_CURRENT_DAI,
}


def resolve_feature_name(name: str) -> str:
    """Resolve a legacy or alternative feature name to the canonical name."""
    return FEATURE_ALIASES.get(name, name)


def validate_feature_alignment(df_columns: list[str], required: list[str]) -> list[str]:
    """Return list of missing features. Empty list = all present.

    Call this at training time to catch column name drift early.

    Example:
        missing = validate_feature_alignment(df.columns.tolist(), MODEL1_FEATURES)
        if missing:
            raise ValueError(f"Missing features: {missing}")
    """
    return [f for f in required if f not in df_columns]
