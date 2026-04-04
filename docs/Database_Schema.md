# Database Schema

This document defines the PostgreSQL schema **as implemented** by the SQLAlchemy ORM.
All types here match the actual model definitions — not the original design doc.

Database provider: **Neon PostgreSQL**

Required extensions:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

> [!NOTE]
> All primary keys use `SERIAL INTEGER`, not UUID. An early design used UUIDs but
> the ORM was implemented with integers for simplicity. The zone simulation and ML
> pricing layers reference zones by `zone_name` (string), not by zone ID.

---

## zones

Stores delivery zone metadata and baselines for DAI calculations.

```sql
CREATE TABLE zones (
    id                          SERIAL PRIMARY KEY,
    name                        TEXT NOT NULL,
    city                        TEXT NOT NULL,
    baseline_orders_per_hour    FLOAT NOT NULL DEFAULT 100.0,
    baseline_active_riders      FLOAT NOT NULL DEFAULT 40.0,
    baseline_delivery_time_minutes FLOAT NOT NULL DEFAULT 25.0,
    risk_level                  TEXT NOT NULL DEFAULT 'medium',  -- low | medium | high
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

> `baseline_orders_per_hour` drives the `normal_dai` computation in partial
> disruption claims — a zone averaging 70 orders/hour has a normal DAI of 0.70,
> not 1.0.

---

## riders

Registered delivery workers. Unified table serving both the domain API
and the frontend onboarding flow.

```sql
CREATE TABLE riders (
    id                  SERIAL PRIMARY KEY,
    external_worker_id  TEXT UNIQUE,         -- gig platform worker ID (optional)
    display_name        TEXT,                -- legacy name field
    reputation_tier     TEXT NOT NULL DEFAULT 'silver',
    is_probation        BOOLEAN NOT NULL DEFAULT FALSE,
    reliability_score   FLOAT NOT NULL DEFAULT 50.0,  -- 0-100
    -- Frontend onboarding fields
    name                TEXT,
    email               TEXT,
    city                TEXT,
    home_zone           TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## orders

Simulated delivery activity for DAI computation.

```sql
CREATE TABLE orders (
    id          SERIAL PRIMARY KEY,
    zone_id     INT REFERENCES zones(id),
    rider_id    INT REFERENCES riders(id),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    delivered   BOOLEAN DEFAULT TRUE
);
```

---

## zone_baselines

Legacy table for expected delivery activity per zone. Superseded by the
`baseline_orders_per_hour` column in the `zones` table but retained for
zone-level historical queries.

```sql
CREATE TABLE zone_baselines (
    id                      SERIAL PRIMARY KEY,
    zone_id                 INT REFERENCES zones(id),
    expected_orders_per_hour INT
);
```

---

## disruptions

Detected disruption events — written by the trigger evaluation service.

```sql
CREATE TABLE disruptions (
    id          SERIAL PRIMARY KEY,
    zone_id     INT REFERENCES zones(id),
    event_type  TEXT,
    event_value JSONB,
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    confirmed   BOOLEAN DEFAULT FALSE
);
```

---

## zone_snapshots

Live simulation state per zone — refreshed every 5 minutes by the asyncio
background loop. Used by the ML quoting engine and the admin zone dashboard.

```sql
CREATE TABLE zone_snapshots (
    id               SERIAL PRIMARY KEY,
    zone_name        TEXT NOT NULL UNIQUE,
    rainfall_mm      FLOAT NOT NULL,
    aqi              INT NOT NULL,
    traffic_index    INT NOT NULL,
    dai              FLOAT NOT NULL,
    workability_score INT NOT NULL,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## policies

The three insurance product tiers. Seeded at startup (idempotent).

```sql
CREATE TABLE policies (
    id                          SERIAL PRIMARY KEY,
    name                        TEXT UNIQUE NOT NULL,  -- Basic Shield | Standard Guard | Premium Armor
    weekly_premium_inr          FLOAT NOT NULL,
    payout_per_disruption_inr   FLOAT NOT NULL,
    dai_trigger_threshold       FLOAT NOT NULL,  -- fires when DAI < this value
    rainfall_trigger_mm         FLOAT NOT NULL,
    aqi_trigger_threshold       FLOAT NOT NULL,
    max_claims_per_week         INT NOT NULL,
    supports_partial_disruption BOOLEAN DEFAULT FALSE,
    supports_community_claims   BOOLEAN DEFAULT FALSE,
    appeal_window_hours         INT DEFAULT 0,
    waiting_period_days         INT DEFAULT 7,
    is_active                   BOOLEAN DEFAULT TRUE,
    created_at                  TIMESTAMPTZ DEFAULT NOW()
);
```

> **Policy versioning note**: `seed_default_policies()` is idempotent — it skips
> existing rows. If policy terms change for existing subscribers, a migration is
> needed. Do not silently update terms that active enrollments depend on.

---

## rider_policies

Rider enrollment in a policy tier. `eligible_from` enforces the waiting period.

```sql
CREATE TABLE rider_policies (
    id          SERIAL PRIMARY KEY,
    rider_id    INT REFERENCES riders(id) ON DELETE CASCADE,
    policy_id   INT REFERENCES policies(id),
    policy_name TEXT NOT NULL,
    active      BOOLEAN DEFAULT TRUE,
    eligible_from TIMESTAMPTZ,  -- enrolled_at + waiting_period_days; claims rejected before this
    enrolled_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## claims

All 5 claim types share this table. `claim_type` determines which fields are populated.

```sql
CREATE TABLE claims (
    id          SERIAL PRIMARY KEY,
    rider_id    INT REFERENCES riders(id),
    zone_id     INT REFERENCES zones(id),

    -- Core decision fields
    status      TEXT DEFAULT 'under_review',
    trust_score FLOAT NOT NULL,
    decision    TEXT NOT NULL,
    reasons     TEXT DEFAULT '',
    claim_type  TEXT DEFAULT 'parametric_auto',  -- parametric_auto | manual_distress | partial_disruption | community | appeal

    -- Manual distress (panic button)
    distress_reason TEXT,  -- Rain | Traffic | Curfew | Other

    -- Partial disruption
    base_payout_inr       FLOAT,
    partial_payout_ratio  FLOAT,  -- 0.0–1.0; null = full payout
    current_dai_at_claim  FLOAT,

    -- Community claim
    community_trigger_count INT,

    -- Appeal
    appeal_of_claim_id  INT REFERENCES claims(id),
    appeal_clarification TEXT,
    appeal_status        TEXT,  -- pending | approved | rejected

    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## payouts

Payout records linked to claims. One payout per approved/provisional claim.

```sql
CREATE TABLE payouts (
    id           SERIAL PRIMARY KEY,
    claim_id     INT REFERENCES claims(id),
    amount_inr   FLOAT NOT NULL,
    status       TEXT DEFAULT 'pending',  -- processing | provisional | paid | rejected
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);
```

---

## payout_events

Bulk parametric payout events (zone-level, not rider-level). Written by
the trigger evaluation service when a zone-wide disruption is confirmed.

```sql
CREATE TABLE payout_events (
    id                SERIAL PRIMARY KEY,
    zone_name         TEXT NOT NULL,
    trigger_reason    TEXT NOT NULL,
    payout_amount_inr FLOAT NOT NULL,
    eligible_riders   INT NOT NULL,
    event_time        TIMESTAMPTZ DEFAULT NOW()
);
```

---

## fraud_audit_logs

All fraud evaluation decisions persisted for audit trail and trend analysis.

```sql
CREATE TABLE fraud_audit_logs (
    id             SERIAL PRIMARY KEY,
    rider_id       INT NOT NULL,
    zone_id        INT NOT NULL,
    trust_score    FLOAT NOT NULL,
    decision_band  TEXT NOT NULL,  -- green | yellow | orange | red
    decision       TEXT NOT NULL,
    reasons        TEXT NOT NULL,  -- JSON-encoded list
    evaluated_at   TIMESTAMPTZ DEFAULT NOW()
);
```

---

## subscriptions

Legacy table for early zone-level subscriptions. Superseded by `rider_policies`
but retained for backward compatibility with early API flows.

```sql
CREATE TABLE subscriptions (
    id              SERIAL PRIMARY KEY,
    rider_id        INT REFERENCES riders(id) ON DELETE CASCADE,
    plan_name       TEXT NOT NULL,
    weekly_premium  FLOAT NOT NULL,
    active          BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Useful Spatial Queries

Find riders inside a zone (requires PostGIS):

```sql
SELECT r.id
FROM riders r
JOIN zones z ON ST_Contains(z.geom, r.current_location)
WHERE z.id = 1;
```

Find which zone a GPS point falls in:

```sql
SELECT z.id, z.name
FROM zones z
WHERE ST_Contains(z.geom, ST_SetSRID(ST_Point(:lon, :lat), 4326));
```