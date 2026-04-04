# Claims & Policies — HustleGuard AI

**Status**: ✅ Phase 2 Complete — all 5 claim types, 3 policy tiers, ML premium quoting

---

## Overview

HustleGuard AI implements a 5-type claim system and 3-tier policy structure.
The combination of:

- **Proportional payouts** (no binary trigger-or-nothing)
- **Community human-sensor layer** (5+ riders override API signals)
- **Policy-sensitive trigger thresholds** (more expensive plan = fires earlier)
- **ML-driven premium quoting** (real-time zone risk → personalised price)
- **Waiting period enforcement** (validated on every claim endpoint)

...makes this a genuinely novel micro-insurance design.

---

## Claim Types

### Type 1 — Parametric Auto-Claim

**Zero-touch. System-triggered.**

The disruption detection engine fires automatically when ML probability
and environmental thresholds are both met. No rider action required.

- **Endpoint**: `POST /api/v1/triggers/evaluate`
- **Trust routing**: All auto-claims go through the fraud engine; instant payout if score ≥ 80
- **Claim record**: `claim_type = "parametric_auto"`

---

### Type 2 — Manual Distress Claim (Panic Button)

**One tap. One question.**

Rider taps **"I Can't Work"** and selects:
- 🌧️ Rain | 🚗 Traffic | 🚫 Curfew | ❓ Other

**Waiting period check**: Called before anything else via `check_policy_allows_claim_type()`.
A rider on Basic Shield (7-day wait) who enrolled 5 days ago will be refused with
`"Policy waiting period active — eligible in 2 day(s)."`.

**Trust score routing:**

| Score | Action |
|---|---|
| ≥ 80 | Instant payout (47s UPI estimate) |
| 55–79 | Provisional payout with background review (5 min estimate) |
| 35–54 | Manual review required (no payout yet) |
| < 35 | Hold / reject |

- **Endpoint**: `POST /api/v1/claims/manual-distress`
- **Available to**: All tiers (if past waiting period)

---

### Type 3 — Partial Disruption Claim ⭐

**Prorated payout. No binary trigger.**

When DAI is between **0.40 and 0.55** (grey zone), riders receive a
proportional payout rather than nothing.

**Formula:**
```
normal_dai = zone.baseline_orders_per_hour / 100.0  (zone-derived, not hardcoded 1.0)
Payout = base_payout × (1 − current_dai / normal_dai)
```

**Example** — HSR Layout (baseline 70 orders/hr, so normal_dai = 0.70):
```
₹500 × (1 − 0.50 / 0.70) = ₹500 × 0.286 = ₹143
```

Compare to using hardcoded 1.0:
```
₹500 × (1 − 0.50 / 1.0) = ₹500 × 0.50 = ₹250  ← over-compensates by 74%
```

The caller can provide their own `normal_dai` override. If not provided,
the zone's `baseline_orders_per_hour` is used automatically.

- **Endpoint**: `POST /api/v1/claims/partial-disruption`
- **Available to**: Standard Guard and Premium Armor only

---

### Type 4 — Community Claim (Human Sensor Layer) ⭐

**5+ riders override API sensors.**

If **5+ riders** in the same zone all signal "I Can't Work" within a
10-minute window, the system treats this as ground truth — even when
weather APIs are lagging or AQI sensors are offline.

**Dynamic trust scoring** (more riders = stronger evidence):

| Riders | Trust Score | Decision |
|---|---|---|
| 5–7 | 75 | Provisional payout with review |
| 8–11 | 82 | Instant payout |
| 12+ | 90 | Instant payout (high confidence) |

**Rationale**: 5 GPS-verified riders in the same zone is credible but warrants
review. 8+ is as strong as a solo parametric trigger. 12+ exceeds typical
sensor reliability. Scoring was set based on the Dunbar cluster principle for
small group trust signals.

- **Endpoint**: `POST /api/v1/claims/community`
- **Minimum riders**: 5 in same zone
- **Available to**: Standard Guard and Premium Armor only

---

### Type 5 — Appeal Claim

**Challenge a rejected decision. One tap.**

Rider sees "Challenge This Decision" → submits clarification text.
Admin reviews in a dedicated queue within 4 business hours.

**Appeal windows by tier:**

| Tier | Window |
|---|---|
| Basic Shield | No appeals |
| Standard Guard | 24 hours |
| Premium Armor | 72 hours |

- **Endpoint**: `POST /api/v1/claims/appeal`
- **Fields**: `original_claim_id`, `rider_id`, `clarification_text`
- **Claim status**: `appeal_status = "pending"` → appears in admin fraud queue

---

## Policy Tiers

The key differentiator: **Premium Armor fires earlier, not just pays more.**

| | Basic Shield | Standard Guard | Premium Armor |
|---|---|---|---|
| **Weekly Premium** | ₹20 | ₹32 | ₹45 |
| **ML-quoted premium** | varies | varies | varies |
| **Payout per disruption** | ₹300 | ₹500 | ₹700 |
| **DAI trigger threshold** | < 0.35 | < 0.40 | **< 0.50** |
| **Rainfall trigger** | > 90mm | > 80mm | **> 65mm** |
| **AQI trigger** | > 450 | > 350 | **> 250** |
| **Max claims/week** | 2 | 3 | 5 |
| **Partial disruption claims** | ✗ | ✓ | ✓ |
| **Community claims** | ✗ | ✓ | ✓ |
| **Appeal window** | None | 24 hrs | 72 hrs |
| **Waiting period** | 7 days | 3 days | 0 days |

> **ML quoting**: The weekly premium shown above is the base price.
> `POST /api/v1/policies/quote` returns a risk-adjusted price based on live
> zone conditions. Risk multipliers: Normal=1.0×, Moderate=1.2×, High=1.45×.

---

## Fraud Engine — 6-Layer Trust Score

All claim types route through the same fraud evaluation engine.

| Signal | Weight | What it measures |
|---|---|---|
| Environmental consistency | 25% | Does rainfall/AQI/traffic match a real disruption? |
| DAI-zone consistency | 25% | Does zone DAI confirm the claimed disruption? |
| Behavioral continuity | 15% | Historical zone visits, claim frequency |
| Motion realism | 15% | GPS movement velocity (detects teleportation/mock) |
| IP/network consistency | 10% | GPS city vs IP city, subnet clustering |
| Peer coordination safety | 10% | Synchronized claim burst detection |

Weights are defined in `FRAUD_SIGNAL_WEIGHTS` in `fraud_service.py` — configurable
without changing logic. These are empirical starting points; production data will
allow evidence-based reweighting.

---

## API Reference

### Policy Management

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/policies` | List all 3 active tiers |
| GET | `/api/v1/policies/{name}` | Single tier spec |
| POST | `/api/v1/policies/subscribe` | Enroll rider in a tier |
| GET | `/api/v1/policies/rider/{rider_id}` | Active policy for rider |
| **POST** | **`/api/v1/policies/quote`** | **ML risk-adjusted premium quotes** |

### Claims

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/claims/evaluate-and-create` | Parametric auto-claim |
| POST | `/api/v1/claims/manual-distress` | Panic button (validates waiting period first) |
| POST | `/api/v1/claims/partial-disruption` | Prorated grey-zone claim (zone-derived normal_dai) |
| POST | `/api/v1/claims/community` | 5+ rider community signal (dynamic trust tiers) |
| POST | `/api/v1/claims/appeal` | Challenge rejected claim (per-tier window) |
| GET | `/api/v1/claims/rider/{rider_id}` | All claims for rider |

### Policy-Aware Trigger

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/triggers/evaluate` | Parametric trigger (pass `rider_id` for tier-aware thresholds) |

### Admin (requires PIN auth)

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/admin/refresh-zones` | Manual zone refresh trigger |
| POST | `/api/v1/admin/simulate-disruption` | Force extreme conditions in a zone |
| GET | `/api/v1/admin/zone-status` | All zones with ML risk labels |

---

## Implementation Notes

### Waiting period validation
Every claim endpoint calls `check_policy_allows_claim_type()` before any other
logic. This checks `enrollment.eligible_from` against `datetime.utcnow()`. If
the rider is still in their waiting period, the endpoint returns HTTP 400 with
the number of days remaining. This is applied consistently across all 5 claim
types — no claim type bypasses it.

### Zone-derived normal_dai
The partial disruption formula no longer uses `normal_dai=1.0` as a hardcoded
assumption. The service looks up `zone.baseline_orders_per_hour` and computes
`inferred_normal_dai = min(1.0, baseline / 100.0)`. A zone with 70 baseline
orders/hr has normal_dai=0.70, preventing over-compensation compared to using 1.0.

### Policy seeding
`seed_default_policies()` is idempotent — it only inserts if the tier name doesn't
exist. If policy terms change, the function must also update existing rows. Do not
silently upgrade a rider enrolled in "Standard Guard v1" to "Standard Guard v2"
terms — this requires a migration strategy before production.

### Community trust tiers (configurable)
`COMMUNITY_TRUST_TIERS` in `claim_service.py` is a list of `(min_riders, trust, decision)`
tuples. Adjust the thresholds as real fraud data accumulates, without changing
any business logic.
