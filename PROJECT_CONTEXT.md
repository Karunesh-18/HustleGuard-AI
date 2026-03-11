# Project Context

This project builds a REST API using FastAPI and Neon PostgreSQL.

It supports HustleGuard AI, a parametric insurance platform for gig delivery workers affected by external disruptions.

## Current Workspace Structure

```text
backend/
frontend/
docs/
```

The backend currently contains a small FastAPI application and is expected to evolve toward a layered app structure.

## Recommended Backend Folder Structure

```text
app/
  routers/
  services/
  models/
  schemas/
  database/
```

## Key Rules

- Business logic must live in services
- Routers should only orchestrate requests
- Database queries should not appear in routers
- Use SQLAlchemy ORM for persistence
- Use Pydantic for request and response validation
- Keep secrets in environment variables
- Update documentation when behavior changes

## Development Flow

When adding a feature:

1. Create a Pydantic schema.
2. Add service logic.
3. Add router endpoint.
4. Update documentation.
5. Update `docs/Changes.md`.

## Product and System Context

The documented platform flow is:

1. Rider registration.
2. Policy subscription.
3. Five-minute monitoring cycle for weather, AQI, traffic, and alerts.
4. Delivery Activity Index calculation.
5. Multi-signal disruption detection.
6. Rider eligibility checks by zone.
7. Fraud checks.
8. Automatic payout issuance.
9. Dashboard updates.
10. Manual claims when needed.

The documented long-term architecture includes:
- disruption detection engine
- Delivery Activity Index engine
- risk evaluation engine
- parametric insurance engine
- automatic payout system
- worker and admin dashboards

The documented database schema includes:
- zones
- riders
- orders
- zone baselines
- disruptions
- payouts
- claims

PostGIS is part of the intended schema for spatial operations.

## Recommended Final Project Structure

```text
project-root
|
|-- app/
|   |-- routers/
|   |-- services/
|   |-- models/
|   |-- schemas/
|   `-- database/
|
|-- docs/
|   |-- Agent_Context.md
|   |-- API_Rules.md
|   |-- Architecture.md
|   |-- Changes.md
|   |-- Coding_Rules.md
|   |-- Database_Schema.md
|   `-- System_Flow.md
|
|-- .github/
|   `-- copilot-instructions.md
|
|-- AGENTS.md
|-- PROJECT_CONTEXT.md
|-- Readme.md
`-- requirements.txt
```

## Current State Notes

- The current implementation is earlier than the target architecture described in the docs.
- Keep future backend work moving toward the documented layered structure instead of concentrating logic in a single entrypoint file.
- Existing repo docs in `docs/` remain the source of detailed architecture, API, schema, coding, and change history information.