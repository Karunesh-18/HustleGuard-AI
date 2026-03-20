# HustleGuard AI — Parametric Income Protection for Gig Workers

> **Predict. Protect. Pay.**  
> AI-powered parametric insurance that automatically compensates food delivery riders the moment external disruptions reduce their earning potential — no claims, no paperwork, no delays.

*Built for the **Guidewire DEVTrails Hackathon 2026***

---

## Table of Contents

- [The Problem](#-the-problem)
- [Our Solution](#-our-solution)
- [Live Demo](#-live-demo)
- [How It Works](#-how-it-works)
- [ML Pipeline](#-ml-pipeline)
- [Architecture](#-architecture)
- [API Reference](#-api-reference)
- [Tech Stack](#-tech-stack)
- [Performance Metrics](#-performance-metrics)
- [Fraud & Anti-Spoofing](#-fraud--anti-spoofing)
- [Getting Started](#-getting-started)
- [Project Structure](#-project-structure)

---

## 🎯 The Problem

India has **15+ million gig delivery workers** on platforms like Swiggy and Zomato. They earn ₹800–₹1,500/day completing 15–25 deliveries — but their income disappears the moment the environment turns hostile.

**When disruptions hit:**

| Event | Income Loss |
|---|---|
| Heavy rain (>80mm) | 50–70% order drop |
| Hazardous AQI (>400) | 40–60% fewer active riders |
| Traffic gridlock | 30–50% fewer completions |
| Government curfew/strike | 100% shutdown |

Traditional insurance covers health and vehicles. **Nobody covers the income gap.**

---

## 💡 Our Solution

HustleGuard AI is the first **parametric micro-insurance** platform built specifically for gig delivery workers.

**What makes it different:**

- ✅ **Instant automatic payouts** — no claim filing, no paperwork, no delays
- ✅ **Hyperlocal disruption detection** — zone-level granularity, not city-wide averages
- ✅ **AI-powered triggers** — two-stage ML pipeline confirms real disruptions, blocks fraud
- ✅ **₹32/week** — affordable enough for daily-wage workers
- ✅ **Multi-signal fraud defense** — GPS, behavioral, peer-correlation, and motion analysis

---

## 🚀 Live Demo

**Rider Dashboard** — [`https://hustle-guard-ai.vercel.app/`](https://hustle-guard-ai.vercel.app/)  
**Admin Panel** — [`https://hustle-guard-ai.vercel.app/admin`](https://hustle-guard-ai.vercel.app/admin)  
**API Docs** — [`https://hustleguard-ai.onrender.com/docs`](https://hustleguard-ai.onrender.com/docs)

```bash
# Start backend
cd backend && pip install -r requirements.txt
uvicorn main:app --reload

# Start frontend
cd frontend && npm install && npm run dev
```

---

## ⚙️ How It Works

### The Parametric Trigger Loop

```
External Signals (Weather, AQI, Traffic, Alerts)
        │
        ▼
┌────────────────────────┐
│  Feature Extraction    │  ← 17 environmental + platform signals
└────────────┬───────────┘
             │
             ▼
┌────────────────────────┐
│  Model 1: DAI Forecast │  ← Predict future Delivery Activity Index
│  RandomForestRegressor │     R² = 0.9919, RMSE = 0.0153
└────────────┬───────────┘
             │  predicted_dai
             ▼
┌────────────────────────┐
│  Model 2: Disruption   │  ← Binary: normal vs disruption
│  Classifier            │     Accuracy = 99.8%, F1 = 1.00
│  Optimal threshold=0.40│
└────────────┬───────────┘
             │  disruption_probability ≥ 0.40
             ▼
┌────────────────────────┐
│  Fraud Engine          │  ← Multi-signal trust score [0–100]
│  (6-layer validation)  │
└────────────┬───────────┘
             │  trust_score ≥ 80
             ▼
┌────────────────────────┐
│  Automatic Payout      │  ← ₹400–₹600 per eligible rider
│  (Instant / Reviewed)  │
└────────────────────────┘
```

### Delivery Activity Index (DAI)

The DAI is the heartbeat of HustleGuard — a normalized score (0–1) measuring how active deliveries are relative to normal:

```
DAI = Current Orders / Expected Orders

Example:
  Expected: 120 orders/hour
  Current:  35 orders/hour
  DAI = 0.29  →  Disruption triggered
```

A DAI below **0.40** combined with at least one environmental signal triggers a zone-wide payout.

---

## 🤖 ML Pipeline

HustleGuard uses a **two-stage ML pipeline** that has gone through rigorous Phase 1 and Phase 2 optimization.

### Model 1 — DAI Regression

**Goal:** Predict the future Delivery Activity Index (next 30 minutes)

| Metric | Value |
|---|---|
| Model Type | `RandomForestRegressor` (n_estimators=250) |
| R² Score | **0.9919** (99.2% variance explained) |
| RMSE | **0.0153** |
| MAE | **0.0123** |
| Phase 2 CV R² | **0.9402 ± 0.0010** (+0.87% improvement) |

**Top Features by Importance:**

```
orders_last_5min      ████████████████████████  59.74%
average_traffic_speed ████████                  21.31%
rainfall              ████                       9.07%
aqi                   ███                        6.56%
```

### Model 2 — Disruption Classifier

**Goal:** Binary prediction — is this zone experiencing a disruption?

| Metric | Value |
|---|---|
| Model Type | `RandomForestClassifier` (balanced class weights) |
| Accuracy | **99.80%** |
| Precision | **1.00** |
| Recall | **1.00** |
| F1-Score | **1.00** |
| ROC-AUC | **1.0000** |
| Optimal Threshold | **0.40** |

**Confusion Matrix (10,000 test samples):**

```
                   Predicted
                   Normal   Disruption
Actual  Normal      8,599       0      ← Zero false positives
        Disruption      0    1,401     ← Zero missed disruptions
```

### Training Pipeline Progression

```
Phase 1 (Completed ✅)
├── Hyperparameter tuning (RandomizedSearchCV, 40 iterations, 5-fold CV)
├── Feature selection (3 methods: tree importance + permutation + correlation)
├── Threshold optimization (ROC/PR curves, 5 candidate thresholds)
└── Cross-validated training on 50,000 synthetic samples

Phase 2 (Completed ✅)
├── Feature engineering: 17 → 38 features (+21 new signals)
│   ├── Temporal: cyclical hour/day encoding, peak-hour flags, weekend flags
│   ├── Interaction: rainfall×traffic, aqi×workload, dai×weather compound risks
│   ├── Zone-level: disruption tiers, congestion levels, delivery baselines
│   └── Derived: risk scores, delivery efficiency, environmental stress index
├── Model 1 improvement: +0.87% CV R² (0.9315 → 0.9402)
└── Model 2: 97.88% accuracy (more realistic generalization vs Phase 1 overfit)

Phase 3 (Planned)
├── Production data collection + feedback loop
├── Automated monthly retraining pipeline
├── SMOTE class balancing
└── Real-world validation on live platform data
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (Next.js 16)                   │
│   Rider Dashboard  │  Admin Panel  │  Live Zone Heatmap     │
└─────────────────────────────┬───────────────────────────────┘
                              │ REST API
┌─────────────────────────────▼───────────────────────────────┐
│                    BACKEND (FastAPI + Python 3.11)          │
│                                                             │
│  Routers          Services            ML Engine             │
│  ─────────────    ─────────────────   ──────────────────    │
│  /triggers    →   trigger logic    →  predict_disruption()  │
│  /claims      →   fraud scoring    →  dai_predictor.pkl     │
│  /fraud       →   claim decisions  →  disruption_model.pkl  │
│  /riders      →   premium calc     →  ModelRegistry         │
│  /zones       →   domain logic                              │
└─────────────────────────────┬───────────────────────────────┘
                              │ SQLAlchemy ORM
┌─────────────────────────────▼───────────────────────────────┐
│                  DATABASE (Neon PostgreSQL)                  │
│  zones │ riders │ orders │ disruptions │ claims │ payouts   │
│  zone_snapshots │ payout_events │ subscriptions             │
└─────────────────────────────────────────────────────────────┘
```

### Strict Layered Design

```
app/
├── routers/         ← HTTP only — no business logic
│   ├── triggers.py  ← Parametric trigger + auto-payout
│   ├── claims.py    ← Claim evaluation with fraud scoring
│   ├── fraud.py     ← Trust score endpoint
│   ├── domain.py    ← Zones, riders, subscriptions, premiums
│   └── ml.py        ← ML prediction endpoint
├── services/        ← All business logic lives here
│   ├── ml_service.py        ← Prediction orchestration + logging
│   ├── fraud_service.py     ← 6-layer multi-signal trust score
│   ├── claim_service.py     ← Claim decisioning + payout creation
│   ├── domain_service.py    ← Zone/rider/subscription management
│   └── premium_service.py  ← Risk-based premium calculation
├── models/          ← SQLAlchemy table definitions only
└── schemas/         ← Pydantic request/response validation
```

---

## 📡 API Reference

### Disruption Prediction

```http
POST /ml/predict-disruption
Content-Type: application/json

{
  "rainfall": 92,
  "AQI": 110,
  "traffic_speed": 12,
  "current_dai": 0.41
}
```

```json
{
  "predicted_dai": 0.29,
  "disruption_probability": 0.81,
  "risk_label": "high"
}
```

**Risk label thresholds:**

| Label | Probability | Action |
|---|---|---|
| `normal` | < 0.40 | No payout |
| `moderate` | 0.40 – 0.50 | Provisional monitoring |
| `high` | ≥ 0.50 | Trigger payout |

### Parametric Trigger Evaluation

```http
POST /api/v1/triggers/evaluate
Content-Type: application/json

{
  "zone_id": 1,
  "rainfall": 92,
  "AQI": 110,
  "traffic_speed": 12,
  "current_dai": 0.41
}
```

```json
{
  "triggered": true,
  "disruption_probability": 0.81,
  "predicted_dai": 0.29,
  "risk_label": "high",
  "trigger_reason": "Rainfall 92mm > 80mm threshold · DAI 0.41 < 0.40",
  "payout_event_id": 47
}
```

### Fraud Evaluation

```http
POST /api/v1/fraud/evaluate
```

Returns a weighted trust score (0–100) across 6 independent signal dimensions with a decision band (Green / Yellow / Orange / Red) and itemized reasons.

### Other Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | System health + DB status |
| `POST` | `/riders/onboard` | Register a new rider |
| `POST` | `/subscriptions` | Activate insurance subscription |
| `POST` | `/api/v1/premium/calculate` | Calculate weekly premium |
| `GET` | `/zones/live-data` | Live zone DAI snapshots |
| `GET` | `/payouts/recent` | Recent payout events |
| `GET` | `/api/v1/zones/workability` | Zone workability score |
| `POST` | `/api/v1/claims/evaluate-and-create` | Evaluate claim + fraud + payout |

---

## 🛡️ Fraud & Anti-Spoofing

HustleGuard is built for adversarial conditions where coordinated fraud rings attempt to drain liquidity using GPS spoofing.

### Why Single-Source Trust Fails

GPS can be faked in seconds. IP geolocation is coarse and unstable on mobile. HustleGuard validates claims through **contextual consistency** — does this claim make sense given everything else we know about this zone, this rider, and this moment?

### Fraud Trust Score

$$S = 0.25 \cdot E + 0.25 \cdot D + 0.15 \cdot B + 0.15 \cdot M + 0.10 \cdot I + 0.10 \cdot P$$

| Signal | Symbol | What It Catches |
|---|---|---|
| Environmental consistency | E | Claims without matching weather data |
| DAI/zone consistency | D | Individual claims vs. zone-wide disruption |
| Behavioral continuity | B | First-time zones, abnormal claim frequency |
| Motion realism | M | GPS teleportation, impossible movement speeds |
| IP/network consistency | I | GPS/IP city mismatch, known VPN subnets |
| Peer coordination safety | P | Synchronized ring fraud bursts |

### Fraud Decision Example

| Signal | Score | Weight | Contribution |
|---|---|---|---|
| Environmental | 90 | 0.25 | 22.50 |
| DAI/Zone | 85 | 0.25 | 21.25 |
| Behavioral | 70 | 0.15 | 10.50 |
| Motion | 80 | 0.15 | 12.00 |
| IP/Network | 60 | 0.10 | 6.00 |
| Peer Safety | 95 | 0.10 | 9.50 |
| **Total** | | **1.00** | **81.75 → Instant Payout** |

### Decision Bands

| Score | Band | Action |
|---|---|---|
| 80–100 | 🟢 Green | Instant payout |
| 55–79 | 🟡 Yellow | Provisional payout + passive review |
| 35–54 | 🟠 Orange | Active review + evidence request |
| 0–34 | 🔴 Red | Hold / reject pending investigation |

### Ring Fraud Detection

Synchronized fraud rings show predictable patterns — same-time claim bursts, dense GPS clusters, shared subnet blocks. HustleGuard flags when 40+ peers claim from the same area within 15 minutes, blocking coordinated drain attacks.

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16, TypeScript, TailwindCSS |
| **Backend** | FastAPI, Python 3.11+, Uvicorn |
| **Database** | Neon PostgreSQL, SQLAlchemy ORM |
| **ML** | scikit-learn (RandomForest), pandas, NumPy, joblib |
| **Background Jobs** | Celery + Redis *(Phase 3)* |
| **Maps** | Leaflet.js, SVG zone heatmaps |
| **Payments** | Razorpay Sandbox |
| **Deployment** | Vercel (frontend), Python server (backend) |

---

## 📊 Performance Metrics

### ML Model Results

| Model | Metric | Phase 1 | Phase 2 |
|---|---|---|---|
| DAI Regressor | CV R² | 0.9315 | **0.9402** (+0.87%) |
| DAI Regressor | Test R² | 0.9330 | **0.9404** (+0.79%) |
| DAI Regressor | MAE | 0.0345 | **0.0336** (-2.6%) |
| Disruption Classifier | CV Accuracy | 99.85% | 97.88% (realistic) |
| Disruption Classifier | Test Accuracy | 99.80% | 97.88% |
| Disruption Classifier | False Positives | 0 | — |

### Training Dataset

| Property | Value |
|---|---|
| Training samples | 50,000 |
| Features (base) | 17 |
| Features (Phase 2) | 38 (+21 engineered) |
| Disruption rate | 14.4% (realistic class imbalance) |
| Cross-validation | 5-fold |
| Hyperparameter search | 40 iterations, RandomizedSearchCV |

---

## 🚦 Getting Started

### Prerequisites

- Python 3.11+
- Node.js 20+
- PostgreSQL (or a [Neon](https://neon.tech) account for free serverless Postgres)

### Backend Setup

```bash
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and set: DATABASE_URL=postgresql://...

# Generate training data and train ML models
# (models auto-train on first API request if pkl files are missing)
cd ml
python dataset_generator.py   # creates datasets/training_data.csv
python train_models.py         # creates models/*.pkl
cd ..

# Start the API server
uvicorn main:app --reload
# → API:  http://localhost:8000
# → Docs: http://localhost:8000/docs
```

### Frontend Setup

```bash
cd frontend
npm install

# Point to your backend (optional — defaults to localhost:8000)
echo "NEXT_PUBLIC_API_BASE=http://localhost:8000" > .env.local

npm run dev
# → App: http://localhost:3000
```

### Run the Full ML Optimization Pipeline

```bash
cd backend/ml

# Phase 1: Hyperparameter tuning + feature selection + threshold optimization
python run_phase1.py

# Phase 2: Feature engineering + enriched model training
python run_phase2.py

# Evaluate models with full metrics and visualizations
jupyter notebook Model_Evaluation.ipynb
```

---

## 📁 Project Structure

```
HustleGuard-AI/
├── backend/
│   ├── app/
│   │   ├── routers/           # HTTP endpoint handlers
│   │   ├── services/          # Business logic
│   │   ├── models/            # SQLAlchemy ORM models
│   │   ├── schemas/           # Pydantic validation
│   │   └── database.py
│   ├── ml/
│   │   ├── datasets/          # Training data (gitignored)
│   │   ├── models/            # Trained .pkl files (gitignored)
│   │   ├── pipeline.py        # Core ML feature definitions
│   │   ├── predict.py         # ModelRegistry + inference
│   │   ├── dataset_generator.py
│   │   ├── train_models.py
│   │   ├── feature_engineering.py
│   │   ├── hyperparameter_tuning.py
│   │   ├── feature_selection.py
│   │   ├── threshold_optimization.py
│   │   ├── Model_Evaluation.ipynb
│   │   ├── best_params.json
│   │   ├── feature_recommendations.json
│   │   └── threshold_analysis.json
│   ├── main.py
│   └── requirements.txt
├── frontend/
│   ├── src/app/
│   │   ├── page.tsx           # Rider dashboard
│   │   ├── admin/page.tsx     # Admin panel
│   │   └── globals.css
│   └── package.json
├── docs/
│   ├── Architecture.md
│   ├── ML_PIPELINE.md
│   ├── Phase1_Results.md
│   ├── Phase2_Results.md
│   ├── API_Rules.md
│   ├── Changes.md
│   └── Database_Schema.md
└── README.md
```

---

## 🗺️ Roadmap

### ✅ Completed

- Two-stage ML prediction pipeline (DAI regression + disruption classification)
- 6-layer anti-fraud trust scoring engine
- Parametric trigger evaluation with auto-payout creation
- Rider onboarding, subscription management, premium calculation
- Admin dashboard with live zone heatmap and ML forecasts
- Phase 1: Hyperparameter tuning, feature selection, threshold optimization
- Phase 2: Feature engineering (17 → 38 features), +0.87% model improvement

### 🔜 Phase 3 — Production Integration

- [ ] Real delivery platform data ingestion pipeline
- [ ] `POST /disruption-feedback` for ground-truth label collection
- [ ] Automated monthly model retraining (Celery + Redis scheduler)
- [ ] SMOTE balancing for improved minority-class recall
- [ ] Model performance drift detection and alerting
- [ ] A/B testing framework: Phase 2 vs Phase 1 model comparison

### 🔮 Future Vision

- [ ] PostGIS spatial queries for precise zone boundary operations
- [ ] Real-time Redis caching for sub-50ms prediction latency
- [ ] Zone-specific model variants capturing city-level patterns
- [ ] Mobile app for riders (React Native)
- [ ] Expand beyond food delivery: grocery, e-commerce, hyperlocal logistics

---

## 🏆 Hackathon Compliance Checklist

| Requirement | Status | Details |
|---|---|---|
| Covers income loss only | ✅ | Parametric income protection, not health/vehicle |
| Parametric triggers | ✅ | Rainfall, DAI, AQI, traffic speed thresholds |
| Weekly subscription pricing | ✅ | ₹20–₹45/week based on zone risk |
| Single persona (food delivery) | ✅ | Swiggy/Zomato riders in Bangalore |
| AI risk pricing engine | ✅ | Zone risk × rider reliability score |
| Fraud detection | ✅ | 6-signal weighted trust score, ring detection |
| Automated claims & payouts | ✅ | Instant payout on trigger confirmation |
| ML model with documented metrics | ✅ | R²=0.9919, Accuracy=99.8%, full CV evaluation |
| Working backend + frontend | ✅ | FastAPI + Next.js, live API integration |

---