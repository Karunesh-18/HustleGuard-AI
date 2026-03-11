# AI Agent Guidelines

This repository contains a FastAPI backend using Neon PostgreSQL.

## Tech Stack
- Python 3.11+
- FastAPI
- SQLAlchemy ORM
- Neon PostgreSQL
- Next.js (TypeScript) frontend
- Celery and Redis for planned background monitoring

## Architecture

The project follows a layered architecture:

routers -> services -> models -> database

Rules:
- Routers define API endpoints
- Services contain business logic
- Models define SQLAlchemy tables
- Schemas handle request/response validation
- Update documentation when behavior changes
- Update the change log when features or behavior change

Routers must NOT contain database queries.

## Project Domain

HustleGuard AI is a parametric insurance platform for gig delivery workers.

Core platform concerns:
- weather disruption monitoring
- AQI and pollution risk monitoring
- traffic disruption monitoring
- government alert ingestion
- Delivery Activity Index (DAI) calculation
- disruption confirmation and payout triggering
- fraud checks and rider eligibility validation

The system is designed to support worker dashboards, admin dashboards, and automatic payouts when measurable disruption thresholds are met.

## Database

Database provider: Neon PostgreSQL

Rules:
- Use SQLAlchemy ORM
- Avoid raw SQL queries unless necessary
- Always use the shared DB session dependency
- Use environment variables for configuration
- Prefer migrations for schema changes as the project matures

Target schema concepts documented in the repo include:
- zones
- riders
- orders
- zone baselines
- disruptions
- payouts
- claims

PostGIS support is part of the intended database design for spatial queries.

## API Rules

- Follow REST conventions
- Use proper HTTP status codes
- Return JSON responses
- Always validate request data with Pydantic schemas
- Do not expose raw database models directly in responses
- Keep future API versioning readiness under `/api/v1/...`
- Use pagination for list endpoints where relevant

## Coding Conventions

Naming:
- snake_case for variables and functions
- PascalCase for classes
- UPPER_CASE for constants

Implementation rules:
- Keep functions small and readable
- Reuse existing utilities when possible
- Prefer async routes when practical
- Use logging instead of print statements
- Explain why in comments, not what

## Security

- Never commit secrets
- Use environment variables
- Validate all inputs
- Never expose secrets in code or logs

## Development Flow

When adding a feature:

1. Create a Pydantic schema.
2. Add service logic.
3. Add or update the router endpoint.
4. Update documentation.
5. Update `docs/Changes.md`.

## Current Backend Notes

- The current backend is still early-stage and not yet fully reorganized into the target layered structure.
- Database startup currently creates tables during FastAPI startup and reports DB readiness on the root endpoint.
- Keep future work aligned with the documented architecture rather than expanding all logic directly in `backend/main.py`.