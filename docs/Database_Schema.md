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

## Claims (Manual)

Stores manual claim submissions.

```sql
CREATE TABLE claims (
    id SERIAL PRIMARY KEY,
    rider_id UUID REFERENCES riders(id),
    zone_id INT,
    description TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
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