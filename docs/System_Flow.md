# System Flow

This document describes the operational flow of the HustleGuard platform
as currently implemented.

---

## 1. Rider Registration & Onboarding

```
Rider opens app (/ → client-side redirect)
    │
    ├─ Session found in localStorage → /home (rider dashboard)
    └─ No session → /onboard
           │
           ├─ Step 0: Welcome screen
           ├─ Step 1: Enter name, phone, city, home zone
           ├─ Step 2: OTP verification (demo: any 4 digits)
           ├─ Step 3: ML Premium Quote (auto)
           │     │
           │     ├─ POST /api/v1/policies/quote {zone_name, reliability_score}
           │     ├─ Backend fetches live zone conditions from zone_snapshots
           │     ├─ ML model calculates disruption_probability
           │     ├─ risk_label applied → price multiplier (1.0×/1.2×/1.45×)
           │     └─ Single "HustleGuard Protection" plan shown with ML context
           │
           └─ Step 4: Confirm → POST /riders/onboard + POST /policies/subscribe
                                → rider saved to localStorage → /home
```

---

## 2. Zone Conditions Refresh (Background, every 5 min)

```
asyncio background loop (main.py lifespan)
    │
    ├─ generate_zone_conditions(zone_name) for each zone
    │     Uses time-of-day patterns + zone risk profiles
    │
    ├─ ML Model 1 → predicted_future_dai
    ├─ ML Model 2 → disruption_probability
    │
    └─ Upsert zone_snapshots table
```

Failure: exception logged, no crash, next cycle runs on schedule.

---

## 3. Parametric Disruption Detection

```
POST /api/v1/triggers/evaluate
    │
    ├─ Lookup rider's active policy → tier-specific thresholds
    │     (Premium Armor: DAI < 0.50 vs Basic Shield: DAI < 0.35)
    │
    ├─ Check: rainfall > trigger_mm AND dai < trigger_threshold
    │
    ├─ YES → Fraud engine evaluation (6 signals, configurable weights)
    │           trust_score ≥ 80 → create Disruption + PayoutEvent → instant payout
    │           trust_score 55–79 → provisional payout with review
    │           trust_score < 55 → hold / reject
    │
    └─ NO → No payout; response includes which threshold wasn't met
```

---

## 4. Manual Distress Claim (Panic Button)

```
Rider taps "I Can't Work" → selects reason (Rain/Traffic/Curfew/Other)
    │
POST /api/v1/claims/manual-distress
    │
    ├─ check_policy_allows_claim_type() → validates waiting period
    │     (Basic Shield: 7-day wait, Standard Guard: 3-day, Premium Armor: 0-day)
    │     If within waiting period → 400 returned with days remaining
    │
    ├─ 6-layer fraud evaluation
    ├─ trust_score → instant (47s UPI countdown) or provisional (300s)
    └─ Claim + Payout records created
```

---

## 5. Partial Disruption Claim (Grey Zone)

```
DAI between 0.40–0.55 → not fully disrupted, but earnings are reduced
    │
POST /api/v1/claims/partial-disruption
    │
    ├─ Policy check: Standard Guard or Premium Armor only
    ├─ Lookup zone.baseline_orders_per_hour → compute inferred_normal_dai
    │     (avoids over-compensating zones with naturally lower activity)
    │
    ├─ Payout = base_payout × (1 − current_dai / normal_dai)
    └─ Response includes the full calculation breakdown
```

---

## 6. Community Claim (Human Sensor Layer)

```
5+ riders in same zone signal "I Can't Work" within 10 min
    │
POST /api/v1/claims/community {rider_signals: [...]}
    │
    ├─ Count riders → below COMMUNITY_THRESHOLD=5? → reject
    │
    ├─ Trust score scales with rider count:
    │     5–7 riders  → trust=75 → provisional payout with review
    │     8–11 riders → trust=82 → instant payout
    │     12+ riders  → trust=90 → instant payout
    │
    └─ Individual Claim + Payout created for each eligible rider
```

Community claims can fire even when weather APIs are lagging or sensors are offline.

---

## 7. Appeal Flow

```
Rider sees rejected claim → "Challenge This Decision"
    │
POST /api/v1/claims/appeal
    │
    ├─ Validate original claim was rejected (not already paid)
    ├─ Check appeal window by policy tier:
    │     Basic Shield   → no appeals
    │     Standard Guard → 24h window
    │     Premium Armor  → 72h window
    │
    ├─ Window expired? → 400 returned
    └─ Appeal claim created with status=pending → appears in admin queue
```

---

## 8. Admin Workflow

```
Admin navigates to /admin → PIN authentication (sessionStorage)
    │
    ├─ Overview: active zones, ML risk labels, recent payouts
    ├─ Zones: zone_snapshots table + "Simulate Disruption" button
    │     POST /api/v1/admin/simulate-disruption → forces extreme conditions
    │     POST /api/v1/admin/refresh-zones → immediate background trigger
    │
    ├─ Claims & Fraud: fraud_audit_logs + claim table
    └─ ML Models: model metrics, live prediction input sliders
```

---

## 9. Dashboard Live Updates

Frontend polls backend every 10–30 seconds via `useLiveData` hook:

- `/zones/live-data` → zone signals update
- `/payouts/recent` → payout feed updates
- Disruption toast notifications fire when DAI drops below threshold