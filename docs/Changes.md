# Changes

## 2026-03-11

### Docs normalization and backend layering

- Normalized the `docs/` file naming set by renaming `ARCHITECTURE.md`, `DATABASE_SCHEMA.md`, and `SYSTEM_FLOW.md` to `Architecture.md`, `Database_Schema.md`, and `System_Flow.md`.
- Standardized markdown formatting in the core architecture and flow docs by converting section numbering to consistent headings and wrapping tree, SQL, and flow examples in fenced code blocks.
- Updated `PROJECT_CONTEXT.md` so the documented file names and example project structure match the normalized docs set.
- Started the backend restructuring into `backend/app` with dedicated `database`, `models`, `schemas`, `services`, and `routers` modules.
- Moved the user creation flow into layered modules and kept `backend/main.py` as a thin FastAPI entrypoint.
- Added lightweight compatibility exports in `backend/database.py` and `backend/models.py` so old import paths continue to resolve during the transition.

### AI project guidance files

- Added `AGENTS.md` at the repository root to provide project-wide AI agent guidance based on the documented architecture, API, coding, security, and development rules.
- Added `.github/copilot-instructions.md` so GitHub Copilot can automatically load repository-specific coding and architecture guidance.
- Added `PROJECT_CONTEXT.md` at the repository root to consolidate project purpose, development flow, target structure, and system context for AI tooling.
- Preserved the existing files in `docs/` as the detailed source of truth rather than replacing or removing them.

### Backend database setup and startup fixes

- Fixed the SQLAlchemy import typo in `backend/database.py` by changing `sqlachemy` to `sqlalchemy`.
- Added a guard in `backend/database.py` to fail fast with a clear error when `DATABASE_URL` is missing.
- Updated the SQLAlchemy engine configuration to enable `pool_pre_ping` and apply a short PostgreSQL `connect_timeout`.
- Expanded `backend/requirements.txt` to include the backend dependencies currently used by the project: `sqlalchemy`, `psycopg2-binary`, `pydantic`, `python-dotenv`, `pandas`, `scikit-learn`, and `asyncpg`.

### FastAPI startup behavior

- Moved `Base.metadata.create_all(...)` out of import time and into a FastAPI startup hook in `backend/main.py`.
- Added startup error handling for database initialization using `SQLAlchemyError`.
- Updated the root endpoint to return API status along with `database_ready` and `database_error` fields.
- Added a database availability guard to the `POST /users` endpoint so it returns `503` instead of failing unexpectedly when the database is unavailable.

### Verification completed

- Verified that the backend module imports successfully after the import and startup fixes.
- Verified that the FastAPI server starts successfully with Uvicorn.
- Verified database connectivity with a direct SQLAlchemy `SELECT 1` test.
