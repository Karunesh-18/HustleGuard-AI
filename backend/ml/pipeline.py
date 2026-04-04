from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor

RANDOM_SEED = 42

MODEL_1_FEATURES = [
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

MODEL_2_FEATURES = [
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


@dataclass
class TrainedModels:
    dai_model: RandomForestRegressor
    disruption_model: RandomForestClassifier


def generate_synthetic_dataset(size: int = 30000, random_seed: int = RANDOM_SEED) -> tuple[pd.DataFrame, pd.Series, pd.Series]:
    """Generate synthetic training data until real production data is available."""
    rng = np.random.default_rng(random_seed)

    rainfall = rng.uniform(0, 120, size)
    temperature = rng.uniform(8, 44, size)
    wind_speed = rng.uniform(0, 70, size)
    aqi = rng.uniform(20, 500, size)
    traffic_speed = rng.uniform(5, 55, size)
    congestion_index = rng.uniform(0, 1, size)

    orders_last_5min = rng.uniform(10, 220, size)
    orders_last_15min = orders_last_5min * rng.uniform(2.3, 3.8, size)
    active_riders = rng.uniform(5, 160, size)
    average_delivery_time = rng.uniform(10, 70, size)

    hour_of_day = rng.integers(0, 24, size)
    day_of_week = rng.integers(0, 7, size)

    storm_pressure = rainfall / 120 + np.clip((aqi - 100) / 400, 0, 1) + wind_speed / 100
    ops_pressure = congestion_index + (1 - traffic_speed / 55) + average_delivery_time / 90
    throughput = orders_last_5min / 220 + active_riders / 160

    future_dai = 0.85 + 0.45 * throughput - 0.35 * storm_pressure - 0.30 * ops_pressure
    future_dai += rng.normal(0, 0.05, size)
    future_dai = np.clip(future_dai, 0, 1)

    current_dai = np.clip(
        future_dai + rng.normal(0.06, 0.08, size),
        0,
        1,
    )

    historical_disruption_frequency = np.clip(
        0.1 + 0.6 * storm_pressure / 3 + rng.normal(0, 0.05, size),
        0,
        1,
    )
    zone_risk_score = np.clip(
        0.15 + 0.5 * congestion_index + 0.35 * historical_disruption_frequency + rng.normal(0, 0.04, size),
        0,
        1,
    )

    disruption_score = (
        0.40 * (1 - future_dai)
        + 0.18 * np.clip((aqi - 150) / 350, 0, 1)
        + 0.16 * np.clip(rainfall / 120, 0, 1)
        + 0.14 * congestion_index
        + 0.12 * zone_risk_score
    )
    disruption_label = (disruption_score + rng.normal(0, 0.05, size) > 0.52).astype(int)

    features = pd.DataFrame(
        {
            "rainfall": rainfall,
            "temperature": temperature,
            "wind_speed": wind_speed,
            "aqi": aqi,
            "average_traffic_speed": traffic_speed,
            "traffic_speed": traffic_speed,
            "congestion_index": congestion_index,
            "orders_last_5min": orders_last_5min,
            "orders_last_15min": orders_last_15min,
            "active_riders": active_riders,
            "average_delivery_time": average_delivery_time,
            "hour_of_day": hour_of_day,
            "day_of_week": day_of_week,
            "current_dai": current_dai,
            "historical_disruption_frequency": historical_disruption_frequency,
            "zone_risk_score": zone_risk_score,
        }
    )

    return features, pd.Series(future_dai, name="future_dai"), pd.Series(disruption_label, name="disruption")


def train_pipeline_models(size: int = 30000, random_seed: int = RANDOM_SEED) -> TrainedModels:
    features, y_future_dai, y_disruption = generate_synthetic_dataset(size=size, random_seed=random_seed)

    # ── Model 1: DAI regression ──────────────────────────────────────────────────
    dai_model = RandomForestRegressor(n_estimators=250, random_state=random_seed)
    dai_model.fit(features[MODEL_1_FEATURES], y_future_dai)

    # ── Model 2: disruption classification ──────────────────────────────────────
    # Build training features for Model 2 from raw columns (excluding predicted_dai
    # which doesn't exist in the raw dataset), then add it from Model 1's outputs.
    model_2_base_cols = [c for c in MODEL_2_FEATURES if c != "predicted_dai"]
    model_2_features = features[model_2_base_cols].copy()
    model_2_features["predicted_dai"] = dai_model.predict(features[MODEL_1_FEATURES])
    # Reindex to exact MODEL_2_FEATURES column order so the saved model's
    # feature_names_in_ matches what predict.py will pass at inference time.
    model_2_features = model_2_features.reindex(columns=MODEL_2_FEATURES)

    disruption_model = RandomForestClassifier(n_estimators=250, random_state=random_seed)
    disruption_model.fit(model_2_features, y_disruption)

    return TrainedModels(dai_model=dai_model, disruption_model=disruption_model)

