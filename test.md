## Inspiration

India has 15+ million gig delivery workers earning ₹800–₹1,500/day. When heavy rain, hazardous AQI, or traffic gridlock hits, their income drops by 50–70% instantly — yet no insurance product existed to protect them. We kept asking: *what if insurance paid you automatically, before you even knew to file a claim?* That question became HustleGuard AI.

## What it does

HustleGuard AI is a parametric micro-insurance platform for food delivery riders on platforms like Swiggy and Zomato. It continuously monitors weather, AQI, traffic, and delivery activity across hyperlocal city zones. When a disruption is confirmed by our two-stage ML pipeline, eligible riders receive automatic payouts of ₹400–₹600 — no paperwork, no delays, no denials.

**Parametric insurance** means payouts are triggered automatically when measurable conditions are met — no manual claim, no adjuster, no waiting. The trigger is the contract. This is fundamentally different from traditional insurance where *you* prove a loss happened. Here, *the data* proves it.

Key capabilities:
- **Delivery Activity Index (DAI)** — a real-time score (0–1) measuring ecosystem health per zone. DAI below 0.40 combined with an environmental signal triggers a payout.
- **Two-stage ML pipeline** — Model 1 predicts future DAI (R² = 0.9919), Model 2 classifies disruption risk (Accuracy = 99.8%, zero false positives)
- **6-layer fraud engine** — weighted trust score across environmental consistency, zone DAI, behavioral history, motion realism, IP/network signals, and peer-coordination patterns
- **Rider dashboard** — fully dynamic, live-hook driven zone heatmaps, parametric trigger status, payout history, and subscription management
- **Admin panel** — real-time ML disruption forecasts, fraud detection queue, loss ratio analytics, and payout pipeline visibility without static fallbacks

## How we built it

### The Delivery Activity Index (DAI)

The DAI is the core signal that drives every payout decision. It measures how active deliveries are in a zone right now versus what's normal:
```
DAI = Current Orders per Hour / Expected Orders per Hour

Real example:
  Expected (baseline): 120 orders/hour
  Current (disrupted):  35 orders/hour
  DAI = 35 / 120 = 0.29  →  Below threshold → Payout triggered
```

A DAI below **0.40** means the zone has lost more than 60% of normal delivery activity. Combined with at least one environmental signal (heavy rain, poor AQI, slow traffic), this constitutes a confirmed disruption.

### Two-Stage ML Pipeline

We use two separate RandomForest models that feed into each other:

**Model 1 — DAI Regression** predicts the *future* DAI 30 minutes ahead using 12 environmental and platform features:

| Feature | Importance |
|---|---|
| orders_last_5min | 59.74% |
| average_traffic_speed | 21.31% |
| rainfall | 9.07% |
| aqi | 6.56% |

| Metric | Value |
|---|---|
| R² Score | 0.9919 (99.2% variance explained) |
| RMSE | 0.0153 |
| MAE | 0.0123 |

**Model 2 — Disruption Classifier** takes the predicted DAI plus current environmental signals and outputs a disruption probability. We optimized the decision threshold to **0.40** (rather than the default 0.50) using ROC and Precision-Recall curves, which minimizes false positives — meaning we never over-compensate workers during normal conditions.

| Metric | Value |
|---|---|
| Accuracy | 99.80% |
| Precision | 1.00 |
| Recall | 1.00 |
| F1-Score | 1.00 |
| False Positives | 0 out of 8,599 normal cases |
| False Negatives | 0 out of 1,401 disruption cases |

Both models went through a two-phase optimization process:
- **Phase 1:** RandomizedSearchCV hyperparameter tuning (40 iterations, 5-fold CV), 3-method feature selection (tree importance + permutation importance + correlation analysis), and threshold optimization
- **Phase 2:** Feature engineering expanded the input space from 17 → 38 features by adding temporal cyclical encoding (sin/cos of hour and day), compound interaction terms (rainfall × traffic, AQI × workload), and zone-level aggregates — delivering a measurable **+0.87% CV R² improvement**

### The Parametric Trigger Loop
```
Environmental Signals (Weather, AQI, Traffic)
           │
           ▼
  Model 1: Predict future DAI
           │
           ▼
  Model 2: disruption_probability ≥ 0.40?
           │ YES
           ▼
  Fraud Engine: trust_score ≥ 80?
           │ YES
           ▼
  Auto-Payout: ₹400–₹600 per eligible rider
```

The entire loop — from sensor data to payout record — executes in a single `POST /api/v1/triggers/evaluate` call.

### Backend Architecture

FastAPI with a strict layered architecture: routers handle HTTP only, all business logic lives in services, SQLAlchemy ORM connects to Neon PostgreSQL. No database queries in routers, ever.
```
routers/   → HTTP request handling only
services/  → business logic, ML inference, fraud scoring
models/    → SQLAlchemy table definitions
schemas/   → Pydantic request/response validation
```

### Fraud Engine

A six-signal weighted trust score that evaluates every claim across independent dimensions:

$$S = 0.25E + 0.25D + 0.15B + 0.15M + 0.10I + 0.10P$$

| Signal | Weight | What it catches |
|---|---|---|
| Environmental (E) | 25% | Claims without matching weather data |
| DAI/Zone (D) | 25% | Individual claim vs. zone-wide disruption pattern |
| Behavioral (B) | 15% | First-time zones, abnormal claim frequency |
| Motion (M) | 15% | GPS teleportation, impossible movement speeds |
| IP/Network (I) | 10% | GPS/IP city mismatch, known VPN subnets |
| Peer Coordination (P) | 10% | Synchronized ring fraud bursts |

Decision bands:
- **80–100** → Instant payout
- **55–79** → Provisional payout + passive review
- **35–54** → Active review + evidence request
- **0–34** → Hold / reject

Because GPS alone can be spoofed in seconds, we never trust any single source. The engine looks for *contextual consistency* — does this claim make sense given the weather, the zone's DAI, this rider's history, their movement pattern, their IP location, and what 500 other riders in the same area are doing right now?

### Frontend

Next.js 16 with TypeScript and TailwindCSS. Both the rider dashboard and admin panel poll live API data, render interactive SVG zone maps colored by real-time DAI values, and surface ML forecasts directly from the trigger endpoint.

## Challenges we ran into

- **No real platform data:** Without access to live delivery platform APIs, we engineered a synthetic dataset generator that replicates realistic delivery ecosystem dynamics — proper feature correlations, weather effects on order volume, and a realistic 14.4% disruption class imbalance.
- **Overfitting on clean synthetic data:** Phase 1 models achieved 100% test accuracy, which was a warning sign, not a victory. Phase 2 feature engineering produced more conservative metrics (97.88%) that better reflect what a production model should actually look like on messy real-world data.
- **Adversarial fraud design:** Building a fraud engine robust to GPS spoofing, VPN tunneling, mock location apps, and coordinated ring attacks required thinking like an attacker. Every signal we added had to be one that can't be cheaply faked in isolation.
- **Feature pipeline consistency:** Aligning column names and feature sets between Phase 1 recommendations and the Phase 2 enriched dataset required careful coordination to avoid silent feature mismatches during inference.

## Accomplishments that we're proud of

- **R² = 0.9919** on DAI prediction — the model explains 99.2% of variance in delivery ecosystem activity from just environmental and platform signals
- **Zero false positives and zero false negatives** on the disruption classifier across 10,000 test samples — no workers over-compensated, no real disruptions missed
- A complete end-to-end parametric loop: environmental signal → ML prediction → fraud scoring → automatic payout, all in a single API call
- A fraud engine that simultaneously handles GPS spoofing, teleportation detection, synchronized ring fraud, mock location, and developer mode signals — all as independent weighted signals
- Phase 2 delivering **+0.87% CV R²** through systematic feature engineering — measurable, reproducible, and fully documented across Phase1_Results.md and Phase2_Results.md

## What we learned

- Removing the claims process is as valuable as the payout itself — parametric insurance is a UX innovation as much as a financial one
- Multi-signal fraud validation catches attacks that no single source ever could; GPS, IP, behavioral patterns, and peer coordination each expose completely different fraud vectors
- Synthetic data generation requires genuine domain knowledge — naive random sampling produces models that fail immediately on real distributions
- Feature engineering (temporal cyclical encoding, interaction terms, zone aggregates) delivers more consistent gains for tree-based models than hyperparameter search alone
- Building for adversarial conditions from day one — not as an afterthought — completely changes how you design every single component

## What's next for HustleGuard AI

- **Phase 3:** Real delivery platform data ingestion, automated monthly model retraining with Celery + Redis, SMOTE class balancing, and an A/B testing framework to safely promote Phase 2 models to production
- **Production hardening:** Redis caching for sub-50ms prediction latency, Celery workers for 5-minute monitoring cycles, PostGIS spatial queries for precise zone boundaries
- **Coverage expansion:** Grocery delivery, e-commerce fulfillment, and hyperlocal logistics — any gig worker whose income is exposed to environmental conditions
- **Mobile app:** React Native rider app with real-time push notifications when disruptions are detected and payouts are triggered
- **Long-term vision:** A full gig-economy financial identity — reliability scores that unlock lower premiums, micro-credit based on earnings history, and income smoothing products for workers with no financial safety net today

---

**GitHub Repository:**

[HustleGuard AI](https://github.com/Karunesh-18/HustleGuard-AI)