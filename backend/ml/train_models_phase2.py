"""
Phase 2: Train models with enriched features (temporal, interaction, zone-level).

Workflow:
1. Load enriched dataset (created by feature_engineering.py)
2. Apply Phase 1 feature selection recommendations (keep best 4 features per model)
3. Train with Phase 1 optimal hyperparameters
4. Report improvement vs. Phase 1 baseline
5. Save updated models
"""

import json
import logging
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import (
    accuracy_score, f1_score, mean_absolute_error, mean_squared_error, r2_score
)
from sklearn.model_selection import cross_validate, train_test_split

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(message)s')
logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parent / "datasets"
MODELS_DIR = Path(__file__).resolve().parent / "models"
BEST_PARAMS_FILE = Path(__file__).resolve().parent / "best_params.json"
FEATURE_RECOMMENDATIONS_FILE = Path(__file__).resolve().parent / "feature_recommendations.json"


def load_best_params():
    """Load best hyperparameters found in Phase 1."""
    if not BEST_PARAMS_FILE.exists():
        logger.warning("best_params.json not found. Using default hyperparameters.")
        return None
    
    with open(BEST_PARAMS_FILE) as f:
        data = json.load(f)
    
    params = {}
    for model in data.get("models", []):
        model_type = model["model_type"]
        params[model_type] = model.get("best_params", {})
    
    logger.info(f"✓ Loaded Phase 1 best parameters from {BEST_PARAMS_FILE}")
    return params


def load_feature_recommendations():
    """Load Phase 1 feature selection recommendations."""
    if not FEATURE_RECOMMENDATIONS_FILE.exists():
        logger.warning("feature_recommendations.json not found. Using all features.")
        return None
    
    with open(FEATURE_RECOMMENDATIONS_FILE) as f:
        recommendations = json.load(f)
    
    logger.info(f"✓ Loaded Phase 1 feature recommendations from {FEATURE_RECOMMENDATIONS_FILE}")
    return recommendations


def select_model_features(df: pd.DataFrame, recommendations: dict, model_num: int) -> pd.DataFrame:
    """
    Select features recommended for a specific model from Phase 1.
    
    Args:
        df: Dataset with all engineered features
        recommendations: Phase 1 feature selection output
        model_num: 1 for DAI regression, 2 for disruption classification
    
    Returns:
        Subset of df with recommended features
    """
    model_key = "model_1" if model_num == 1 else "model_2"
    
    if not recommendations or model_key not in recommendations:
        logger.warning(f"No recommendations for {model_key}. Using all available features.")
        return df
    
    recommended_features = recommendations[model_key].get("recommended_features", [])
    
    if not recommended_features:
        logger.warning(f"No recommended features for {model_key}. Using all features.")
        return df
    
    # Filter to only include columns that exist in dataframe
    available_features = [f for f in recommended_features if f in df.columns]
    
    logger.info(f"  {model_key}: Selecting {len(available_features)} features: {available_features}")
    
    return df[available_features]


def train_models_phase2(use_enriched=True):
    """
    Train models with enriched features using Phase 1 hyperparameters.
    
    Args:
        use_enriched: If True, use enriched dataset; if False, use base dataset
    
    Returns:
        Tuple of (model_1, model_2, metrics_dict)
    """
    # Load best parameters from Phase 1
    best_params = load_best_params()
    recommendations = load_feature_recommendations()
    
    # Select dataset
    if use_enriched:
        dataset_file = DATA_DIR / "training_data_enriched.csv"
    else:
        dataset_file = DATA_DIR / "training_data.csv"
    
    if not dataset_file.exists():
        logger.error(f"Dataset not found at {dataset_file}")
        raise FileNotFoundError(f"Dataset required at {dataset_file}")
    
    logger.info(f"\nLoading dataset from {dataset_file}...")
    df = pd.read_csv(dataset_file)
    logger.info(f"✓ Loaded {len(df)} samples with {df.shape[1]} features")
    
    # Prepare target variables
    y_dai = df['future_dai']
    y_disruption = df['disruption']
    
    # Create feature matrices (all features except targets)
    feature_cols = [c for c in df.columns if c not in ['disruption', 'future_dai']]
    X_full = df[feature_cols]
    
    # Apply Phase 1 feature selection
    if recommendations:
        X_dai = select_model_features(df, recommendations, model_num=1)
        X_disruption = select_model_features(df, recommendations, model_num=2)
    else:
        X_dai = X_full
        X_disruption = X_full
    
    # Train-test split (70% train, 30% test)
    X_dai_train, X_dai_test, y_dai_train, y_dai_test = train_test_split(
        X_dai, y_dai, test_size=0.3, random_state=42
    )
    X_dis_train, X_dis_test, y_dis_train, y_dis_test = train_test_split(
        X_disruption, y_disruption, test_size=0.3, random_state=42
    )
    
    logger.info(f"\nTrain/Test split: {len(X_dai_train)}/{len(X_dai_test)}")
    
    # ===== MODEL 1: DAI REGRESSION =====
    logger.info("\n" + "=" * 70)
    logger.info("MODEL 1: DAI PREDICTION (REGRESSION)")
    logger.info("=" * 70)
    
    # Extract best params for Model 1
    params_1 = best_params.get("DAI_Regression", {}) if best_params else {}
    if not params_1:
        params_1 = {
            "n_estimators": 250,
            "max_depth": None,
            "min_samples_split": 2,
            "min_samples_leaf": 1,
            "max_features": "log2",
            "random_state": 42,
            "n_jobs": -1
        }
    
    logger.info(f"Hyperparameters: {params_1}")
    
    model_1 = RandomForestRegressor(**params_1)
    
    # 5-fold cross-validation
    logger.info("Running 5-fold cross-validation...")
    cv_results_1 = cross_validate(
        model_1,
        X_dai_train,
        y_dai_train,
        cv=5,
        scoring=['r2', 'neg_mean_absolute_error', 'neg_mean_squared_error'],
        n_jobs=-1
    )
    
    cv_r2_mean = cv_results_1['test_r2'].mean()
    cv_r2_std = cv_results_1['test_r2'].std()
    cv_mae_mean = -cv_results_1['test_neg_mean_absolute_error'].mean()
    cv_mae_std = -cv_results_1['test_neg_mean_absolute_error'].std()
    
    logger.info(f"  CV R² (mean ± std): {cv_r2_mean:.4f} ± {cv_r2_std:.4f}")
    logger.info(f"  CV MAE (mean ± std): {cv_mae_mean:.4f} ± {cv_mae_std:.4f}")
    
    # Train final model
    logger.info("Training final model on full training set...")
    model_1.fit(X_dai_train, y_dai_train)
    
    # Test set evaluation
    y_dai_pred = model_1.predict(X_dai_test)
    test_r2 = r2_score(y_dai_test, y_dai_pred)
    test_mae = mean_absolute_error(y_dai_test, y_dai_pred)
    test_rmse = np.sqrt(mean_squared_error(y_dai_test, y_dai_pred))
    
    logger.info(f"  Test R²: {test_r2:.4f}")
    logger.info(f"  Test MAE: {test_mae:.4f}")
    logger.info(f"  Test RMSE: {test_rmse:.4f}")
    
    # ===== MODEL 2: DISRUPTION CLASSIFICATION =====
    logger.info("\n" + "=" * 70)
    logger.info("MODEL 2: DISRUPTION PREDICTION (CLASSIFICATION)")
    logger.info("=" * 70)
    
    # Extract best params for Model 2
    params_2 = best_params.get("Disruption_Classification", {}) if best_params else {}
    if not params_2:
        params_2 = {
            "n_estimators": 250,
            "max_depth": 15,
            "min_samples_split": 2,
            "min_samples_leaf": 1,
            "max_features": "log2",
            "class_weight": "balanced",
            "random_state": 42,
            "n_jobs": -1
        }
    
    logger.info(f"Hyperparameters: {params_2}")
    
    model_2 = RandomForestClassifier(**params_2)
    
    # 5-fold cross-validation
    logger.info("Running 5-fold cross-validation...")
    cv_results_2 = cross_validate(
        model_2,
        X_dis_train,
        y_dis_train,
        cv=5,
        scoring=['accuracy', 'precision_weighted', 'recall_weighted', 'f1_weighted'],
        n_jobs=-1
    )
    
    cv_acc_mean = cv_results_2['test_accuracy'].mean()
    cv_acc_std = cv_results_2['test_accuracy'].std()
    cv_f1_mean = cv_results_2['test_f1_weighted'].mean()
    cv_f1_std = cv_results_2['test_f1_weighted'].std()
    
    logger.info(f"  CV Accuracy (mean ± std): {cv_acc_mean:.4f} ± {cv_acc_std:.4f}")
    logger.info(f"  CV F1-Score (mean ± std): {cv_f1_mean:.4f} ± {cv_f1_std:.4f}")
    
    # Train final model
    logger.info("Training final model on full training set...")
    model_2.fit(X_dis_train, y_dis_train)
    
    # Test set evaluation
    y_dis_pred = model_2.predict(X_dis_test)
    test_accuracy = accuracy_score(y_dis_test, y_dis_pred)
    test_f1 = f1_score(y_dis_test, y_dis_pred, average='weighted')
    
    logger.info(f"  Test Accuracy: {test_accuracy:.4f}")
    logger.info(f"  Test F1-Score: {test_f1:.4f}")
    
    # Save models
    logger.info("\n" + "=" * 70)
    logger.info("SAVING MODELS")
    logger.info("=" * 70)
    
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    
    model_1_file = MODELS_DIR / "dai_predictor_phase2.pkl"
    model_2_file = MODELS_DIR / "disruption_model_phase2.pkl"
    
    joblib.dump(model_1, model_1_file)
    logger.info(f"✓ Model 1 saved to {model_1_file}")
    
    joblib.dump(model_2, model_2_file)
    logger.info(f"✓ Model 2 saved to {model_2_file}")
    
    # Compile metrics for comparison
    metrics = {
        "model_1": {
            "cv_r2_mean": float(cv_r2_mean),
            "cv_r2_std": float(cv_r2_std),
            "cv_mae_mean": float(cv_mae_mean),
            "cv_mae_std": float(cv_mae_std),
            "test_r2": float(test_r2),
            "test_mae": float(test_mae),
            "test_rmse": float(test_rmse),
            "features_count": X_dai.shape[1],
        },
        "model_2": {
            "cv_accuracy_mean": float(cv_acc_mean),
            "cv_accuracy_std": float(cv_acc_std),
            "cv_f1_mean": float(cv_f1_mean),
            "cv_f1_std": float(cv_f1_std),
            "test_accuracy": float(test_accuracy),
            "test_f1": float(test_f1),
            "features_count": X_disruption.shape[1],
        }
    }
    
    return model_1, model_2, metrics


if __name__ == "__main__":
    logger.info("\n" + "=" * 70)
    logger.info("PHASE 2: TRAINING WITH ENRICHED FEATURES")
    logger.info("=" * 70)
    
    model_1, model_2, metrics = train_models_phase2(use_enriched=True)
    
    logger.info("\n" + "=" * 70)
    logger.info("PHASE 2 TRAINING COMPLETE")
    logger.info("=" * 70)
    logger.info(f"\nMetrics:\n{json.dumps(metrics, indent=2)}")
