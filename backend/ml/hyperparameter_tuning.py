"""
Hyperparameter tuning for RandomForest models.

Uses GridSearchCV and RandomizedSearchCV to optimize Model 1 (DAI regression)
and Model 2 (Disruption classification) on the synthetic training dataset.
"""

import json
import logging
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.model_selection import GridSearchCV, RandomizedSearchCV, train_test_split

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(message)s')
logger = logging.getLogger(__name__)

# Define paths
DATA_DIR = Path(__file__).parent / "datasets"
MODEL_DIR = Path(__file__).parent / "models"
DATASET_FILE = DATA_DIR / "training_data.csv"
BEST_PARAMS_FILE = Path(__file__).parent / "best_params.json"


def tune_dai_regression(X_train, y_train, X_val, y_val, cv_folds=5):
    """
    Tune RandomForestRegressor hyperparameters for DAI prediction.
    
    Args:
        X_train: Training feature matrix
        y_train: Training target (future_dai)
        X_val: Validation feature matrix
        y_val: Validation target
        cv_folds: Number of cross-validation folds
    
    Returns:
        dict: Best hyperparameters and metrics
    """
    logger.info("Starting DAI Regression hyperparameter tuning...")
    
    # Define parameter grid
    param_grid = {
        'n_estimators': [100, 250, 500],
        'max_depth': [10, 15, 20, None],
        'min_samples_split': [2, 5, 10],
        'min_samples_leaf': [1, 2, 4],
        'max_features': ['sqrt', 'log2']
    }
    
    # Initialize base model
    rf_regressor = RandomForestRegressor(random_state=42, n_jobs=-1)
    
    # Use RandomizedSearchCV for faster exploration (avoid exhaustive grid)
    search = RandomizedSearchCV(
        estimator=rf_regressor,
        param_distributions=param_grid,
        n_iter=40,  # Test 40 random combinations
        cv=cv_folds,
        scoring='r2',
        verbose=2,
        n_jobs=-1,
        random_state=42
    )
    
    search.fit(X_train, y_train)
    
    best_params = search.best_params_
    best_score_cv = search.best_score_
    
    # Evaluate on validation set
    best_model = search.best_estimator_
    val_score = best_model.score(X_val, y_val)
    train_score = best_model.score(X_train, y_train)
    
    logger.info(f"\n{'='*60}")
    logger.info("DAI REGRESSION – TUNING RESULTS")
    logger.info(f"{'='*60}")
    logger.info(f"Best CV R²: {best_score_cv:.4f}")
    logger.info(f"Validation R²: {val_score:.4f}")
    logger.info(f"Train R²: {train_score:.4f}")
    logger.info(f"\nBest Hyperparameters:")
    for key, value in best_params.items():
        logger.info(f"  {key}: {value}")
    
    return {
        'model_type': 'DAI_Regression',
        'best_params': best_params,
        'cv_r2': float(best_score_cv),
        'val_r2': float(val_score),
        'train_r2': float(train_score),
        'param_grid': param_grid
    }


def tune_disruption_classification(X_train, y_train, X_val, y_val, cv_folds=5):
    """
    Tune RandomForestClassifier hyperparameters for disruption prediction.
    
    Args:
        X_train: Training feature matrix
        y_train: Training target (disruption binary label)
        X_val: Validation feature matrix
        y_val: Validation target
        cv_folds: Number of cross-validation folds
    
    Returns:
        dict: Best hyperparameters and metrics
    """
    logger.info("\nStarting Disruption Classification hyperparameter tuning...")
    
    # Define parameter grid
    param_grid = {
        'n_estimators': [100, 250, 500],
        'max_depth': [10, 15, 20, None],
        'min_samples_split': [2, 5, 10],
        'min_samples_leaf': [1, 2, 4],
        'max_features': ['sqrt', 'log2'],
        'class_weight': [None, 'balanced', 'balanced_subsample']
    }
    
    # Initialize base model
    rf_classifier = RandomForestClassifier(random_state=42, n_jobs=-1)
    
    # Use RandomizedSearchCV
    search = RandomizedSearchCV(
        estimator=rf_classifier,
        param_distributions=param_grid,
        n_iter=40,  # Test 40 random combinations
        cv=cv_folds,
        scoring='f1_weighted',  # Better for imbalanced data
        verbose=2,
        n_jobs=-1,
        random_state=42
    )
    
    search.fit(X_train, y_train)
    
    best_params = search.best_params_
    best_score_cv = search.best_score_
    
    # Evaluate on validation set
    best_model = search.best_estimator_
    val_score = best_model.score(X_val, y_val)
    train_score = best_model.score(X_train, y_train)
    
    logger.info(f"\n{'='*60}")
    logger.info("DISRUPTION CLASSIFICATION – TUNING RESULTS")
    logger.info(f"{'='*60}")
    logger.info(f"Best CV F1 (weighted): {best_score_cv:.4f}")
    logger.info(f"Validation Accuracy: {val_score:.4f}")
    logger.info(f"Train Accuracy: {train_score:.4f}")
    logger.info(f"\nBest Hyperparameters:")
    for key, value in best_params.items():
        logger.info(f"  {key}: {value}")
    
    return {
        'model_type': 'Disruption_Classification',
        'best_params': best_params,
        'cv_f1': float(best_score_cv),
        'val_accuracy': float(val_score),
        'train_accuracy': float(train_score),
        'param_grid': param_grid
    }


def main():
    """Main entry point for hyperparameter tuning."""
    # Load dataset
    logger.info("Loading training dataset...")
    df = pd.read_csv(DATASET_FILE)
    logger.info(f"Loaded {len(df):,} samples with {len(df.columns)} features")
    
    # Prepare features for Model 1
    model_1_features = [
        "rainfall", "temperature", "wind_speed", "aqi",
        "average_traffic_speed", "congestion_index", "orders_last_5min",
        "orders_last_15min", "active_riders", "average_delivery_time",
        "hour_of_day", "day_of_week"
    ]
    
    # Prepare features for Model 2
    model_2_features = [
        "rainfall", "aqi", "wind_speed", "average_traffic_speed",
        "congestion_index", "current_dai", "historical_disruption_frequency",
        "zone_risk_score"
    ]
    
    X1 = df[model_1_features]
    y_dai = df["future_dai"]
    
    # For Model 2, use predicted DAI from current Model 1
    dai_model = joblib.load(MODEL_DIR / "dai_predictor.pkl")
    
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
    
    # Split data: 70% train, 15% val, 15% test
    X1_temp, X1_test, y_dai_temp, y_dai_test = train_test_split(
        X1, y_dai, test_size=0.15, random_state=42
    )
    X1_train, X1_val, y_dai_train, y_dai_val = train_test_split(
        X1_temp, y_dai_temp, test_size=0.176, random_state=42  # 15% of total
    )
    
    X2_temp, X2_test, y_dis_temp, y_dis_test = train_test_split(
        X2, y_disruption, test_size=0.15, random_state=42
    )
    X2_train, X2_val, y_dis_train, y_dis_val = train_test_split(
        X2_temp, y_dis_temp, test_size=0.176, random_state=42
    )
    
    logger.info(f"\nTrain/Val/Test split:")
    logger.info(f"  Model 1: {len(X1_train)}/{len(X1_val)}/{len(X1_test)}")
    logger.info(f"  Model 2: {len(X2_train)}/{len(X2_val)}/{len(X2_test)}")
    
    # Perform tuning
    results_1 = tune_dai_regression(X1_train, y_dai_train, X1_val, y_dai_val)
    results_2 = tune_disruption_classification(X2_train, y_dis_train, X2_val, y_dis_val)
    
    # Save results
    all_results = {
        'timestamp': pd.Timestamp.now().isoformat(),
        'models': [results_1, results_2]
    }
    
    with open(BEST_PARAMS_FILE, 'w') as f:
        json.dump(all_results, f, indent=2)
    
    logger.info(f"\n✓ Hyperparameter tuning results saved to {BEST_PARAMS_FILE}")
    
    return all_results


if __name__ == "__main__":
    main()
