# API Rules

This project uses FastAPI to build REST APIs.

## General API Principles
- All endpoints must use REST conventions.
- Endpoints should return JSON responses.
- Use appropriate HTTP status codes.
- Do not expose database models directly in responses.
- All routes under `/api/v1/...` for versioning readiness.

## Endpoint Structure
- GET → Retrieve data
- POST → Create resources
- PUT/PATCH → Update resources
- DELETE → Remove resources

## Request Validation
- Use Pydantic schemas for request validation.
- Never trust raw input from requests.
- All request bodies must be defined in `schemas`.

## Response Format

```json
// Success
{"data": {...}}

// Error
{"detail": "Error message"}
```

## Pagination
List endpoints support `skip` and `limit` query params (default `limit=50`, max `200`).

```
GET /api/v1/zones?skip=0&limit=50
GET /api/v1/riders?skip=0&limit=50
```

## Error Handling
Use FastAPI HTTPException.

```python
raise HTTPException(status_code=404, detail="Zone not found")
```

## Authentication
- Admin endpoints: PIN gate in frontend (sessionStorage). For production: JWT via `Depends(get_current_user)`.
- Rider endpoints: rider_id in request body (validated against DB). No session tokens currently.

## Versioning
All new endpoints follow: `/api/v1/{resource}`

---

## ML Prediction Endpoint

**Endpoint:** `POST /ml/predict-disruption`

> The route prefix is `/ml/` — the full path is `/ml/predict-disruption`.

### Required fields
- `rainfall` (float, 0–500 mm)
- `AQI` (float, 0–1000)
- `traffic_speed` (float, 0–200 km/h) — internally mapped to `average_traffic_speed`
- `current_dai` (float, 0.0–1.0)

### Optional fields (backend defaults applied)
- `temperature` (range: -20–60°C, default 30.0)
- `wind_speed` (max 200, default 10.0)
- `orders_last_5min` (default 70.0)
- `hour_of_day` (default: current UTC hour)
- `day_of_week` (default: current UTC weekday)

### Risk label mapping (Phase 2 thresholds)
- `high`: probability ≥ 0.50
- `moderate`: 0.30 ≤ probability < 0.50
- `normal`: probability < 0.30

### Example

```json
// Request
{"rainfall": 92, "AQI": 110, "traffic_speed": 12, "current_dai": 0.41}

// Response
{"predicted_dai": 0.29, "disruption_probability": 0.81, "risk_label": "high"}
```

**Status codes:** `200` success · `422` validation failure · `503` DB unavailable

---

## ML Premium Quoting Endpoint

**Endpoint:** `POST /api/v1/policies/quote`

Returns ML risk-adjusted premiums based on current zone conditions.
The frontend uses this to auto-quote a single plan for the rider — no
plan selection UI is shown.

### Request

```json
{"zone_name": "Koramangala", "reliability_score": 60}
```

### Response

```json
{
  "zone_name": "Koramangala",
  "risk_label": "high",
  "disruption_probability": 0.73,
  "zone_conditions": {
    "rainfall_mm": 45.0,
    "aqi": 280,
    "traffic_index": 85,
    "dai": 0.38
  },
  "plans": [
    {
      "policy_name": "Standard Guard",
      "base_premium_inr": 32,
      "quoted_premium_inr": 46,
      "payout_per_disruption_inr": 500,
      "dai_trigger_threshold": 0.40,
      "max_claims_per_week": 3
    }
  ]
}
```

Risk multipliers: Normal=1.0×, Moderate=1.2×, High=1.45×. Reliability discount: ±₹5.

---

## Admin Endpoints

All under `/api/v1/admin/`. Protected by frontend PIN gate; add JWT for production.

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/admin/refresh-zones` | Trigger immediate zone conditions refresh |
| POST | `/api/v1/admin/simulate-disruption` | Force extreme conditions in one zone |
| GET | `/api/v1/admin/zone-status` | All zones with ML risk labels + conditions |

**Simulate disruption:**
```json
// Request
{"zone_name": "Koramangala"}
```

---

## Policy & Claims Endpoints

Full reference: `docs/Claims_and_Policies.md`

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/policies` | List all tiers |
| POST | `/api/v1/policies/subscribe` | Enroll rider |
| GET | `/api/v1/policies/rider/{id}` | Rider's active policy |
| POST | `/api/v1/triggers/evaluate` | Parametric trigger check |
| POST | `/api/v1/claims/manual-distress` | Panic button claim |
| POST | `/api/v1/claims/partial-disruption` | Grey-zone prorated claim |
| POST | `/api/v1/claims/community` | Community signal batch |
| POST | `/api/v1/claims/appeal` | Challenge rejected claim |
| GET | `/api/v1/claims/rider/{id}` | Rider's claim history |