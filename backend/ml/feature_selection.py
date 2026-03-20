"""
Feature selection and importance analysis for ML models.

Analyzes feature importance using multiple methods:
- Model-based feature importance (tree importance)
- Permutation importance (model-agnostic)
- Correlation analysis (redundancy detection)
"""

import logging
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.inspection import permutation_importance
from sklearn.model_selection import train_test_split

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(message)s')
logger = logging.getLogger(__name__)

# Define paths
DATA_DIR = Path(__file__).parent / "datasets"
MODEL_DIR = Path(__file__).parent / "models"
DATASET_FILE = DATA_DIR / "training_data.csv"


def analyze_model_importance(model, feature_names, model_name):
    """
    Extract and log feature importance scores from trained model.
    
    Args:
        model: Trained RandomForest model
        feature_names: List of feature names
        model_name: Name of model (for logging)
    
    Returns:
        pd.DataFrame: Feature importance sorted by importance score
    """
    importances = model.feature_importances_
    importance_df = pd.DataFrame({
        'feature': feature_names,
        'importance': importances
    }).sort_values('importance', ascending=False)
    
    logger.info(f"\n{'='*60}")
    logger.info(f"{model_name} – MODEL-BASED FEATURE IMPORTANCE")
    logger.info(f"{'='*60}")
    
    for idx, row in importance_df.iterrows():
        logger.info(f"  {row['feature']:30s}: {row['importance']:.4f}")
    
    # Show cumulative importance
    importance_df['cumulative'] = importance_df['importance'].cumsum()
    n_features_90 = (importance_df['cumulative'] <= 0.9).sum() + 1
    logger.info(f"\n✓ Top {n_features_90} features account for 90% of importance")
    
    return importance_df


def analyze_permutation_importance(model, X_test, y_test, feature_names, model_name, n_repeats=10):
    """
    Calculate permutation importance (model-agnostic, reliable metric).
    
    Args:
        model: Trained model
        X_test: Test feature matrix
        y_test: Test target
        feature_names: List of feature names
        model_name: Name of model (for logging)
        n_repeats: Number of permutation repeats
    
    Returns:
        pd.DataFrame: Permutation importance with standard deviation
    """
    logger.info(f"\nCalculating permutation importance for {model_name}...")
    
    perm_importance = permutation_importance(
        model, X_test, y_test, 
        n_repeats=n_repeats,
        random_state=42,
        n_jobs=-1
    )
    
    perm_df = pd.DataFrame({
        'feature': feature_names,
        'importance_mean': perm_importance.importances_mean,
        'importance_std': perm_importance.importances_std
    }).sort_values('importance_mean', ascending=False)
    
    logger.info(f"\n{'='*60}")
    logger.info(f"{model_name} – PERMUTATION IMPORTANCE")
    logger.info(f"{'='*60}")
    
    for idx, row in perm_df.iterrows():
        logger.info(
            f"  {row['feature']:30s}: {row['importance_mean']:.4f} "
            f"(±{row['importance_std']:.4f})"
        )
    
    return perm_df


def analyze_correlation(X, feature_names, redundancy_threshold=0.9):
    """
    Identify redundant features via correlation analysis.
    
    Args:
        X: Feature matrix
        feature_names: List of feature names
        redundancy_threshold: Correlation threshold for redundancy
    
    Returns:
        list: Features identified as redundant
    """
    logger.info(f"\nAnalyzing feature correlations...")
    
    corr_matrix = X.corr().abs()
    
    # Find highly correlated feature pairs
    redundant_features = []
    for i in range(len(corr_matrix.columns)):
        for j in range(i+1, len(corr_matrix.columns)):
            if corr_matrix.iloc[i, j] > redundancy_threshold:
                feature_i = feature_names[i]
                feature_j = feature_names[j]
                corr_val = corr_matrix.iloc[i, j]
                
                logger.info(f"  {feature_i} ↔ {feature_j}: {corr_val:.4f} (REDUNDANT)")
                redundant_features.append((feature_i, feature_j, corr_val))
    
    if not redundant_features:
        logger.info("  ✓ No highly correlated features detected")
    
    return redundant_features


def recommend_feature_set(model_importance, perm_importance, min_importance=0.01):
    """
    Recommend final feature set based on importance thresholds.
    
    Args:
        model_importance: DataFrame from analyze_model_importance
        perm_importance: DataFrame from analyze_permutation_importance
        min_importance: Minimum importance threshold
    
    Returns:
        list: Recommended features to keep
    """
    logger.info(f"\n{'='*60}")
    logger.info("FEATURE SELECTION RECOMMENDATION")
    logger.info(f"{'='*60}")
    logger.info(f"Threshold: {min_importance} importance\n")
    
    # Keep features above threshold in both metrics
    model_keep = set(model_importance[model_importance['importance'] > min_importance]['feature'])
    perm_keep = set(perm_importance[perm_importance['importance_mean'] > min_importance]['feature'])
    
    recommended = list(model_keep & perm_keep)
    
    logger.info(f"Features to keep ({len(recommended)}):")
    for feat in sorted(recommended):
        logger.info(f"  ✓ {feat}")
    
    dropped = set(model_importance['feature']) - set(recommended)
    if dropped:
        logger.info(f"\nFeatures to drop ({len(dropped)}):")
        for feat in sorted(dropped):
            logger.info(f"  ✗ {feat}")
    
    return sorted(recommended)


def main():
    """Main entry point for feature selection analysis."""
    # Load dataset and models
    logger.info("Loading dataset and trained models...")
    df = pd.read_csv(DATASET_FILE)
    dai_model = joblib.load(MODEL_DIR / "dai_predictor.pkl")
    disruption_model = joblib.load(MODEL_DIR / "disruption_model.pkl")
    
    # Model 1: DAI Regression features
    model_1_features = [
        "rainfall", "temperature", "wind_speed", "aqi",
        "average_traffic_speed", "congestion_index", "orders_last_5min",
        "orders_last_15min", "active_riders", "average_delivery_time",
        "hour_of_day", "day_of_week"
    ]
    
    X1 = df[model_1_features]
    y_dai = df["future_dai"]
    X1_train, X1_test, y_dai_train, y_dai_test = train_test_split(
        X1, y_dai, test_size=0.2, random_state=42
    )
    
    # Analyze Model 1
    logger.info("\n" + "="*60)
    logger.info("ANALYZING MODEL 1: DAI REGRESSION")
    logger.info("="*60)
    
    model1_importance = analyze_model_importance(dai_model, model_1_features, "Model 1 (DAI)")
    perm1_importance = analyze_permutation_importance(dai_model, X1_test, y_dai_test, model_1_features, "Model 1 (DAI)")
    corr1_redundant = analyze_correlation(X1, model_1_features)
    recommended_m1 = recommend_feature_set(model1_importance, perm1_importance)
    
    # Model 2: Disruption Classification features
    model_2_features = [
        "rainfall", "aqi", "wind_speed", "average_traffic_speed",
        "congestion_index", "current_dai", "historical_disruption_frequency",
        "zone_risk_score"
    ]
    
    X2_base = df[model_2_features].copy()
    X2_base["traffic_speed"] = df["average_traffic_speed"]
    X2_base["predicted_dai"] = dai_model.predict(X1)
    
    model_2_features_final = [
        "rainfall", "aqi", "wind_speed", "traffic_speed", "congestion_index",
        "current_dai", "predicted_dai", "historical_disruption_frequency",
        "zone_risk_score"
    ]
    
    X2 = X2_base[model_2_features_final]
    y_disruption = df["disruption"].astype(int)
    X2_train, X2_test, y_dis_train, y_dis_test = train_test_split(
        X2, y_disruption, test_size=0.2, random_state=42
    )
    
    # Analyze Model 2
    logger.info("\n" + "="*60)
    logger.info("ANALYZING MODEL 2: DISRUPTION CLASSIFICATION")
    logger.info("="*60)
    
    model2_importance = analyze_model_importance(disruption_model, model_2_features_final, "Model 2 (Disruption)")
    perm2_importance = analyze_permutation_importance(disruption_model, X2_test, y_dis_test, model_2_features_final, "Model 2 (Disruption)")
    corr2_redundant = analyze_correlation(X2, model_2_features_final)
    recommended_m2 = recommend_feature_set(model2_importance, perm2_importance)
    
    # Summary
    logger.info("\n" + "="*60)
    logger.info("SUMMARY")
    logger.info("="*60)
    logger.info(f"Model 1: Keep {len(recommended_m1)}/{len(model_1_features)} features")
    logger.info(f"Model 2: Keep {len(recommended_m2)}/{len(model_2_features_final)} features")
    
    # Save recommendations
    recommendations = {
        'model_1': {
            'original_features': model_1_features,
            'recommended_features': recommended_m1,
            'dropped_count': len(model_1_features) - len(recommended_m1),
            'redundant_pairs': [(f1, f2, float(corr)) for f1, f2, corr in corr1_redundant]
        },
        'model_2': {
            'original_features': model_2_features_final,
            'recommended_features': recommended_m2,
            'dropped_count': len(model_2_features_final) - len(recommended_m2),
            'redundant_pairs': [(f1, f2, float(corr)) for f1, f2, corr in corr2_redundant]
        }
    }
    
    import json
    rec_file = Path(__file__).parent / "feature_recommendations.json"
    with open(rec_file, 'w') as f:
        json.dump(recommendations, f, indent=2)
    
    logger.info(f"\n✓ Feature recommendations saved to {rec_file}")
    
    return recommendations


if __name__ == "__main__":
    main()
