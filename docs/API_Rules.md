# API Rules

This project uses FastAPI to build REST APIs.

## General API Principles
- All endpoints must use REST conventions.
- Endpoints should return JSON responses.
- Use appropriate HTTP status codes.
- Do not expose database models directly in responses.

## Endpoint Structure
- GET → Retrieve data
- POST → Create resources
- PUT/PATCH → Update resources
- DELETE → Remove resources

Example:

GET /users
POST /users
GET /users/{id}
PATCH /users/{id}
DELETE /users/{id}

## Request Validation
- Use Pydantic schemas for request validation.
- Never trust raw input from requests.
- All request bodies must be defined in `schemas`.

Example:
schemas/user_schema.py

## Response Format

Success response:

{
  "success": true,
  "data": {...}
}

Error response:

{
  "success": false,
  "error": "Error message"
}

## Pagination
For list endpoints use:

query params:
- page
- limit

Example:
GET /tasks?page=1&limit=20

## Error Handling
Use FastAPI HTTPException.

Example:

raise HTTPException(
    status_code=404,
    detail="User not found"
)

## Authentication (if added later)
- Use JWT tokens
- Protected routes must use dependency injection

Example:
Depends(get_current_user)

## Versioning
Future APIs should follow versioning:

/api/v1/users
/api/v2/users

## Implemented ML Endpoint

Endpoint:
POST /predict-disruption

Purpose:
- Predict future DAI for a zone
- Predict disruption probability
- Return a qualitative risk label

Required request fields:
- rainfall (float, >= 0)
- AQI (float, >= 0)
- traffic_speed (float, >= 0)
- current_dai (float, 0 to 1)

Optional request fields (defaults applied by backend):
- temperature
- wind_speed
- congestion_index
- orders_last_5min
- orders_last_15min
- active_riders
- average_delivery_time
- hour_of_day
- day_of_week
- historical_disruption_frequency
- zone_risk_score

Response fields:
- predicted_dai (0 to 1)
- disruption_probability (0 to 1)
- risk_label (normal, moderate, high)

Status codes:
- 200 on successful prediction
- 422 on request validation failure

Example request:

{
  "rainfall": 92,
  "AQI": 110,
  "traffic_speed": 12,
  "current_dai": 0.41
}

Example response:

{
  "predicted_dai": 0.29,
  "disruption_probability": 0.81,
  "risk_label": "high"
}