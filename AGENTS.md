# AI Agent Guidelines

This repository contains a FastAPI backend using Neon PostgreSQL.

## Tech Stack
- Python 3.11+
- FastAPI
- SQLAlchemy ORM
- Neon PostgreSQL
- Next.js (TypeScript) frontend
- Celery and Redis for planned background monitoring

## Architecture

The project follows a layered architecture:

routers -> services -> models -> database

Rules:
- Routers define API endpoints
- Services contain business logic
- Models define SQLAlchemy tables
- Schemas handle request/response validation
- Update documentation when behavior changes
- Update the change log when features or behavior change

Routers must NOT contain database queries.

## Project Domain

HustleGuard AI is a parametric insurance platform for gig delivery workers.

Core platform concerns:
- weather disruption monitoring
- AQI and pollution risk monitoring
- traffic disruption monitoring
- government alert ingestion
- Delivery Activity Index (DAI) calculation
- disruption confirmation and payout triggering
- fraud checks and rider eligibility validation

The system is designed to support worker dashboards, admin dashboards, and automatic payouts when measurable disruption thresholds are met.

## Database

Database provider: Neon PostgreSQL

Rules:
- Use SQLAlchemy ORM
- Avoid raw SQL queries unless necessary
- Always use the shared DB session dependency
- Use environment variables for configuration
- Prefer migrations for schema changes as the project matures

Target schema concepts documented in the repo include:
- zones
- riders
- orders
- zone baselines
- disruptions
- payouts
- claims

PostGIS support is part of the intended database design for spatial queries.

## API Rules

- Follow REST conventions
- Use proper HTTP status codes
- Return JSON responses
- Always validate request data with Pydantic schemas
- Do not expose raw database models directly in responses
- Keep future API versioning readiness under `/api/v1/...`
- Use pagination for list endpoints where relevant

## Coding Conventions

Naming:
- snake_case for variables and functions
- PascalCase for classes
- UPPER_CASE for constants

Implementation rules:
- Keep functions small and readable
- Reuse existing utilities when possible
- Prefer async routes when practical
- Use logging instead of print statements
- Explain why in comments, not what

## Security

- Never commit secrets
- Use environment variables
- Validate all inputs
- Never expose secrets in code or logs

## ML Pipeline and Prediction Service

### Trained Models (Phase 2 Optimized)

#### Model 1: Delivery Activity Index (DAI) Regression
- **Type**: RandomForestRegressor with optimized hyperparameters
- **Task**: Predict future DAI (0.0–1.0 scale) indicating disruption severity
- **Phase 1 Performance** (Baseline on synthetic data):
  - R² = 0.9919, RMSE = 0.0153, MAE = 0.0123
  - Test R² = 0.9330
- **Phase 2 Performance** (With enriched features):
  - CV R² = 0.9402 ± 0.0010 (+0.87% improvement ✅)
  - Test R² = 0.9404 (+0.79% improvement ✅)
  - MAE = 0.0336 (-2.6% improvement ✅)
- **Optimal Hyperparameters**: n_estimators=250, max_depth=None, max_features="log2", min_samples_split=2
- **Features Used**: 4 key features (aqi, average_traffic_speed, orders_last_5min, rainfall)
- **Location**: 
  - Phase 1: `backend/ml/models/dai_predictor.pkl`
  - Phase 2: `backend/ml/models/dai_predictor_phase2.pkl` ← Recommended for production

#### Model 2: Disruption Risk Classification
- **Type**: RandomForestClassifier with class_weight="balanced"
- **Task**: Binary classification—predict if conditions indicate delivery disruption
- **Phase 1 Performance** (Baseline):
  - Test Accuracy = 99.80%, Precision = 1.0, Recall = 1.0 (⚠️ likely overfit on synthetic data)
  - Confusion Matrix: 8,599 true negatives, 1,401 true positives
- **Phase 2 Performance** (With enriched features):
  - CV Accuracy = 97.89% ± 0.0018 (more realistic than Phase 1)
  - Test Accuracy = 97.88% (still exceeds original 96% baseline ✅)
  - F1-Score = 0.9783
- **Optimal Hyperparameters**: n_estimators=250, max_depth=15, max_features="log2", min_samples_split=2, class_weight="balanced"
- **Features Used**: 2 primary features (current_dai, rainfall)
- **Location**:
  - Phase 1: `backend/ml/models/disruption_model.pkl`
  - Phase 2: `backend/ml/models/disruption_model_phase2.pkl` ← Beta for A/B testing

### Feature Engineering (Phase 2)

**Enriched Feature Set**: 17 original → 38 total features

**Temporal Features** (7 new):
- `hour_sin`, `hour_cos`, `day_sin`, `day_cos`: Cyclical encoding for time patterns
- `is_weekend`, `is_peak_hour`: Binary flags for delivery patterns
- `hour_category`: Binned hour classification (6 categories)

**Interaction Features** (6 new):
- `rainfall_traffic_risk`: Compound weather + congestion risk
- `aqi_workload_risk`: Pollution impact on rider capacity
- `dai_rainfall_risk`: Forecast disruption exacerbated by weather
- `congestion_load_stress`: Overload stress at congested times
- `overall_adverse_conditions`: Aggregate adverse condition score

**Zone-Level Features** (4 new):
- `zone_disruption_tier`: Zone risk classification (Low/Medium/High)
- `zone_avg_delivery_time`: Zone delivery baseline
- `zone_congestion_level`: Zone congestion tier

**Derived Features** (4 new):
- `disruption_risk_score`: Combined risk metric for monitoring
- `delivery_efficiency`: Orders per (time × riders) ratio
- `environmental_stress`: Composite environmental burden

**Dataset**: `backend/ml/datasets/training_data_enriched.csv` (50,000 rows × 38 features)

### Prediction Endpoint

- **Route**: `POST /ml/predict-disruption`
- **Request Schema**: `DisruptionPredictionRequest`
  - Required fields: `rainfall` (mm), `AQI` (0–500), `traffic_speed` (km/h), `current_dai` (0.0–1.0)
  - Optional: `hour_of_day`, `day_of_week` (auto-filled from system time if omitted)
  - All numeric values validated with Pydantic range constraints

- **Response Schema**: `DisruptionPredictionResponse`
  - `predicted_dai`: Future DAI value (0.0–1.0)
  - `disruption_probability`: Classification probability (0.0–1.0)
  - `risk_label`: Categorical risk ("normal" | "moderate" | "high")
    - "normal": probability < 0.3
    - "moderate": 0.3 ≤ probability < 0.5
    - "high": probability ≥ 0.5
  - Returns HTTP 200 on success, 503 if database unavailable

### Service Layer Integration

- Location: `backend/app/services/ml_service.py`
- Handles prediction logic, model state management, and result classification
- Auto-loads pre-trained models from pickle files on startup
- Logs all predictions with input features and outputs for model monitoring
- Gracefully handles missing temporal features by substituting current system time

### Training & Evaluation

**Datasets**:
- Base: 50,000 synthetic samples with 17 features (environmental, traffic, platform, temporal, zone)
- Enriched: 50,000 samples with 38 features (base + 21 engineered features)

**Training Pipeline**:
- Phase 1: Hyperparameter tuning (RandomizedSearchCV, 40 iterations, 5-fold CV)
- Phase 1: Feature selection (3 methods, 1% importance threshold)
- Phase 1: Threshold optimization (ROC/PR curves, 5 thresholds tested)
- Phase 2: Feature engineering (temporal, interaction, zone-level signals)
- Phase 2: Model training with enriched features and Phase 1 best parameters

**Locations**:
- Dataset: `backend/ml/datasets/training_data.csv` (base) and `training_data_enriched.csv` (Phase 2)
- Training modules: `backend/ml/train_models.py`, `backend/ml/train_models_phase2.py`
- Feature engineering: `backend/ml/feature_engineering.py`
- Evaluation notebook: `backend/ml/Model_Evaluation.ipynb` (all cells executed)
- Metrics: `backend/ml/best_params.json`, `backend/ml/phase2_metrics.json`

## Development Flow

When adding a feature:

1. Create a Pydantic schema (e.g., in `backend/app/schemas/`).
2. Add service logic (e.g., in `backend/app/services/`).
3. Add or update the router endpoint (e.g., in `backend/app/routers/`).
4. Update relevant docs in `docs/` folder.
5. Update `docs/Changes.md` with a summary of changes.

## Current Implementation Status

✓ **Backend Architecture**: Layered structure complete (routers → services → models → database)
✓ **Database**: SQLAlchemy ORM with Neon PostgreSQL connectivity and startup validation
✓ **User Management**: Full CRUD endpoints with layered service and schema validation
✓ **ML Pipeline Phase 1**: Hyperparameter tuning, feature selection, threshold optimization complete
✓ **ML Pipeline Phase 2**: Feature engineering with 21 new enriched features complete
✓ **Model Training**: Both models optimized; Phase 1 baseline models saved; Phase 2 variants ready for production evaluation
✓ **API Documentation**: Comprehensive docs including prediction endpoint request/response contracts
✓ **Project Guidance**: `AGENTS.md`, `copilot-instructions.md`, and `PROJECT_CONTEXT.md` for AI tooling

### Phase 2 Deliverables Summary
- ✅ Feature engineering module (`backend/ml/feature_engineering.py`) with 21 new features
- ✅ Model training on enriched features (`backend/ml/train_models_phase2.py`)
- ✅ Phase 2 metrics and comparison reports (`backend/ml/phase2_metrics.json`)
- ✅ Comprehensive Phase 2 analysis (`docs/Phase2_Results.md`)
- ✅ Model 1 improvement: +0.87% CV R² (0.9315 → 0.9402)
- ✅ Model 2 maintained strong performance: 97.88% accuracy (realistic vs Phase 1 overfit)

## Known Limitations & Future Work

- Phase 1 & 2 models trained on synthetic data; real-world validation pending production traffic
- Feature naming in Phase 2 enriched dataset not perfectly aligned with Phase 1 recommendations (minor impact)
- Background job monitoring via Celery and Redis not yet implemented
- PostGIS spatial queries for zone-based analysis not yet integrated
- Admin and worker dashboard frontend development in progress
- Fraud detection and claim payout workflows in design phase
- **Next**: Phase 3 (Weeks 6-9) will add production data collection, automated retraining, and SMOTE balancing