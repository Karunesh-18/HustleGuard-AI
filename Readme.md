# HustleGuard AI

**Predict. Protect. Pay.**

AI-powered parametric income protection for gig delivery workers.

Built for **Guidewire DEVTrails Hackathon 2026**.

## Overview

HustleGuard AI is an AI-powered parametric insurance platform designed to protect gig delivery workers from income loss caused by external disruptions such as:

- extreme weather
- hazardous pollution
- traffic gridlock
- government restrictions

Food delivery ecosystems such as Swiggy and Zomato rely on millions of gig workers who earn income per completed delivery. When external conditions prevent deliveries from happening, riders immediately lose income with no financial safety net.

HustleGuard AI solves this by introducing weekly micro-insurance with intelligent disruption monitoring and automatic payouts.

The platform continuously monitors environmental signals and operational data across delivery zones. When disruptions significantly reduce delivery activity, the system compensates affected workers automatically.

Unlike traditional insurance, HustleGuard AI uses **parametric triggers**, meaning payouts occur automatically when predefined measurable conditions are met.

- No paperwork
- No claim filing
- No delays

## Problem Statement

Gig delivery workers operate in unpredictable environments. External disruptions such as the following can suddenly halt delivery operations:

- heavy rain
- flooding
- extreme heat
- hazardous air quality
- traffic shutdowns
- curfews or strikes

When this happens:

- riders cannot complete deliveries
- platforms lose operational capacity
- workers lose daily income

Traditional insurance products focus on health, life, or vehicle protection, but they do not cover short-term income disruptions caused by environmental conditions.

HustleGuard AI introduces a parametric insurance model specifically designed for gig workers, with fast and automated income protection.

## Target Persona

### Food Delivery Riders (Swiggy / Zomato)

Food delivery riders operate in hyper-local city zones where income depends on:

- number of deliveries completed
- demand in the area
- environmental conditions

Typical rider profile:

| Metric | Value |
| --- | --- |
| Average earnings per delivery | `INR 20-INR 40` |
| Daily deliveries | `15-25` |
| Daily income | `INR 800-INR 1500` |

Disruptions like heavy rain or flooding can reduce order availability by `30-70%`, causing major income loss.

HustleGuard AI protects riders by automatically compensating them when disruptions prevent deliveries.

## Core Idea

HustleGuard AI combines prediction, prevention, and insurance compensation.

The system introduces a **Disruption Intelligence Engine** that continuously analyzes real-world signals and calculates whether delivery work is feasible in a specific zone.

When disruptions occur, the platform automatically triggers insurance payouts.

HustleGuard goes beyond simple payouts. The system also:

- predicts disruptions
- redirects workers to safer zones
- stabilizes income before loss occurs

This creates value for both workers and insurance providers.

## Key Features

### 1. Hyperlocal Disruption Detection

Cities are divided into delivery zones. Each zone is monitored using external signals such as:

- weather conditions
- air quality levels
- traffic congestion
- government alerts
- disaster news

Example:

| Zone | Rainfall |
| --- | --- |
| Koramangala | `92 mm` |
| Indiranagar | `22 mm` |

Only riders operating in affected zones receive payouts.

### 2. Delivery Activity Index (DAI)

HustleGuard introduces a unique metric called the **Delivery Activity Index (DAI)**.

DAI measures how active deliveries are compared to normal conditions:

```text
DAI = Current Delivery Activity / Normal Delivery Activity
```

Delivery activity indicators include:

- orders per hour
- number of active riders
- average delivery time

Example:

| Metric | Normal | Current |
| --- | --- | --- |
| Orders/hour | `120` | `35` |
| Active riders | `50` | `30` |

`DAI = 0.32`

A sharp drop in DAI indicates ecosystem disruption.

### 3. Multi-Signal Disruption Confirmation

To avoid false triggers, HustleGuard confirms disruptions using multiple signals.

Example trigger condition:

```text
Rainfall > 80 mm
AND
Delivery Activity Index < 40%
```

This ensures payouts only occur during real operational disruptions.

### 4. Workability Score

HustleGuard calculates a **Workability Score (0-100)** for each delivery zone.

Factors considered:

- rainfall severity
- air quality index
- traffic congestion
- delivery activity levels
- disaster alerts

| Score | Meaning |
| --- | --- |
| `80-100` | Normal conditions |
| `50-80` | Moderate disruption |
| `0-50` | Work not feasible |

When the score falls below a defined threshold, payouts are triggered.

### 5. Disruption Prediction and Worker Redirection

HustleGuard AI predicts disruptions before they occur.

Example:

- Heavy rain forecast in Zone A
- System recommendation: move to Zone B
- Expected order density: `+25%`

This allows workers to continue earning and reduces insurance claims.

### 6. AI Risk Pricing

Weekly premiums are dynamically calculated based on zone risk.

Factors include:

- historical weather patterns
- flood zone data
- pollution frequency
- past disruptions
- delivery density

Example:

| City | Risk Level | Weekly Premium |
| --- | --- | --- |
| Mumbai | High | `INR 40` |
| Bangalore | Medium | `INR 30` |
| Hyderabad | Low | `INR 20` |

### 7. Worker Reliability Score

HustleGuard builds a financial reliability score for gig workers.

Score range: `0-100`

Factors include:

- delivery consistency
- active hours
- claim behavior
- fraud risk
- operational stability

Benefits:

| Score | Benefit |
| --- | --- |
| High score | lower premiums |
| Medium score | normal pricing |
| Low score | fraud monitoring |

This creates a financial identity for gig workers.

### 8. Automatic Parametric Claims

When disruption conditions are confirmed:

- external event detected
- zone disruption verified
- eligible riders identified
- income loss estimated
- payout triggered automatically

Example:

| Event | Trigger | Payout |
| --- | --- | --- |
| Heavy Rain | `Rain > 80 mm` | `INR 300` |
| Severe Pollution | `AQI > 400` | `INR 200` |
| Government Curfew | `Official Alert` | `INR 500` |

### 9. Fraud Detection Engine

Fraud protection mechanisms include:

- GPS location verification
- zone validation
- duplicate claim detection
- fake disruption filtering

Example:

If a rider claims disruption but the Delivery Activity Index remains normal, the payout is rejected.

## Adversarial Defense & Anti-Spoofing Strategy

## Overview

HustleGuard AI is built for adversarial conditions where coordinated fraud rings attempt to drain liquidity using GPS spoofing.

GPS alone is not trusted. IP alone is also not trusted.

The platform uses a multi-layer decision engine that validates whether a claim is consistent with:

- environmental reality
- zone-level delivery behavior (DAI)
- worker behavior history
- device/session integrity signals
- peer-level coordination patterns

Only claims that are consistent across independent signals move to instant payout.

---

## 1. Differentiation Strategy

### Genuine Worker vs Spoofed Actor

HustleGuard differentiates real disruption from spoofing through contextual consistency.

### A. Environmental Consistency

Claimed zone must align with:

- rainfall severity
- AQI level
- traffic slowdown patterns

Example:

If a worker claims to be stuck in a flooded zone, we expect low traffic speed, reduced DAI, and similar impact across nearby riders.

### B. Behavioral Consistency

Each worker has a profile:

- historical working hours
- zone affinity
- delivery cadence
- claim frequency

Fraud indicators:

- first-time activity in a high-risk zone
- abrupt claim spikes
- patterns inconsistent with historical behavior

### C. Ecosystem Consistency (DAI)

DAI is used as system-level ground truth.

- Normal DAI + individual disruption claim = suspicious
- DAI drop across many independent riders = likely genuine disruption

This blocks isolated spoofed claims.

### D. Motion and Route Consistency

Spoofed GPS usually fails to reproduce realistic movement:

- teleportation between distant zones
- impossible speed changes
- no continuous route history

Example:

```text
Zone A -> Zone B in 2 minutes over 15 km = flagged
```

### E. Peer Correlation

Fraud rings show synchronized patterns:

- same-time claims
- same location clusters
- same movement signatures

Detected through clustering and anomaly detection.

---

## 2. Data Signals Used (Beyond GPS)

### Environmental Data

- rainfall intensity
- AQI
- traffic speed and congestion

### Platform Data

- orders per hour
- active riders
- completion rates
- DAI

### Behavioral Data

- zone history
- working windows
- prior claims and reliability trend

### Device and Session Data

- GPS trace continuity
- velocity consistency
- session duration
- request cadence

### Network and Group Data

- claim-time clustering
- cross-user correlation
- geographic and subnet clustering

---

## 3. IP Geolocation: Useful but Not Sufficient

IP is a supporting signal, not a source of truth.

Why IP alone fails:

- VPN and proxy routing can fake region
- mobile carrier IPs are coarse and unstable
- multiple users can share similar ISP blocks

Where IP helps:

- GPS/IP city mismatch detection
- ring-level subnet clustering analysis
- contradiction scoring when other signals disagree

Policy:

- IP mismatch does not auto-reject
- IP mismatch increases fraud risk score

---

## 4. Device Integrity Signals

HustleGuard includes client integrity checks as probabilistic indicators:

- developer options enabled
- mock location enabled/detected
- rooted/emulator environment indicators
- suspicious app environment patterns

Important constraint:

Advanced attackers can bypass device checks, so these signals never independently reject a claim.

Decision policy:

- single device signal -> soft warning
- multiple independent contradictions -> enforcement action

---

## 5. Fraud Detection Engine (Layered)

### Layer 1: Rules

- impossible movement
- zone mismatch
- duplicate claim attempt

### Layer 2: ML Anomaly Detection

- isolation-based outlier detection for user behavior
- clustering for coordinated group behavior

### Layer 3: Multi-Signal Validation

Disruption is valid only if:

- environmental evidence supports event
- DAI shows zone-level activity degradation
- independent worker population shows similar impact

---

## 6. Fraud Trust Score and Decisioning

Each claim receives a score in [0, 100].

$$
S = w_e E + w_d D + w_b B + w_m M + w_i I + w_p P
$$

Where:

- $E$ = environmental consistency
- $D$ = DAI/zone consistency
- $B$ = behavioral continuity
- $M$ = motion realism
- $I$ = IP/network consistency
- $P$ = peer-coordination risk (inverse trust)

### Concrete Weighted Example (Sample Claim)

| Signal | Symbol | Signal Score (0-100) | Weight | Weighted Contribution |
| --- | --- | --- | --- | --- |
| Environmental consistency | $E$ | 90 | 0.25 | 22.50 |
| DAI/zone consistency | $D$ | 85 | 0.25 | 21.25 |
| Behavioral continuity | $B$ | 70 | 0.15 | 10.50 |
| Motion realism | $M$ | 80 | 0.15 | 12.00 |
| IP/network consistency | $I$ | 60 | 0.10 | 6.00 |
| Peer-coordination safety | $P$ | 95 | 0.10 | 9.50 |
| **Total Trust Score** |  |  | **1.00** | **81.75** |

Interpretation:

- Final score $S = 81.75$
- Decision band: 80-100
- Outcome: instant payout (high confidence)

Low-trust contrast (same weights, suspicious claim):

| Signal | $E$ | $D$ | $B$ | $M$ | $I$ | $P$ | Final $S$ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Suspicious sample scores | 35 | 20 | 40 | 30 | 25 | 15 | **28.50** |

Outcome for contrast case: 0-34 band -> hold or reject pending investigation.

Illustrative thresholds:

- 80-100: instant payout
- 55-79: delayed/provisional payout with passive review
- 35-54: active review and additional evidence request
- 0-34: hold/reject pending investigation

---

## 7. UX Balance: Protect Honest Workers

### Soft Flagging

Flagged claims are reviewed before hard rejection where possible.

### Confidence-Based Workflow

- high confidence: immediate payout
- medium confidence: provisional payout
- low confidence: manual review

### Appeal Path

Workers can submit:

- delivery proof and in-app records
- timestamped photo evidence
- carrier outage context

### False-Positive Guardrails

- network drop tolerance windows
- delayed GPS packet reconciliation
- no punitive downgrade from a single weak signal

---

## 8. Fraud Ring Detection

Ring-level detection uses pattern and graph analysis:

- synchronized timestamps
- repeated movement signatures
- dense correlated user clusters
- subnet/device fingerprint reuse

Example coordinated pattern:

```text
500 users -> same claim window -> same zone -> same signature cluster -> flagged ring
```

---

## 9. Final Decision Logic

Payout is approved when:

- disruption is confirmed via multi-signal validation
- worker context is behaviorally consistent
- fraud risk remains below action threshold

Otherwise:

- claim is flagged or held
- score is updated
- monitoring continues with appeal support

---

## 10. Core Design Principles

- zero-trust for single-source client data
- system-level validation over individual self-report
- behavior plus ecosystem signals over raw coordinates
- fairness-first claim handling with reversible outcomes

## Conclusion

HustleGuard treats the device as untrusted and validates claims through system-wide consistency.

By combining environmental ground truth, DAI, behavior analytics, IP/network checks, and ring-level anomaly detection, the platform can detect coordinated spoofing attacks while protecting genuinely stranded workers from unfair denial.

## System Architecture

```text
External Data Sources
(Weather API | AQI API | Traffic API | News Scraper)
        -> Disruption Detection Engine
        -> Hyperlocal Zone Mapping
        -> Delivery Activity Index Engine
        -> Workability Score Model
        -> AI Risk Pricing Engine
        -> Fraud Detection System
        -> Parametric Insurance Engine
        -> Automatic Payout System
```

## Technology Stack

### Frontend

- Next.js
- React
- Tailwind CSS
- Recharts (analytics dashboards)
- Leaflet / Mapbox (disruption maps)

### Backend

- FastAPI
- Python
- Pydantic
- Uvicorn

### Database

- PostgreSQL
- Optional: PostGIS (geospatial queries)

### AI and Data Processing

- Pandas
- NumPy
- Scikit-learn

Used for:

- risk prediction
- disruption detection
- anomaly detection

## Current Implementation Status

### ✅ Completed (Phase 1-2)

**Backend Architecture**
- Layered structure: routers → services → models → database
- FastAPI with SQLAlchemy ORM
- Neon PostgreSQL connectivity with startup validation
- Full user management CRUD endpoints with schema validation

**ML Pipeline Phase 1 (Baseline)**
- Hyperparameter tuning (RandomizedSearchCV)
- Feature selection across 3 methods
- Threshold optimization (ROC/PR curves)
- Model 1 (DAI Regression): R² = 0.9330, RMSE = 0.0153
- Model 2 (Disruption Classification): 99.80% accuracy

**ML Pipeline Phase 2 (Optimized)**
- Feature engineering: 17 → 38 features (temporal, interaction, zone-level)
- Enriched dataset: 50,000 samples × 38 features
- Model 1: +0.79% improvement (Test R² = 0.9404) ✅
- Model 2: 97.88% accuracy with realistic F1 = 0.9783 (Phase 1 was overfit) ✅
- Phase 2 models tested and ready for production evaluation

**API Endpoints**
- `/api/v1/health` - System health check
- `/api/v1/users` - User CRUD operations
- `/api/ml/predict-disruption` - Two-stage disruption prediction

### Deployed Models

**Model 1: Delivery Activity Index (DAI) Regression**
- **Type**: RandomForestRegressor (n_estimators=250, max_features="log2")
- **Phase 2 Metrics**: CV R² = 0.9402 ± 0.0010, MAE = 0.0336
- **Location**: `backend/ml/models/dai_predictor_phase2.pkl` (recommended)

**Model 2: Disruption Risk Classification**
- **Type**: RandomForestClassifier (n_estimators=250, max_depth=15, balanced class_weight)
- **Phase 2 Metrics**: CV Accuracy = 97.89%, F1-Score = 0.9783
- **Location**: `backend/ml/models/disruption_model_phase2.pkl` (beta testing)

### ML Prediction Endpoint

```
POST /ml/predict-disruption
```

**Request**:
```json
{
  "rainfall": 92,
  "AQI": 110,
  "traffic_speed": 12,
  "current_dai": 0.41,
  "hour_of_day": 14,
  "day_of_week": 3
}
```

**Response**:
```json
{
  "predicted_dai": 0.29,
  "disruption_probability": 0.81,
  "risk_label": "high"
}
```

Risk labels:
- `normal`: probability < 0.3
- `moderate`: 0.3 ≤ probability < 0.5
- `high`: probability ≥ 0.5

### Background Processing

- Redis
- Celery / scheduled workers

Used for:

- monitoring APIs
- recalculating disruption scores
- triggering payouts

### External APIs

- OpenWeatherMap API
- AQI API
- Google Maps Traffic API
- News API
- custom web scraper

### Payments

- Razorpay Sandbox (simulated payouts)

## User Workflow

### 1. Rider Onboarding

- rider registers
- location verified
- risk profile generated

### 2. Insurance Subscription

- weekly plan selected
- premium calculated
- policy activated

### 3. Disruption Monitoring

System continuously monitors:

- weather
- pollution
- delivery activity
- public alerts

### 4. Automatic Payout

When disruption occurs:

- claim triggered automatically
- payout credited instantly

## Dashboard

### Worker Dashboard

Riders can view:

- coverage status
- earnings protected
- payout history
- disruption alerts
- income forecast

### Admin Dashboard

Admins can monitor:

- disruption heatmaps
- claim statistics
- fraud alerts
- risk analytics

### Income Forecast Dashboard

Workers receive an estimated income range for the week.

Example:

```text
Expected Weekly Earnings: INR 5200-INR 6300
Risk Level: Medium
Insurance Coverage: Active
```

This helps riders make better operational decisions.

## Scalability

HustleGuard AI is designed to scale across cities and delivery platforms.

Future expansions:

- integration with delivery platforms
- real-time rider telemetry
- predictive disruption modeling
- gig-economy financial services

## Hackathon Compliance

This project follows all competition rules:

- Covers income loss only
- Uses parametric insurance triggers
- Implements weekly subscription pricing
- Focuses on one persona (food delivery riders)
- Includes AI risk pricing and fraud detection
- Demonstrates automated claims and payouts

## Future Vision

HustleGuard AI can evolve into a full gig-economy financial protection platform, providing insurance, credit scoring, and income stabilization for millions of workers across food delivery, grocery logistics, and e-commerce fulfillment.

The long-term goal is to create financial resilience for gig workers while enabling insurers to manage risk using real-time data intelligence.

## Phase 3+ Roadmap

**Phase 3 (Weeks 6-9)**
- Production data collection
- Automated model retraining pipeline
- SMOTE balancing for imbalanced datasets
- Real-world validation with live platform data

**Future**
- PostGIS spatial queries for zone-based analysis
- Celery/Redis background monitoring
- Admin and worker dashboard completion
- Fraud detection and claim payout workflows
- Geospatial zone heat mapping
- Real-time rider telemetry

## Documentation

- [Architecture Guide](docs/Architecture.md) - System design and component overview
- [ML Pipeline Details](docs/ML_PIPELINE.md) - Model training, phase progression, and metrics
- [Phase 2 Results](docs/Phase2_Results.md) - Detailed feature engineering and performance analysis
- [API Rules](docs/API_Rules.md) - REST conventions and response patterns
- [Coding Rules](docs/Coding_Rules.md) - Code style and conventions
- [Change Log](docs/Changes.md) - Development history and updates
- [Agent Context](docs/Agent_Context.md) - Guidelines for AI tooling
- [AGENTS.md](AGENTS.md) - Comprehensive agent and tech stack documentation
- [Copilot Instructions](.github/copilot-instructions.md) - Copilot behavior customization
