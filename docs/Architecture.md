# Architecture

HustleGuard AI is a parametric insurance platform protecting gig delivery workers
from income loss caused by measurable external disruptions.

---

## Core Idea

Traditional insurance requires manual claims. HustleGuard uses **parametric triggers** —
pre-defined measurable thresholds that fire automatically:

```
Rainfall > 80mm  AND  DAI < 40%  →  payout triggered automatically
```

This enables instant settlement, transparent rules, and ML-driven fraud detection.

---

## Technology Stack

### Frontend
- **Next.js 15** (TypeScript, App Router, `output: 'export'` for Capacitor)  
- Vanilla CSS custom design system (`globals.css`)
- **Capacitor** for Android APK wrapping
- Route-based architecture: mobile shell for riders, sidebar for admin

### Backend
- **FastAPI** (Python 3.11+)
- **asyncio** background loop for zone monitoring (no Celery/Redis — in-process)
- SQLAlchemy ORM (async-compatible)
- Pydantic v2 for schema validation

### Database
- **Neon PostgreSQL** (serverless, connection pooling via pgbouncer)
- PostGIS extension for future spatial queries
- SQLAlchemy `pool_pre_ping` enabled to handle idle connections

### ML Pipeline
- scikit-learn RandomForest (Phase 2 models)
- Models pre-loaded at startup via `asyncio.get_event_loop().run_in_executor()`
- Feature contracts enforced via `backend/ml/feature_contracts.py`

---

## System Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                        Zone Simulation Engine                   │
│        Bangalore zone risk profiles + time-of-day patterns      │
│        Refreshes every 5 min via asyncio background loop        │
└──────────────────────────┬─────────────────────────────────────┘
                           │ zone conditions (rainfall, AQI, traffic)
                           ▼
┌────────────────────────────────────────────────────────────────┐
│                     ML Prediction Pipeline                      │
│  Model 1: RandomForestRegressor → predicted_dai (0.0–1.0)     │
│  Model 2: RandomForestClassifier → disruption_probability      │
│  Feature contracts: ml/feature_contracts.py                     │
└──────────────────────────┬─────────────────────────────────────┘
                           │ risk_label + disruption_probability
                           ▼
┌────────────────────────────────────────────────────────────────┐
│                    Insurance Decision Engine                    │
│                                                                 │
│  ┌─────────────────────┐   ┌───────────────────────────────┐  │
│  │   Parametric Trigger │   │      ML Premium Quoting       │  │
│  │  POST /triggers/eval │   │  POST /api/v1/policies/quote  │  │
│  └──────────┬──────────┘   └──────────────┬────────────────┘  │
│             │                              │                    │
│             ▼                              ▼                    │
│  ┌─────────────────────┐   ┌───────────────────────────────┐  │
│  │    Fraud Engine      │   │    Risk Multiplier (1.0×–1.45×)│  │
│  │  6-layer trust score │   │    + Reliability discount      │  │
│  └──────────┬──────────┘   └──────────────────────────────┘  │
│             │                                                   │
│             ▼                                                   │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              Payout Decision (trust score bands)         │  │
│  │  ≥80 → instant   55–79 → provisional   <35 → hold       │  │
│  └─────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │     Neon PostgreSQL     │
              │ zones, riders, claims,  │
              │ payouts, rider_policies │
              └────────────────────────┘
                           │
                           ▼
         ┌─────────────────────────────────┐
         │        Next.js Frontend          │
         │  Rider: mobile app (bottom nav)  │
         │  Admin: sidebar dashboard        │
         └─────────────────────────────────┘
```

---

## Backend Layer Architecture

```
routers → services → models → database
```

| Layer | Responsibility |
|---|---|
| **Routers** | HTTP endpoints only — no DB queries |
| **Services** | Business logic, fraud evaluation, ML calls |
| **Models** | SQLAlchemy table definitions |
| **Schemas** | Pydantic request/response validation |

---

## Background Monitoring (asyncio)

The zone refresh loop runs inside the FastAPI `lifespan` context:

```python
async def _zone_refresh_loop():
    while True:
        await asyncio.sleep(ZONE_REFRESH_INTERVAL_SECONDS)
        await refresh_all_zones(db_session)   # re-generates conditions, re-scores DAI
```

**Failure handling**: The loop catches all exceptions and logs them — a single
bad refresh cycle does not kill the web process. The next cycle runs on schedule.
No payouts are triggered by this loop; it only updates `zone_snapshots`.

`ZONE_REFRESH_INTERVAL_SECONDS` defaults to `300` (5 min), configurable via env.

---

## Zone Simulation Engine

`backend/app/services/zone_simulation_service.py` generates synthetic but
realistic Bangalore zone conditions for each named delivery zone:

- **Zone risk profiles**: Koramangala (flood-prone), Whitefield (AQI/traffic),
  Indiranagar (calm), HSR Layout (moderate), Electronic City (mixed)
- **Time-of-day patterns**: Afternoon monsoon peaks, rush-hour gridlock, night calm
- **ML integration**: Each zone's conditions feed the disruption classifier to
  derive a live DAI estimate

**Admin override**: `POST /api/v1/admin/simulate-disruption` forces extreme
conditions in a specific zone for live demo purposes.

---

## ML Premium Quoting Flow

```
Rider selects Home Zone
        │
POST /api/v1/policies/quote
        │
fetch zone_snapshot for zone
        │
ML Model 2 → disruption_probability
        │
risk_label: normal|moderate|high
        │
price multiplier: 1.0× | 1.2× | 1.45×
        │
reliability_score discount (±₹5)
        │
return quoted premiums for all tiers
        │
frontend shows single auto-selected plan
  with ML conditions (rain/AQI/DAI) visible
```

---

## Frontend Architecture

### Rider App (Mobile-first)
- `(app)/layout.tsx` wraps pages with mobile chrome (status bar, bottom nav)
- 4 pages: `/home` | `/alerts` | `/claims` | `/profile`
- Onboarding wizard at `/onboard` (separate, no shell)

### Admin Dashboard (Desktop-first)
- `admin/layout.tsx` provides sidebar navigation + PIN auth gate
- 4 sections: Overview | Zones | Claims & Fraud | ML Models
- PIN stored in `sessionStorage` — cleared on browser close

---

## Deployment

| Component | Platform |
|---|---|
| Frontend | Vercel (`output: 'export'`) |
| Android | Capacitor + `out/` directory |
| Backend | Render (FastAPI via Uvicorn) |
| Database | Neon PostgreSQL |
| Background jobs | asyncio (in-process, no external queue) |

---

## Design Principles

- **Automation-first** — zero rider effort for parametric payouts
- **Multi-signal disruption detection** — ML + environmental + community signals
- **Hyperlocal risk modeling** — zone-level pricing, not city-level
- **Transparent triggers** — riders see exactly why a payout fired or didn't