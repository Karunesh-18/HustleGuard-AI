# Agent Context

This document provides context for AI coding agents working on this repository.

## Project Overview

This is a backend API project built with:

- FastAPI
- SQLAlchemy ORM
- Neon PostgreSQL
- Python 3.11+

The goal is to build a scalable REST API.

## Architecture

The project follows a layered architecture:

routers → services → models → database

Routers handle HTTP requests.
Services contain business logic.
Models represent database tables.

AI agents must respect this architecture.

## Folder Structure

app/
  routers/
  services/
  models/
  schemas/
  core/
  database/

Rules:

- Routers define endpoints
- Services perform DB operations
- Models define tables
- Schemas validate input/output

## Database

Database provider: Neon PostgreSQL

Rules:

- Use SQLAlchemy ORM
- Avoid raw SQL queries unless necessary
- Use migrations for schema changes

## Code Generation Rules for Agents

When generating code:

1. Follow existing project structure
2. Do not introduce new frameworks
3. Use SQLAlchemy ORM
4. Use Pydantic schemas for validation
5. Do not place business logic in routers
6. Reuse existing utilities where possible

## API Guidelines

- Use REST naming conventions
- Return JSON responses
- Use proper HTTP status codes

## Performance Rules

- Avoid unnecessary database queries
- Use pagination for large datasets
- Prefer async routes when appropriate

## Security Rules

- Never expose secrets
- Validate all request input
- Use environment variables for configuration

## When Modifying Code

Before editing:

- Understand existing architecture
- Avoid breaking established patterns
- Update documentation if behavior changes

## When Adding Features

Steps:

1. Create schema
2. Create service logic
3. Add router endpoint
4. Update documentation
5. Update change log