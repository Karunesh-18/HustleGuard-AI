# Coding Rules

These rules must be followed when generating or modifying code.

## Language
Python 3.11+

## Framework
FastAPI

## Database
Neon PostgreSQL using SQLAlchemy ORM.

## Code Style

### Naming Conventions

Variables:
snake_case

Functions:
snake_case

Classes:
PascalCase

Constants:
UPPER_CASE

Example:

user_service.py
UserCreateSchema
MAX_RETRY_COUNT

## File Organization

routers → API routes
services → business logic
models → database models
schemas → request/response validation

Example:

app/
  routers/
  services/
  models/
  schemas/

## Separation of Concerns

Routers
- Handle HTTP requests
- Call services
- Return responses

Services
- Business logic
- Database queries

Models
- SQLAlchemy table definitions

Schemas
- Request/response validation

Routers must NOT contain database queries.

## Dependency Injection

Database session must be injected using:

Depends(get_db)

Example:

def create_user(user: UserCreate, db: Session = Depends(get_db)):

## Async vs Sync

Prefer async routes when possible.

Example:

async def get_users():

## Logging

Use Python logging module instead of print.

Example:

import logging
logger = logging.getLogger(__name__)

logger.info("User created")

## Comments

Explain why something is done, not what the code does.

Bad:
# increment i

Good:
# retry connection up to max limit

## Security Rules

- Never commit .env files
- Do not hardcode secrets
- Validate user input