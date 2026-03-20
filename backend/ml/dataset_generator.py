#!/usr/bin/env python
"""
Generate synthetic training dataset for ML models.

This script creates a CSV file with synthetic delivery ecosystem data
used for training the disruption prediction pipeline.
"""

import random
from pathlib import Path

import numpy as np
import pandas as pd

NUM_ROWS = 50000
DATA_DIR = Path(__file__).resolve().parent / "datasets"
OUTPUT_FILE = DATA_DIR / "training_data.csv"


def generate_dataset() -> pd.DataFrame:
    """Generate synthetic training data with all required features."""
    data = []

    for _ in range(NUM_ROWS):
        # Environmental conditions
        rainfall = np.random.gamma(2, 20)
        rainfall = min(rainfall, 150)

        aqi = np.random.normal(120, 80)
        aqi = max(30, min(aqi, 500))

        temperature = np.random.normal(30, 6)

        wind_speed = np.random.uniform(0, 40)

        # Traffic conditions
        traffic_speed = np.random.normal(30, 10)
        traffic_speed = max(5, min(traffic_speed, 60))

        congestion_index = max(0, min(1, np.random.normal(0.4, 0.2)))

        # Delivery platform activity
        base_orders = random.randint(80, 160)

        # Environmental effects on orders
        rain_effect = max(0.2, 1 - rainfall / 200)
        pollution_effect = max(0.4, 1 - aqi / 800)
        traffic_effect = max(0.5, traffic_speed / 40)

        orders_5min = base_orders * rain_effect * pollution_effect * traffic_effect
        orders_5min = int(max(10, orders_5min))
        orders_15min = orders_5min * np.random.uniform(2.3, 3.8)

        active_riders = int(orders_5min * np.random.uniform(0.3, 0.6))
        average_delivery_time = np.random.normal(25, 6)

        # Calculate DAI (normalized by baseline)
        baseline_orders = base_orders
        current_dai = min(1.0, orders_5min / baseline_orders)
        current_dai = max(0.0, current_dai)

        # Predictable future trend
        dai_future = current_dai * np.random.uniform(0.8, 1.05)
        dai_future = max(0.0, min(1.0, dai_future))

        # Temporal features
        hour_of_day = np.random.randint(0, 24)
        day_of_week = np.random.randint(0, 7)

        # Zone risk features
        historical_disruption_frequency = max(0, min(1, np.random.normal(0.2, 0.15)))
        zone_risk_score = max(0, min(1, np.random.normal(0.3, 0.2)))

        # Disruption rules
        disruption = 0
        if rainfall > 80 and dai_future < 0.45:
            disruption = 1
        if aqi > 420 and dai_future < 0.5:
            disruption = 1
        if traffic_speed < 10 and dai_future < 0.5:
            disruption = 1
        if current_dai < 0.3:
            disruption = 1

        row = [
            rainfall,
            aqi,
            temperature,
            wind_speed,
            traffic_speed,
            congestion_index,
            orders_5min,
            orders_15min,
            active_riders,
            average_delivery_time,
            hour_of_day,
            day_of_week,
            current_dai,
            dai_future,
            historical_disruption_frequency,
            zone_risk_score,
            disruption,
        ]

        data.append(row)

    columns = [
        "rainfall",
        "aqi",
        "temperature",
        "wind_speed",
        "average_traffic_speed",
        "congestion_index",
        "orders_last_5min",
        "orders_last_15min",
        "active_riders",
        "average_delivery_time",
        "hour_of_day",
        "day_of_week",
        "current_dai",
        "future_dai",
        "historical_disruption_frequency",
        "zone_risk_score",
        "disruption",
    ]

    return pd.DataFrame(data, columns=columns)


if __name__ == "__main__":
    print(f"Generating {NUM_ROWS:,} synthetic training samples...")
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    df = generate_dataset()
    df.to_csv(OUTPUT_FILE, index=False)

    print(f"✓ Dataset saved to {OUTPUT_FILE}")
    print(f"  Shape: {df.shape}")
    print(f"  Columns: {', '.join(df.columns)}")
    print(f"\nDataset summary:\n{df.describe()}")

print("Dataset generated successfully")
print("Rows:", len(df))