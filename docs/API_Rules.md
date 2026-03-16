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