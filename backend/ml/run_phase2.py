"""
Phase 2: Quick Wins Feature Engineering - Master Orchestrator.

Workflow:
[1/4] Generate base dataset (if not exists)
[2/4] Apply feature engineering (temporal, interaction, zone-level)
[3/4] Train models with enriched features + Phase 1 best params
[4/4] Report improvements vs. Phase 1 baseline
"""

import json
import logging
import subprocess
import sys
from pathlib import Path

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(message)s')
logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parent / "datasets"


def run_step(step_num, step_name, script_module):
    """
    Run a Phase 2 step as a subprocess.
    
    Args:
        step_num: Step number (1-4)
        step_name: Human-readable step name
        script_module: Python module to execute (e.g., 'dataset_generator')
    
    Returns:
        True if successful, False otherwise
    """
    logger.info("")
    logger.info(f"[{step_num}/4] {step_name.upper()}")
    logger.info("-" * 70)
    
    try:
        result = subprocess.run(
            [sys.executable, "-m", script_module.split('.')[0]],
            cwd=Path(__file__).resolve().parent,
            capture_output=False,
            text=True,
            timeout=600
        )
        
        if result.returncode == 0:
            logger.info(f"✓ {step_name} completed successfully")
            return True
        else:
            logger.error(f"✗ {step_name} failed with exit code {result.returncode}")
            return False
    except subprocess.TimeoutExpired:
        logger.error(f"✗ {step_name} timed out after 600 seconds")
        return False
    except Exception as e:
        logger.error(f"✗ {step_name} failed: {e}")
        return False


def compare_phase1_vs_phase2():
    """
    Load Phase 1 and Phase 2 metrics and display comparison.
    """
    logger.info("")
    logger.info("=" * 70)
    logger.info("PHASE 1 vs. PHASE 2 COMPARISON")
    logger.info("=" * 70)
    
    # Load Phase 1 baseline (from best_params.json and stored results)
    # Note: These values were captured during Phase 1 execution
    phase1_metrics = {
        "model_1": {
            "cv_r2": 0.9315,
            "cv_mae": 0.0356,
            "test_r2": 0.9330,
            "test_mae": 0.0345,
            "features": 4,  # After Phase 1 selection
        },
        "model_2": {
            "cv_accuracy": 0.9985,
            "cv_f1": 0.9988,
            "test_accuracy": 0.9980,
            "test_f1": 1.0000,
            "features": 4,  # After Phase 1 selection
        }
    }
    
    # Load Phase 2 results (if available)
    phase2_metrics_file = Path(__file__).resolve().parent / "phase2_metrics.json"
    phase2_metrics = None
    
    if phase2_metrics_file.exists():
        try:
            with open(phase2_metrics_file) as f:
                phase2_metrics = json.load(f)
        except Exception as e:
            logger.warning(f"Could not load Phase 2 metrics: {e}")
    
    if not phase2_metrics:
        logger.warning("Phase 2 metrics not available yet. Run feature engineering and training first.")
        return
    
    # Display comparison
    logger.info("\n" + "=" * 70)
    logger.info("MODEL 1: DAI REGRESSION")
    logger.info("=" * 70)
    
    logger.info(f"\nPhase 1 CV R²:  {phase1_metrics['model_1']['cv_r2']:.4f}")
    logger.info(f"Phase 2 CV R²:  {phase2_metrics['model_1']['cv_r2_mean']:.4f}")
    logger.info(f"Change:  {phase2_metrics['model_1']['cv_r2_mean'] - phase1_metrics['model_1']['cv_r2']:+.4f}")
    
    logger.info(f"\nPhase 1 CV MAE: {phase1_metrics['model_1']['cv_mae']:.4f}")
    logger.info(f"Phase 2 CV MAE: {phase2_metrics['model_1']['cv_mae_mean']:.4f}")
    logger.info(f"Change:  {phase2_metrics['model_1']['cv_mae_mean'] - phase1_metrics['model_1']['cv_mae']:+.4f}")
    
    logger.info(f"\nPhase 1 Test R²:  {phase1_metrics['model_1']['test_r2']:.4f}")
    logger.info(f"Phase 2 Test R²:  {phase2_metrics['model_1']['test_r2']:.4f}")
    logger.info(f"Change: {phase2_metrics['model_1']['test_r2'] - phase1_metrics['model_1']['test_r2']:+.4f}")
    
    logger.info("\n" + "=" * 70)
    logger.info("MODEL 2: DISRUPTION CLASSIFICATION")
    logger.info("=" * 70)
    
    logger.info(f"\nPhase 1 CV Accuracy:  {phase1_metrics['model_2']['cv_accuracy']:.4f}")
    logger.info(f"Phase 2 CV Accuracy:  {phase2_metrics['model_2']['cv_accuracy_mean']:.4f}")
    logger.info(f"Change:  {phase2_metrics['model_2']['cv_accuracy_mean'] - phase1_metrics['model_2']['cv_accuracy']:+.4f}")
    
    logger.info(f"\nPhase 1 Test Accuracy:  {phase1_metrics['model_2']['test_accuracy']:.4f}")
    logger.info(f"Phase 2 Test Accuracy:  {phase2_metrics['model_2']['test_accuracy']:.4f}")
    logger.info(f"Change: {phase2_metrics['model_2']['test_accuracy'] - phase1_metrics['model_2']['test_accuracy']:+.4f}")
    
    logger.info("\n" + "=" * 70)


def main():
    """Execute all Phase 2 steps."""
    logger.info("")
    logger.info("=" * 70)
    logger.info("HUSTLEGUARD AI – PHASE 2: FEATURE ENGINEERING")
    logger.info("=" * 70)
    logger.info("")
    logger.info("Timeline: Weeks 3-5 (Implement temporal, interaction, zone features)")
    logger.info("Goal: +2-5% accuracy improvement via enriched feature set")
    logger.info("")
    
    # Step 1: Ensure base dataset exists
    dataset_file = DATA_DIR / "training_data.csv"
    if not dataset_file.exists():
        logger.info(f"[1/4] GENERATE BASE DATASET")
        logger.info("-" * 70)
        if not run_step(1, "Dataset Generation", "dataset_generator"):
            logger.error("✗ Phase 2 failed at step 1. Exiting.")
            sys.exit(1)
    else:
        logger.info(f"[1/4] SKIP DATASET GENERATION")
        logger.info("-" * 70)
        logger.info(f"✓ Dataset already exists at {dataset_file}")
    
    # Step 2: Apply feature engineering
    logger.info("")
    logger.info(f"[2/4] FEATURE ENGINEERING")
    logger.info("-" * 70)
    
    try:
        from feature_engineering import engineer_features, main as engineer_main
        engineer_main()
        logger.info("✓ Feature engineering completed successfully")
    except Exception as e:
        logger.error(f"✗ Feature engineering failed: {e}")
        logger.error("Phase 2 failed at step 2. Exiting.")
        sys.exit(1)
    
    # Step 3: Train models with enriched features
    logger.info("")
    logger.info(f"[3/4] TRAIN MODELS WITH ENRICHED FEATURES")
    logger.info("-" * 70)
    
    try:
        from train_models_phase2 import train_models_phase2
        
        model_1, model_2, metrics = train_models_phase2(use_enriched=True)
        
        # Save metrics for comparison
        metrics_file = Path(__file__).resolve().parent / "phase2_metrics.json"
        with open(metrics_file, 'w') as f:
            json.dump(metrics, f, indent=2)
        
        logger.info(f"✓ Phase 2 metrics saved to {metrics_file}")
        logger.info("✓ Model training completed successfully")
    except Exception as e:
        logger.error(f"✗ Model training failed: {e}")
        logger.error("Phase 2 failed at step 3. Exiting.")
        sys.exit(1)
    
    # Step 4: Compare Phase 1 vs Phase 2
    logger.info("")
    logger.info(f"[4/4] COMPARE PHASE 1 VS. PHASE 2")
    logger.info("-" * 70)
    
    compare_phase1_vs_phase2()
    
    # Summary
    logger.info("")
    logger.info("=" * 70)
    logger.info("PHASE 2 SUMMARY")
    logger.info("=" * 70)
    logger.info("")
    logger.info("✓ All Phase 2 tasks completed successfully!")
    logger.info("")
    logger.info("Generated Artifacts:")
    logger.info("  - backend/ml/datasets/training_data_enriched.csv (enriched dataset)")
    logger.info("  - backend/ml/models/dai_predictor_phase2.pkl (updated Model 1)")
    logger.info("  - backend/ml/models/disruption_model_phase2.pkl (updated Model 2)")
    logger.info("  - backend/ml/phase2_metrics.json (performance metrics)")
    logger.info("")
    logger.info("Features Added:")
    logger.info("  - Temporal: hour_sin/cos, day_sin/cos, is_weekend, is_peak_hour, hour_category")
    logger.info("  - Interaction: rainfall_traffic_risk, aqi_workload_risk, dai_rainfall_risk, etc.")
    logger.info("  - Zone-level: zone_disruption_tier, zone_congestion_level, zone_avg_delivery_time")
    logger.info("  - Derived: disruption_risk_score, delivery_efficiency, environmental_stress")
    logger.info("")
    logger.info("Next Steps (Phase 3: Weeks 6-9):")
    logger.info("  1. Create production data collection pipeline (DisruptionEvent model)")
    logger.info("  2. Implement feedback endpoint (POST /disruption-feedback)")
    logger.info("  3. Add SMOTE balancing for imbalanced classes")
    logger.info("  4. Create automated retraining pipeline")
    logger.info("  5. Integrate Celery for scheduled retraining")
    logger.info("")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("\n✗ Phase 2 interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"\n✗ Phase 2 failed with error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
