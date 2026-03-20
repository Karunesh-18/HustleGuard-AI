#!/usr/bin/env python
"""
Train ML models from the generated dataset.

This script trains both the DAI regression and disruption classification models
and saves them for use in production predictions.

Supports cross-validation and hyperparameter tuning for improved performance.
"""

import json
import logging
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import (
    accuracy_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
)
from sklearn.model_selection import cross_validate, train_test_split

from pipeline import MODEL_1_FEATURES, MODEL_2_FEATURES

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(message)s')
logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parent / "datasets"
MODEL_DIR = Path(__file__).resolve().parent / "models"
DATASET_FILE = DATA_DIR / "training_data.csv"
DAI_MODEL_FILE = MODEL_DIR / "dai_predictor.pkl"
DISRUPTION_MODEL_FILE = MODEL_DIR / "disruption_model.pkl"

RANDOM_SEED = 42


def load_best_params():
    """
    Load best hyperparameters from tuning phase if available.
    
    Returns:
        dict: Best parameters for each model, or empty dict if not found
    """
    best_params_file = Path(__file__).resolve().parent / "best_params.json"
    
    if best_params_file.exists():
        try:
            with open(best_params_file, 'r') as f:
                data = json.load(f)
            logger.info(f"✓ Loaded best hyperparameters from {best_params_file}")
            return data.get('models', {})
        except Exception as e:
            logger.warning(f"Could not load best params: {e}. Using defaults.")
    
    return {}


def train_models_with_cv(use_best_params=True) -> None:
    """Train DAI and disruption models with cross-validation support."""
    if not DATASET_FILE.exists():
        logger.error(f"Dataset file not found: {DATASET_FILE}")
        logger.error("Run dataset_generator.py first.")
        return

    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    logger.info("Loading dataset...")
    data = pd.read_csv(DATASET_FILE)
    logger.info(f"✓ Loaded {len(data):,} samples with {len(data.columns)} features")

    # Prepare targets
    y_dai = data["future_dai"]
    y_disruption = data["disruption"].astype(int)

    # Make sure we have all required columns
    for col in MODEL_1_FEATURES:
        if col not in data.columns:
            logger.error(f"Missing feature: {col}")
            return

    # Load best hyperparameters if available
    best_params_dict = load_best_params() if use_best_params else {}
    
    # Extract Model 1 best params
    model_1_params = {}
    if best_params_dict and isinstance(best_params_dict, list) and len(best_params_dict) > 0:
        m1_data = next((m for m in best_params_dict if m.get('model_type') == 'DAI_Regression'), {})
        model_1_params = m1_data.get('best_params', {})
    
    # Train Model 1: DAI Regression
    logger.info("\nTraining Model 1: DAI Prediction (Regression)...")
    X_model1 = data[MODEL_1_FEATURES]
    
    # Use best params or defaults
    dai_model = RandomForestRegressor(
        n_estimators=model_1_params.get('n_estimators', 250),
        max_depth=model_1_params.get('max_depth', None),
        min_samples_split=model_1_params.get('min_samples_split', 2),
        min_samples_leaf=model_1_params.get('min_samples_leaf', 1),
        max_features=model_1_params.get('max_features', 'sqrt'),
        random_state=RANDOM_SEED,
        n_jobs=-1
    )
    
    # Cross-validation
    logger.info("Running 5-fold cross-validation for Model 1...")
    cv_results_1 = cross_validate(
        dai_model, X_model1, y_dai,
        cv=5,
        scoring=['r2', 'neg_mean_absolute_error', 'neg_mean_squared_error'],
        n_jobs=-1
    )
    
    logger.info(f"  CV R² (mean ± std): {cv_results_1['test_r2'].mean():.4f} ± {cv_results_1['test_r2'].std():.4f}")
    logger.info(f"  CV MAE (mean ± std): {-cv_results_1['test_neg_mean_absolute_error'].mean():.4f} ± {cv_results_1['test_neg_mean_absolute_error'].std():.4f}")
    
    # Train final model on full data
    dai_model.fit(X_model1, y_dai)
    
    # Evaluate Model 1
    y_dai_pred = dai_model.predict(X_model1)
    mae = mean_absolute_error(y_dai, y_dai_pred)
    mse = mean_squared_error(y_dai, y_dai_pred)
    rmse = np.sqrt(mse)
    r2 = r2_score(y_dai, y_dai_pred)

    logger.info(f"✓ Model 1 trained")
    logger.info(f"  Training MAE:  {mae:.4f}")
    logger.info(f"  Training RMSE: {rmse:.4f}")
    logger.info(f"  Training R²:   {r2:.4f}")

    # Extract Model 2 best params
    model_2_params = {}
    if best_params_dict and isinstance(best_params_dict, list) and len(best_params_dict) > 1:
        m2_data = next((m for m in best_params_dict if m.get('model_type') == 'Disruption_Classification'), {})
        model_2_params = m2_data.get('best_params', {})

    # Train Model 2: Disruption Classification
    logger.info("\nTraining Model 2: Disruption Prediction (Classification)...")
    # Build Model 2 features from available data + predicted DAI
    X_model2 = pd.DataFrame()
    X_model2["rainfall"] = data["rainfall"]
    X_model2["aqi"] = data["aqi"]
    X_model2["wind_speed"] = data["wind_speed"]
    X_model2["traffic_speed"] = data["average_traffic_speed"]
    X_model2["congestion_index"] = data["congestion_index"]
    X_model2["current_dai"] = data["current_dai"]
    X_model2["predicted_dai"] = y_dai_pred
    X_model2["historical_disruption_frequency"] = data["historical_disruption_frequency"]
    X_model2["zone_risk_score"] = data["zone_risk_score"]

    disruption_model = RandomForestClassifier(
        n_estimators=model_2_params.get('n_estimators', 250),
        max_depth=model_2_params.get('max_depth', None),
        min_samples_split=model_2_params.get('min_samples_split', 2),
        min_samples_leaf=model_2_params.get('min_samples_leaf', 1),
        max_features=model_2_params.get('max_features', 'sqrt'),
        class_weight=model_2_params.get('class_weight', None),
        random_state=RANDOM_SEED,
        n_jobs=-1
    )
    
    # Cross-validation
    logger.info("Running 5-fold cross-validation for Model 2...")
    cv_results_2 = cross_validate(
        disruption_model, X_model2, y_disruption,
        cv=5,
        scoring=['accuracy', 'precision_weighted', 'recall_weighted', 'f1_weighted'],
        n_jobs=-1
    )
    
    logger.info(f"  CV Accuracy (mean ± std): {cv_results_2['test_accuracy'].mean():.4f} ± {cv_results_2['test_accuracy'].std():.4f}")
    logger.info(f"  CV F1-Score (mean ± std): {cv_results_2['test_f1_weighted'].mean():.4f} ± {cv_results_2['test_f1_weighted'].std():.4f}")
    
    # Train final model on full data
    disruption_model.fit(X_model2, y_disruption)

    # Evaluate Model 2
    y_disruption_pred = disruption_model.predict(X_model2)
    accuracy = accuracy_score(y_disruption, y_disruption_pred)
    precision = precision_score(y_disruption, y_disruption_pred, zero_division=0)
    recall = recall_score(y_disruption, y_disruption_pred, zero_division=0)

    logger.info(f"✓ Model 2 trained")
    logger.info(f"  Training Accuracy:  {accuracy:.4f}")
    logger.info(f"  Training Precision: {precision:.4f}")
    logger.info(f"  Training Recall:    {recall:.4f}")

    # Save models
    logger.info("\nSaving models...")
    joblib.dump(dai_model, DAI_MODEL_FILE)
    joblib.dump(disruption_model, DISRUPTION_MODEL_FILE)

    logger.info(f"✓ Models saved:")
    logger.info(f"  - {DAI_MODEL_FILE}")
    logger.info(f"  - {DISRUPTION_MODEL_FILE}")

    # Feature importance
    logger.info("\nFeature Importance (Model 1 - DAI):")
    importance_1 = pd.Series(dai_model.feature_importances_, index=MODEL_1_FEATURES).sort_values(ascending=False)
    for feature, importance in importance_1.head(5).items():
        logger.info(f"  {feature}: {importance:.4f}")

    logger.info("\nFeature Importance (Model 2 - Disruption):")
    model2_features = X_model2.columns.tolist()
    importance_2 = pd.Series(disruption_model.feature_importances_, index=model2_features).sort_values(ascending=False)
    for feature, importance in importance_2.head(5).items():
        logger.info(f"  {feature}: {importance:.4f}")
    
    return dai_model, disruption_model, cv_results_1, cv_results_2


if __name__ == "__main__":
    train_models_with_cv(use_best_params=True)
