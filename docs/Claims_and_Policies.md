# Claims & Policies — HustleGuard AI

**Date**: 2026-04-04  
**Status**: ✅ Phase 2 Complete

---

## Overview

HustleGuard AI implements a 5-type claim system and 3-tier policy structure that is genuinely novel in the micro-insurance space.  The combination of:

- **Proportional payouts** (no binary trigger-or-nothing)
- **Community human-sensor layer** (5+ riders override API signals)
- **Policy-sensitive trigger thresholds** (more expensive plan = fires earlier)

...makes this the first gig-delivery insurance product to do all three simultaneously.

---

## Claim Types

### Type 1 — Parametric Auto-Claim
**Zero-touch. System-triggered.**

The disruption detection engine fires automatically when ML probability + threshold conditions are met.  No rider action required.  The rider sees a push notification with a UPI-style countdown ("Payout processing in 47 seconds").

- **Endpoints**: `POST /api/v1/triggers/evaluate` (existing)
- **Trust routing**: All auto-claims go through fraud engine; instant payout if score ≥ 80

---

### Type 2 — Manual Distress Claim (Panic Button)
**One tap. One question.**

UX: Rider taps **"I Can't Work"** button → picks one reason:
- 🌧️ Rain
- 🚗 Traffic
- 🚫 Curfew
- ❓ Other

The fraud engine auto-validates using:
- GPS city vs IP city consistency
- Zone DAI (is disruption real?)
- Peer claim correlation
- Motion velocity analysis

**Trust score routing:**
| Score | Action |
|---|---|
| ≥ 80 | Instant payout (47s estimate) |
| 55–79 | Provisional payout with background review |
| 35–54 | Manual review, no payout yet |
| < 35 | Hold/reject |

- **Endpoint**: `POST /api/v1/claims/manual-distress`
- **Available to**: All tiers (if past waiting period)

---

### Type 3 — Partial Disruption Claim ⭐ (Most novel)
**Prorated payout. No binary trigger.**

When DAI is between **0.40 and 0.55** (grey zone — not fully disrupted, but earnings are reduced), riders receive a proportional payout rather than nothing.

**Formula:**
```
Payout = Base Payout × (1 − current_DAI / normal_DAI)
```

**Example (Standard Guard, DAI = 0.45):**
```
₹500 × (1 − 0.45 / 1.0) = ₹500 × 0.55 = ₹275
```

The API response includes the full calculation breakdown so the rider sees exactly why they received that amount.

- **Endpoint**: `POST /api/v1/claims/partial-disruption`
- **Available to**: Standard Guard and Premium Armor only

---

### Type 4 — Community Claim (Human Sensor Layer) ⭐ (Most unique)
**5+ riders override API sensors.**

If **5 or more riders** in the same zone all signal "I Can't Work" within a **10-minute window**, the system treats it as ground truth — **even if weather APIs are lagging or AQI sensors are offline**.

This is the *human sensor layer*: riders validate each other.  No other parametric insurance product uses crowdsourced human signals as a trigger source.

**Logic:**
1. Frontend batches rider signals when ≥ 5 have triggered in a zone
2. `POST /api/v1/claims/community` receives the batch
3. System validates each rider's policy allows community claims
4. Creates individual Claim + Payout records for each eligible rider
5. Provisional payout (trust score = 75) with background review

- **Endpoint**: `POST /api/v1/claims/community`
- **Minimum riders**: 5 in same zone
- **Available to**: Standard Guard and Premium Armor only

---

### Type 5 — Appeal Claim
**Challenge a rejected decision. One tap.**

If a claim is rejected, the rider sees "Challenge This Decision".  The system shows the rejection reason and asks for one clarification.  An admin reviews flagged appeals in a dedicated queue.

**Appeal windows by policy tier:**
| Tier | Window |
|---|---|
| Basic Shield | No appeals |
| Standard Guard | 24 hours |
| Premium Armor | 72 hours |

- **Endpoint**: `POST /api/v1/claims/appeal`
- **Fields**: `original_claim_id`, `rider_id`, `clarification_text`
- **Admin ETA**: 4 business hours

---

## Policy Tiers

The key differentiator: **Premium Armor fires earlier, not just pays more**.

| | Basic Shield | Standard Guard | Premium Armor |
|---|---|---|---|
| **Weekly Premium** | ₹20 | ₹32 | ₹45 |
| **Payout per disruption** | ₹300 | ₹500 | ₹700 |
| **DAI trigger threshold** | < 0.35 | < 0.40 | **< 0.50** |
| **Rainfall trigger** | > 90mm | > 80mm | **> 65mm** |
| **AQI trigger** | > 450 | > 350 | **> 250** |
| **Max claims/week** | 2 | 3 | 5 |
| **Partial disruption claims** | ✗ | ✓ | ✓ |
| **Community claims** | ✗ | ✓ | ✓ |
| **Appeal window** | None | 24 hrs | 72 hrs |
| **Waiting period** | 7 days | 3 days | 0 days |

### Trigger Sensitivity Comparison

```
DAI 0.35          DAI 0.40               DAI 0.50
  |                  |                      |
  [Basic]----[Standard]----------[Premium]---→ (fires earlier)
```

Premium Armor fires at DAI < 0.50, meaning it protects riders from moderate disruptions that Basic Shield (DAI < 0.35) completely ignores.

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

---

## API Reference

### Policy Management

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/policies` | List all 3 active tiers |
| GET | `/api/v1/policies/{name}` | Single tier spec |
| POST | `/api/v1/policies/subscribe` | Enroll rider in a tier |
| GET | `/api/v1/policies/rider/{rider_id}` | Active policy for rider |

### Claims

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/claims/evaluate-and-create` | Parametric auto-claim |
| POST | `/api/v1/claims/manual-distress` | Panic button claim |
| POST | `/api/v1/claims/partial-disruption` | Prorated grey-zone claim |
| POST | `/api/v1/claims/community` | 5+ rider community signal |
| POST | `/api/v1/claims/appeal` | Challenge rejected claim |
| GET | `/api/v1/claims/rider/{rider_id}` | All claims for rider |

### Policy-Aware Trigger

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/triggers/evaluate` | Parametric trigger (pass `rider_id` for tier-aware thresholds) |

---

## Implementation Notes

### Why seed at startup?
The 3 policy tiers are seeded into the database at every startup via `policy_service.seed_default_policies()`.  This is idempotent — it only inserts if the tier doesn't already exist, and updates fields if the spec changes.  No manual migration step required.

### Why is community claim trust score 75?
Community claims default to a provisional trust score of 75 (yellow band = provisional payout with review).  This ensures human signals are acted on quickly while allowing background audit.  High-tier riders with strong historical scores may be promoted to instant payout in a future phase.

### Partial payout DAI range
The partial disruption claim requires DAI between 0.40 and 0.55.  For DAI below 0.40, the parametric auto-claim fires instead (full payout).  For DAI above 0.55, conditions are not disrupted enough to trigger any claim.
