"""
Phase 2: Feature Engineering - Create enriched features for ML models.

Adds temporal, interaction, and zone-level features to improve model performance.
Targets: +2-5% accuracy improvement on DAI and Disruption models.

Features Created:
1. Temporal Features:
   - Rolling averages of orders and traffic (5-min, 15-min windows)
   - Cyclical encoding of hour and day-of-week (sin/cos)
   - Holiday and peak-hour flags
   - Day type (weekday vs. weekend)
   
2. Interaction Features:
   - rainfall × traffic_speed (weather + congestion compound risk)
   - aqi × active_riders (pollution × work volume)
   - predicted_dai × rainfall (trend × weather)
   - congestion × orders (overload stress)
   
3. Zone-Level Aggregates:
   - Zone disruption frequency (historical average)
   - Zone delivery time volatility
   - Zone risk tier (high/medium/low)
"""

import logging
from pathlib import Path

import numpy as np
import pandas as pd

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(message)s')
logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent / "datasets"


def create_temporal_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Create temporal features from hour and day_of_week.
    
    Features added:
    - hour_sin, hour_cos: Cyclical encoding (0-23 hours)
    - day_sin, day_cos: Cyclical encoding (0-6 weekdays)
    - is_weekend: Boolean flag (1 if Saturday/Sunday)
    - is_peak_hour: Boolean flag (1 if 11-14 or 17-20)
    - is_holiday: Placeholder for production holiday calendar
    - hour_category: Binned hour (early_morning, morning, afternoon, evening, night)
    """
    df_copy = df.copy()
    
    # Cyclical encoding for better model learning of periodic patterns
    df_copy['hour_sin'] = np.sin(2 * np.pi * df_copy['hour_of_day'] / 24)
    df_copy['hour_cos'] = np.cos(2 * np.pi * df_copy['hour_of_day'] / 24)
    df_copy['day_sin'] = np.sin(2 * np.pi * df_copy['day_of_week'] / 7)
    df_copy['day_cos'] = np.cos(2 * np.pi * df_copy['day_of_week'] / 7)
    
    # Binary flags for delivery patterns
    df_copy['is_weekend'] = ((df_copy['day_of_week'] == 5) | (df_copy['day_of_week'] == 6)).astype(int)
    df_copy['is_peak_hour'] = (
        ((df_copy['hour_of_day'] >= 11) & (df_copy['hour_of_day'] <= 14)) |
        ((df_copy['hour_of_day'] >= 17) & (df_copy['hour_of_day'] <= 20))
    ).astype(int)
    
    # Holiday flag (placeholder for production holiday calendar)
    #df_copy['is_holiday'] = 0  # TODO: Integrate with production holiday calendar
    
    # Hour category (6 bins)
    def categorize_hour(hour):
        if 5 <= hour < 9:
            return 1  # early_morning
        elif 9 <= hour < 12:
            return 2  # morning
        elif 12 <= hour < 17:
            return 3  # afternoon
        elif 17 <= hour < 21:
            return 4  # evening
        elif 21 <= hour < 24:
            return 5  # night
        else:
            return 0  # late_night
    
    df_copy['hour_category'] = df_copy['hour_of_day'].apply(categorize_hour)
    
    return df_copy


def create_rolling_features(df: pd.DataFrame, window_size: int = 5) -> pd.DataFrame:
    """
    Create rolling average features for orders and traffic.
    
    Features added:
    - orders_5min_rolling_mean: Rolling average of orders_last_5min
    - traffic_rolling_mean: Rolling average of average_traffic_speed
    - dai_volatility: Variance of current_dai and future_dai
    
    Note: In production, these would use actual time-series windows.
    For synthetic data, we simulate with neighborhood statistics.
    """
    df_copy = df.copy()
    
    # Simulate rolling statistics with small random perturbations
    # In production, use actual time-series windows from database
    df_copy['orders_rolling_std'] = df_copy['orders_last_5min'].rolling(
        window=window_size, min_periods=1
    ).std().fillna(0)
    
    df_copy['traffic_rolling_mean'] = df_copy['average_traffic_speed'].rolling(
        window=window_size, min_periods=1
    ).mean().fillna(df_copy['average_traffic_speed'])
    
    # DAI volatility: how much DAI fluctuates
    df_copy['dai_volatility'] = np.abs(df_copy['current_dai'] - df_copy['future_dai'])
    
    return df_copy


def create_interaction_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Create interaction features combining multiple risk signals.
    
    Features added:
    - rainfall_traffic_interaction: rainfall × (1 - normalized_traffic_speed)
      → Captures compound weather + congestion risk
    - aqi_riders_interaction: (AQI/500) × (active_riders/baseline)
      → Captures pollution impact on rider capacity
    - dai_rainfall_interaction: future_dai × (1 - normalized_rainfall)
      → Forecast disruption worsened by weather
    - congestion_orders_interaction: congestion × (orders/baseline)
      → Stress from overload at congested times
    - avg_conditions: Simple average of normalized adverse conditions
    """
    df_copy = df.copy()
    
    # Normalize for interaction calculations
    rainfall_norm = np.minimum(df_copy['rainfall'] / 150, 1.0)  # Cap at 150mm
    traffic_norm = np.minimum(df_copy['average_traffic_speed'] / 60, 1.0)  # Normalize to [0,1]
    aqi_norm = np.minimum(df_copy['aqi'] / 500, 1.0)  # Normalize to [0,1]
    orders_norm = df_copy['orders_last_5min'] / df_copy['orders_last_5min'].max()
    
    # Weather + traffic compound risk (higher is worse)
    df_copy['rainfall_traffic_risk'] = rainfall_norm * (1 - traffic_norm)
    
    # Pollution + workload stress (higher is worse)
    df_copy['aqi_workload_risk'] = aqi_norm * orders_norm
    
    # Forecast disruption exacerbated by rain
    df_copy['dai_rainfall_risk'] = (1 - df_copy['future_dai']) * rainfall_norm
    
    # Congestion + delivery load stress
    df_copy['congestion_load_stress'] = df_copy['congestion_index'] * orders_norm
    
    # Overall adverse conditions (average of normalized risks)
    df_copy['overall_adverse_conditions'] = (
        rainfall_norm +
        aqi_norm +
        (1 - traffic_norm) +
        df_copy['congestion_index']
    ) / 4
    
    return df_copy


def create_zone_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Create zone-level aggregate features.
    
    Features added (simulated per row in synthetic data):
    - zone_disruption_frequency_bucket: High/Medium/Low (simplified zones)
    - zone_avg_delivery_time: Simulated zone-level average
    - zone_congestion_level: Simulated zone congestion tier
    
    In production, these would be actual aggregates from zone_orders table.
    """
    df_copy = df.copy()
    
    # Simulate zone-level stats (in production: JOIN zone_orders and compute)
    # Use historical_disruption_frequency as proxy for zone risk
    
    # Zone disruption tier based on historical frequency
    def zone_disruption_tier(freq):
        if freq > 0.4:
            return 2  # High-risk zone
        elif freq > 0.2:
            return 1  # Medium-risk zone
        else:
            return 0  # Low-risk zone
    
    df_copy['zone_disruption_tier'] = df_copy['historical_disruption_frequency'].apply(
        zone_disruption_tier
    )
    
    # Zone delivery time baseline (simulated)
    # In production: aggregated from orders table grouped by zone
    df_copy['zone_avg_delivery_time'] = df_copy['average_delivery_time'] * np.random.uniform(0.9, 1.1, len(df_copy))
    
    # Zone congestion level (simulated from congestion_index)
    df_copy['zone_congestion_level'] = pd.cut(
        df_copy['congestion_index'],
        bins=[0, 0.33, 0.67, 1.0],
        labels=[0, 1, 2],  # Low, Medium, High
        include_lowest=True
    ).astype(int)
    
    return df_copy


def create_derived_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Create derived features combining multiple engineered features.
    
    Features added:
    - disruption_risk_score: Combined risk metric (0-1)
    - delivery_efficiency: Orders / delivery_time ratio
    - environmental_stress: Composite environmental burden
    """
    df_copy = df.copy()
    
    # Combined disruption risk from multiple signals
    if 'rainfall_traffic_risk' in df_copy.columns:
        rainfall_traffic_risk = df_copy['rainfall_traffic_risk']
    else:
        rainfall_traffic_risk = 0
    
    if 'aqi_workload_risk' in df_copy.columns:
        aqi_workload_risk = df_copy['aqi_workload_risk']
    else:
        aqi_workload_risk = 0
    
    if 'dai_rainfall_risk' in df_copy.columns:
        dai_rainfall_risk = df_copy['dai_rainfall_risk']
    else:
        dai_rainfall_risk = 0
    
    # Disruption risk score (weighted average)
    df_copy['disruption_risk_score'] = (
        rainfall_traffic_risk * 0.3 +
        aqi_workload_risk * 0.3 +
        dai_rainfall_risk * 0.2 +
        (1 - df_copy['future_dai']) * 0.2  # Forecast trend
    )
    
    # Delivery efficiency (normalized)
    df_copy['delivery_efficiency'] = (
        df_copy['orders_last_5min'] / 
        (df_copy['average_delivery_time'].replace(0, 1) * df_copy['active_riders'].replace(0, 1))
    )
    df_copy['delivery_efficiency'] = np.clip(df_copy['delivery_efficiency'], 0, 1)
    
    # Environmental stress composite
    df_copy['environmental_stress'] = (
        (df_copy['rainfall'] / 150) * 0.3 +
        (df_copy['aqi'] / 500) * 0.4 +
        (1 - df_copy['average_traffic_speed'] / 60) * 0.3
    )
    df_copy['environmental_stress'] = np.clip(df_copy['environmental_stress'], 0, 1)
    
    return df_copy


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Apply all feature engineering steps in sequence.
    
    Returns:
        DataFrame with original + engineered features (now ~35-40 features total)
    """
    logger.info("=" * 70)
    logger.info("FEATURE ENGINEERING: Creating enriched features")
    logger.info("=" * 70)
    
    logger.info(f"\nInput shape: {df.shape}")
    
    df = create_temporal_features(df)
    logger.info(f"✓ Temporal features added: {df.shape[1] - 17} new features")
    
    df = create_rolling_features(df)
    logger.info(f"✓ Rolling features added: {df.shape[1] - 17 - 6} new features")
    
    df = create_interaction_features(df)
    logger.info(f"✓ Interaction features added: {df.shape[1] - 17 - 6 - 3} new features")
    
    df = create_zone_features(df)
    logger.info(f"✓ Zone features added: {df.shape[1] - 17 - 6 - 3 - 5} new features")
    
    df = create_derived_features(df)
    logger.info(f"✓ Derived features added: {df.shape[1] - 17 - 6 - 3 - 5 - 3} new features")
    
    logger.info(f"\nFinal shape: {df.shape} (added {df.shape[1] - 17} features)")
    logger.info(f"Feature list:\n{list(df.columns)}")
    
    return df


def main():
    """Load dataset, apply feature engineering, save enriched dataset."""
    logger.info("Loading base dataset...")
    input_file = DATA_DIR / "training_data.csv"
    
    if not input_file.exists():
        logger.error(f"Dataset not found at {input_file}")
        logger.info("Run dataset_generator.py first to create training_data.csv")
        return
    
    df = pd.read_csv(input_file)
    logger.info(f"✓ Loaded {len(df)} rows from {input_file}")
    
    # Apply feature engineering
    df_engineered = engineer_features(df)
    
    # Save enriched dataset
    output_file = DATA_DIR / "training_data_enriched.csv"
    df_engineered.to_csv(output_file, index=False)
    logger.info(f"\n✓ Enriched dataset saved to {output_file}")
    
    # Print summary statistics
    logger.info("\n" + "=" * 70)
    logger.info("ENRICHED DATASET SUMMARY")
    logger.info("=" * 70)
    logger.info(f"\nShape: {df_engineered.shape}")
    logger.info(f"Disruption rate: {df_engineered['disruption'].mean():.2%}")
    logger.info(f"\nNew feature statistics:\n{df_engineered.iloc[:, 17:].describe()}")


if __name__ == "__main__":
    main()
