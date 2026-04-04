# System Flow

This document describes the operational flow of the HustleGuard platform.

## Rider Registration

1. Rider creates account
2. Phone verification completed
3. GPS permission granted
4. Rider location stored in database

## Policy Subscription

1. Rider selects weekly insurance plan
2. Premium calculated based on zone risk
3. Policy activated

## Data Monitoring

Every 5 minutes the monitoring service runs.

Steps:

1. Fetch weather data
2. Fetch AQI data
3. Fetch traffic data
4. Fetch government alerts

## Delivery Activity Calculation

The system calculates Delivery Activity Index.

Example:

Expected Orders: 120/hour  
Current Orders: 35/hour  

DAI = 35 / 120 = 0.29

Low DAI indicates disruption.

## Disruption Detection

Disruptions are confirmed using multiple signals.

Example rule:

Rainfall > 80mm  
AND  
DAI < 40%

When conditions match:

1. Disruption event recorded
2. Zone marked disrupted

## Rider Identification

Eligible riders are identified.

Process:

1. Retrieve rider GPS location
2. Check if rider is inside disrupted zone

SQL example:

```sql
ST_Contains(zone.geom, rider.location)
```

## Fraud Checks

Before issuing payout:

- GPS verification
- duplicate payout check
- rider activity validation

## Automatic Payout

If all checks pass:

1. payout record created
2. rider notified
3. dashboard updated

## Dashboard Update

Frontend polls backend periodically using background hooks (`useLiveData`).

Updates include:

- zone strip and signals
- DAI threshold chart
- disruption alerts (toast notifications)
- ML model disruption forecasts
- rider payout history

## Manual Claim Flow (Distress Panic Button)

If rider cannot work due to disruption:

1. Rider submits a manual distress claim ("I Can't Work") specifying reason.
2. System evaluates claim against 6-layer Fraud Check (Environmental, DAI, Behavioral, IP, Peer, Motion).
3. If trust score >= 80: Instant automatic payout.
4. If trust score between 40-79: Provisional payout or admin review.
5. If trust score < 40: Rejected/Hold.