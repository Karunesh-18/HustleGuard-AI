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

Frontend polls backend periodically.

Updates include:

- disruption heatmap
- risk map
- rider payouts
- zone status

## Manual Claim Flow

If rider believes payout was missed:

1. submit manual claim
2. admin review
3. approve or reject claim