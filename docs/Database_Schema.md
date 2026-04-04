# Database Schema

This document defines the PostgreSQL schema used by HustleGuard AI.

Database provider: Neon PostgreSQL

Required extensions:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

## Zones

Stores delivery zone boundaries.

```sql
CREATE TABLE zones (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    geom GEOMETRY(POLYGON, 4326),
    risk_score FLOAT DEFAULT 0,
    premium_per_week INT DEFAULT 20
);
```

## Riders

Stores registered delivery workers.

```sql
CREATE TABLE riders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    phone TEXT,
    reliability_score FLOAT DEFAULT 50,
    current_location GEOMETRY(POINT,4326),
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Orders

Stores simulated delivery activity.

```sql
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    zone_id INT REFERENCES zones(id),
    rider_id UUID REFERENCES riders(id),
    created_at TIMESTAMP DEFAULT NOW(),
    delivered BOOLEAN DEFAULT TRUE
);
```

## Zone Baselines

Stores expected delivery activity per zone.

```sql
CREATE TABLE zone_baselines (
    id SERIAL PRIMARY KEY,
    zone_id INT REFERENCES zones(id),
    expected_orders_per_hour INT
);
```

## Disruptions

Stores detected disruption events.

```sql
CREATE TABLE disruptions (
    id SERIAL PRIMARY KEY,
    zone_id INT REFERENCES zones(id),
    event_type TEXT,
    event_value JSONB,
    detected_at TIMESTAMP DEFAULT NOW(),
    confirmed BOOLEAN DEFAULT FALSE
);
```

## Payouts

Stores insurance payouts.

```sql
CREATE TABLE payouts (
    id SERIAL PRIMARY KEY,
    rider_id UUID REFERENCES riders(id),
    zone_id INT REFERENCES zones(id),
    amount INT,
    reason TEXT,
    issued_at TIMESTAMP DEFAULT NOW()
);
```

## Claims (All 5 Types)

Stores all claim types: parametric auto, manual distress, partial disruption, community, and appeal.

```sql
CREATE TABLE claims (
    id SERIAL PRIMARY KEY,
    rider_id INT REFERENCES riders(id),
    zone_id INT REFERENCES zones(id),

    -- Core decision fields
    status TEXT DEFAULT 'under_review',
    trust_score FLOAT NOT NULL,
    decision TEXT NOT NULL,
    reasons TEXT DEFAULT '',

    -- Claim type: parametric_auto | manual_distress | partial_disruption | community | appeal
    claim_type TEXT DEFAULT 'parametric_auto',

    -- Manual distress fields
    distress_reason TEXT,                -- Rain | Traffic | Curfew | Other

    -- Partial disruption fields
    base_payout_inr FLOAT,
    partial_payout_ratio FLOAT,          -- 0.0–1.0; null = full payout
    current_dai_at_claim FLOAT,

    -- Community claim fields
    community_trigger_count INT,         -- how many riders triggered

    -- Appeal fields
    appeal_of_claim_id INT REFERENCES claims(id),
    appeal_clarification TEXT,
    appeal_status TEXT,                  -- pending | approved | rejected

    created_at TIMESTAMP DEFAULT NOW()
);
```

## Policies

Stores the three insurance product tiers.  Seeded automatically at startup.

```sql
CREATE TABLE policies (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,           -- Basic Shield | Standard Guard | Premium Armor
    weekly_premium_inr FLOAT NOT NULL,
    payout_per_disruption_inr FLOAT NOT NULL,
    dai_trigger_threshold FLOAT NOT NULL,   -- fires when DAI < this
    rainfall_trigger_mm FLOAT NOT NULL,     -- fires when rain > this
    aqi_trigger_threshold FLOAT NOT NULL,   -- fires when AQI > this
    max_claims_per_week INT NOT NULL,
    supports_partial_disruption BOOLEAN DEFAULT FALSE,
    supports_community_claims BOOLEAN DEFAULT FALSE,
    appeal_window_hours INT DEFAULT 0,
    waiting_period_days INT DEFAULT 7,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Rider Policies (Enrollments)

Links riders to their active policy tier.

```sql
CREATE TABLE rider_policies (
    id SERIAL PRIMARY KEY,
    rider_id INT REFERENCES riders(id) ON DELETE CASCADE,
    policy_id INT REFERENCES policies(id),
    policy_name TEXT NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    eligible_from TIMESTAMP,             -- start + waiting_period_days
    enrolled_at TIMESTAMP DEFAULT NOW()
);
```

## Payouts

Stores insurance payouts triggered by any claim type.

```sql
CREATE TABLE payouts (
    id SERIAL PRIMARY KEY,
    claim_id INT REFERENCES claims(id),
    amount_inr FLOAT NOT NULL,
    status TEXT DEFAULT 'pending',       -- processing | provisional | paid | rejected
    created_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP
);
```

## Useful Spatial Queries

Find riders inside a zone:

```sql
SELECT r.id
FROM riders r
JOIN zones z
ON ST_Contains(z.geom, r.current_location)
WHERE z.id = 1;
```

Find rider zone:

```sql
SELECT z.id
FROM zones z
WHERE ST_Contains(z.geom, ST_SetSRID(ST_Point(lon,lat),4326));
```