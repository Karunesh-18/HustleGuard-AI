"""
Threshold optimization for disruption classification model.

Determines optimal decision threshold based on:
- Precision-recall curve
- ROC-AUC curve
- F1-score
- Business cost analysis
"""

import logging
import json
from pathlib import Path

import joblib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import (
    auc, confusion_matrix, f1_score, precision_recall_curve,
    precision_score, recall_score, roc_auc_score, roc_curve
)
from sklearn.model_selection import train_test_split

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(message)s')
logger = logging.getLogger(__name__)

# Define paths
DATA_DIR = Path(__file__).parent / "datasets"
MODEL_DIR = Path(__file__).parent / "models"
DATASET_FILE = DATA_DIR / "training_data.csv"
THRESHOLD_OUTPUT = Path(__file__).parent / "threshold_analysis.json"


def analyze_thresholds(model, X_test, y_test, feature_names):
    """
    Comprehensively analyze classification thresholds.
    
    Args:
        model: Trained RandomForestClassifier
        X_test: Test feature matrix
        y_test: Test target (binary labels)
        feature_names: List of feature names
    
    Returns:
        dict: Comprehensive threshold analysis results
    """
    logger.info("Analyzing classification thresholds...")
    
    # Get probability predictions for positive class
    y_proba = model.predict_proba(X_test)[:, 1]
    
    # Calculate ROC curve
    fpr, tpr, thresholds_roc = roc_curve(y_test, y_proba)
    roc_auc = roc_auc_score(y_test, y_proba)
    
    # Calculate Precision-Recall curve
    precision, recall, thresholds_pr = precision_recall_curve(y_test, y_proba)
    pr_auc = auc(recall, precision)
    
    logger.info(f"\n{'='*60}")
    logger.info("THRESHOLD ANALYSIS RESULTS")
    logger.info(f"{'='*60}")
    logger.info(f"ROC-AUC: {roc_auc:.4f}")
    logger.info(f"PR-AUC: {pr_auc:.4f}")
    
    # Analyze different threshold candidates
    threshold_candidates = [0.3, 0.4, 0.5, 0.6, 0.7]
    threshold_metrics = []
    
    logger.info(f"\n{'='*60}")
    logger.info("THRESHOLD METRICS COMPARISON")
    logger.info(f"{'='*60 }\n")
    logger.info(f"{'Threshold':<12} {'Precision':<12} {'Recall':<12} {'F1-Score':<12} {'Specificity':<12}")
    logger.info("-" * 60)
    
    for threshold in threshold_candidates:
        y_pred = (y_proba >= threshold).astype(int)
        
        prec = precision_score(y_test, y_pred, zero_division=0)
        rec = recall_score(y_test, y_pred, zero_division=0)
        f1 = f1_score(y_test, y_pred, zero_division=0)
        
        tn, fp, fn, tp = confusion_matrix(y_test, y_pred).ravel()
        specificity = tn / (tn + fp) if (tn + fp) > 0 else 0
        
        logger.info(
            f"{threshold:<12.1f} {prec:<12.4f} {rec:<12.4f} {f1:<12.4f} {specificity:<12.4f}"
        )
        
        threshold_metrics.append({
            'threshold': threshold,
            'precision': float(prec),
            'recall': float(rec),
            'f1_score': float(f1),
            'specificity': float(specificity),
            'tn': int(tn),
            'fp': int(fp),
            'fn': int(fn),
            'tp': int(tp)
        })
    
    # Find optimal threshold by F1-score
    best_f1_idx = np.argmax([m['f1_score'] for m in threshold_metrics])
    optimal_threshold_f1 = threshold_metrics[best_f1_idx]
    
    # Find threshold that minimizes false positives (worker over-compensation risk)
    fp_costs = [m['fp'] for m in threshold_metrics]
    lowest_fp_idx = np.argmin(fp_costs)
    optimal_threshold_fp = threshold_metrics[lowest_fp_idx]
    
    # Find threshold that minimizes false negatives (missed disruptions)
    fn_costs = [m['fn'] for m in threshold_metrics]
    lowest_fn_idx = np.argmin(fn_costs)
    optimal_threshold_fn = threshold_metrics[lowest_fn_idx]
    
    logger.info(f"\n{'='*60}")
    logger.info("THRESHOLD RECOMMENDATIONS")
    logger.info(f"{'='*60}")
    logger.info(f"\nBased on F1-Score (balanced):")
    logger.info(f"  Threshold: {optimal_threshold_f1['threshold']}")
    logger.info(f"  F1-Score: {optimal_threshold_f1['f1_score']:.4f}")
    logger.info(f"  Precision: {optimal_threshold_f1['precision']:.4f} | Recall: {optimal_threshold_f1['recall']:.4f}")
    
    logger.info(f"\nBased on Minimizing False Positives (cost-sensitive):")
    logger.info(f"  Threshold: {optimal_threshold_fp['threshold']}")
    logger.info(f"  False Positives: {optimal_threshold_fp['fp']}")
    logger.info(f"  Recall (capture disruptions): {optimal_threshold_fp['recall']:.4f}")
    
    logger.info(f"\nBased on Minimizing False Negatives (sensitivity):")
    logger.info(f"  Threshold: {optimal_threshold_fn['threshold']}")
    logger.info(f"  False Negatives: {optimal_threshold_fn['fn']}")
    logger.info(f"  Precision (avoid false alarms): {optimal_threshold_fn['precision']:.4f}")
    
    return {
        'roc_auc': float(roc_auc),
        'pr_auc': float(pr_auc),
        'default_threshold_metrics': threshold_metrics,
        'optimal_f1': optimal_threshold_f1,
        'optimal_fp_minimizing': optimal_threshold_fp,
        'optimal_fn_minimizing': optimal_threshold_fn,
        'recommendation': {
            'default': 0.5,
            'recommended': optimal_threshold_f1['threshold'],
            'business_context': 'If false positives (over-compensation) are expensive, lower threshold; if false negatives (missed disruptions) are costly, raise threshold.',
            'recommended_for_production': optimal_threshold_fp['threshold'] if optimal_threshold_fp['fp'] < 100 else 0.5
        }
    }


def plot_threshold_curves(model, X_test, y_test, output_dir=None):
    """
    Create visualization of ROC and Precision-Recall curves.
    
    Args:
        model: Trained classifier
        X_test: Test features
        y_test: Test targets
        output_dir: Directory to save plots (default: ml directory)
    """
    if output_dir is None:
        output_dir = Path(__file__).parent
    
    logger.info(f"\nGenerating threshold curves...")
    
    y_proba = model.predict_proba(X_test)[:, 1]
    
    # ROC Curve
    fpr, tpr, _ = roc_curve(y_test, y_proba)
    roc_auc = roc_auc_score(y_test, y_proba)
    
    # Precision-Recall Curve
    precision, recall, _ = precision_recall_curve(y_test, y_proba)
    
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    
    # Plot ROC
    axes[0].plot(fpr, tpr, color='darkorange', lw=2, label=f'ROC curve (AUC = {roc_auc:.4f})')
    axes[0].plot([0, 1], [0, 1], color='navy', lw=2, linestyle='--', label='Random Classifier')
    axes[0].set_xlim([0.0, 1.0])
    axes[0].set_ylim([0.0, 1.05])
    axes[0].set_xlabel('False Positive Rate')
    axes[0].set_ylabel('True Positive Rate')
    axes[0].set_title('ROC Curve – Disruption Prediction')
    axes[0].legend(loc="lower right")
    axes[0].grid(alpha=0.3)
    
    # Plot Precision-Recall
    axes[1].plot(recall, precision, color='green', lw=2, label='Precision-Recall Curve')
    axes[1].fill_between(recall, precision, alpha=0.2, color='green')
    axes[1].set_xlim([0.0, 1.0])
    axes[1].set_ylim([0.0, 1.05])
    axes[1].set_xlabel('Recall (True Positive Rate)')
    axes[1].set_ylabel('Precision')
    axes[1].set_title('Precision-Recall Curve – Disruption Prediction')
    axes[1].legend(loc="lower left")
    axes[1].grid(alpha=0.3)
    
    plt.tight_layout()
    output_path = output_dir / "threshold_curves.png"
    plt.savefig(output_path, dpi=150, bbox_inches='tight')
    logger.info(f"✓ Threshold curves saved to {output_path}")
    plt.close()


def main():
    """Main entry point for threshold optimization."""
    # Load data and model
    logger.info("Loading dataset and disruption model...")
    df = pd.read_csv(DATASET_FILE)
    dai_model = joblib.load(MODEL_DIR / "dai_predictor.pkl")
    disruption_model = joblib.load(MODEL_DIR / "disruption_model.pkl")
    
    # Prepare features
    model_1_features = [
        "rainfall", "temperature", "wind_speed", "aqi",
        "average_traffic_speed", "congestion_index", "orders_last_5min",
        "orders_last_15min", "active_riders", "average_delivery_time",
        "hour_of_day", "day_of_week"
    ]
    
    model_2_features = [
        "rainfall", "aqi", "wind_speed", "average_traffic_speed",
        "congestion_index", "current_dai", "historical_disruption_frequency",
        "zone_risk_score"
    ]
    
    X1 = df[model_1_features]
    y_dai = df["future_dai"]
    
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
    
    # Split data
    X2_train, X2_test, y_dis_train, y_dis_test = train_test_split(
        X2, y_disruption, test_size=0.2, random_state=42
    )
    
    # Analyze thresholds
    analysis_results = analyze_thresholds(disruption_model, X2_test, y_dis_test, model_2_features_final)
    
    # Generate plots
    plot_threshold_curves(disruption_model, X2_test, y_dis_test)
    
    # Save results
    with open(THRESHOLD_OUTPUT, 'w') as f:
        json.dump(analysis_results, f, indent=2)
    
    logger.info(f"\n✓ Threshold analysis saved to {THRESHOLD_OUTPUT}")
    
    return analysis_results


if __name__ == "__main__":
    main()
