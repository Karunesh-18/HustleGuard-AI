"""
Phase 1 Master Runner: Quick Wins Implementation

Orchestrates all Phase 1 activities in sequence:
1. Hyperparameter tuning for both models
2. Feature selection and importance analysis
3. Threshold optimization for classification
4. Cross-validation on trained models
5. Generate summary report

Run this script to execute the complete Phase 1 pipeline.
"""

import logging
import sys
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Add parent directory to path for imports
ml_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(ml_dir))


def run_phase_1():
    """Execute Phase 1 pipeline."""
    logger.info("\n" + "="*70)
    logger.info("HUSTLEGUARD AI – PHASE 1: QUICK WINS IMPLEMENTATION")
    logger.info("="*70)
    
    # Step 1: Hyperparameter Tuning
    logger.info("\n[1/4] STEP 1: HYPERPARAMETER TUNING")
    logger.info("-" * 70)
    try:
        import hyperparameter_tuning
        hp_results = hyperparameter_tuning.main()
        logger.info("✓ Hyperparameter tuning completed successfully")
    except Exception as e:
        logger.error(f"✗ Hyperparameter tuning failed: {e}")
        return False
    
    # Step 2: Feature Selection
    logger.info("\n[2/4] STEP 2: FEATURE SELECTION & IMPORTANCE ANALYSIS")
    logger.info("-" * 70)
    try:
        import feature_selection
        fs_results = feature_selection.main()
        logger.info("✓ Feature selection analysis completed successfully")
    except Exception as e:
        logger.error(f"✗ Feature selection failed: {e}")
        return False
    
    # Step 3: Threshold Optimization
    logger.info("\n[3/4] STEP 3: THRESHOLD OPTIMIZATION")
    logger.info("-" * 70)
    try:
        import threshold_optimization
        threshold_results = threshold_optimization.main()
        logger.info("✓ Threshold optimization completed successfully")
    except Exception as e:
        logger.error(f"✗ Threshold optimization failed: {e}")
        return False
    
    # Step 4: Train Models with CV
    logger.info("\n[4/4] STEP 4: TRAINING WITH CROSS-VALIDATION")
    logger.info("-" * 70)
    try:
        import train_models
        models = train_models.train_models_with_cv(use_best_params=True)
        logger.info("✓ Model training with cross-validation completed successfully")
    except Exception as e:
        logger.error(f"✗ Model training failed: {e}")
        return False
    
    # Generate Summary Report
    logger.info("\n" + "="*70)
    logger.info("PHASE 1 SUMMARY")
    logger.info("="*70)
    
    logger.info("\n✓ All Phase 1 tasks completed successfully!")
    logger.info("\nGenerated artifacts:")
    logger.info("  - backend/ml/best_params.json (hyperparameter tuning results)")
    logger.info("  - backend/ml/feature_recommendations.json (feature selection)")
    logger.info("  - backend/ml/threshold_analysis.json (threshold optimization)")
    logger.info("  - backend/ml/threshold_curves.png (ROC/PR curves)")
    logger.info("  - backend/ml/models/dai_predictor.pkl (updated with best params)")
    logger.info("  - backend/ml/models/disruption_model.pkl (updated with best params)")
    
    logger.info("\nNext steps:")
    logger.info("  1. Review feature_recommendations.json and retrain with selected features")
    logger.info("  2. Review threshold_analysis.json and choose production threshold")
    logger.info("  3. Update docs/ML_Tuning_Results.md with findings")
    logger.info("  4. Begin Phase 2: Feature Engineering (temporal, interaction features)")
    
    return True


if __name__ == "__main__":
    success = run_phase_1()
    if not success:
        logger.error("\nPhase 1 failed. Check logs above for details.")
        sys.exit(1)
    
    logger.info("\n" + "="*70)
    logger.info("✓ PHASE 1 COMPLETE")
    logger.info("="*70)
