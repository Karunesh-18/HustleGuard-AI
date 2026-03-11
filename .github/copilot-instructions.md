# Copilot Instructions

This repository is a FastAPI backend project with a Next.js frontend.

## Code Generation Guidelines

When generating code:

- Follow the existing project structure
- Move the backend toward a layered structure of routers, services, models, schemas, and database utilities
- Use FastAPI routers for API endpoints
- Use SQLAlchemy ORM for database access
- Use Pydantic models for request and response validation
- Update docs when behavior or architecture changes

## Architecture Rules

Routers:
- Handle HTTP requests
- Call service functions
- Translate service results into HTTP responses

Services:
- Handle business logic
- Perform database operations
- Keep disruption, payout, and fraud logic out of routers

Models:
- Define database tables
- Stay focused on persistence structure

Schemas:
- Validate API requests and responses
- Prevent raw request parsing inside routes

Do not place business logic inside routers.

## Database

Database provider: Neon PostgreSQL.

Connection rules:
- Use SQLAlchemy
- Use the existing database session dependency
- Avoid creating new database engines
- Use environment variables for connection settings
- Prefer migrations over ad hoc schema drift as the schema expands

The documented long-term schema includes zones, riders, orders, zone baselines, disruptions, payouts, and claims, with planned PostGIS support.

## API and Response Rules

- Follow REST conventions
- Use proper HTTP status codes
- Return JSON responses
- Validate all request data with Pydantic schemas
- Avoid exposing ORM models directly in API responses
- Use pagination for list endpoints when relevant

## Style

- Prefer async routes when possible
- Keep functions small and readable
- Reuse existing utilities
- Use logging instead of print
- Keep comments focused on why, not what

## Domain Context

This platform is intended to monitor environmental and operational signals such as weather, AQI, traffic, and alerts, compute delivery disruption metrics such as DAI, and support automated insurance payouts for gig workers.