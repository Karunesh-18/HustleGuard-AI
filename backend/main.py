import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import SQLAlchemyError

from app import models as _models
from app import database as app_database
from app.database import Base
from app.routers import claims, domain, fraud, health, ml, users, triggers

logger = logging.getLogger(__name__)


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.database_backend = "unknown"
    try:
        Base.metadata.create_all(bind=app_database.engine)
        app.state.database_ready = True
        app.state.database_error = None
        app.state.database_backend = "primary"
    except SQLAlchemyError as exc:
        primary_error = str(exc)
        try:
            app_database.enable_sqlite_fallback()
            Base.metadata.create_all(bind=app_database.engine)
            app.state.database_ready = True
            app.state.database_error = (
                f"Primary database unavailable. Using SQLite fallback. Primary error: {primary_error}"
            )
            app.state.database_backend = "sqlite-fallback"
        except SQLAlchemyError as fallback_exc:
            app.state.database_ready = False
            app.state.database_error = f"Primary error: {primary_error}; Fallback error: {fallback_exc}"
            app.state.database_backend = "unavailable"

    # Keep cloud startup fast to satisfy platform port-binding checks.
    # On Render we skip startup preload by default and allow first-request lazy load.
    preload_ml = _env_bool("PRELOAD_ML_AT_STARTUP", default=(os.getenv("RENDER") is None))
    if preload_ml:
        try:
            from ml import registry
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, registry._load_or_train)
            logger.info("✓ ML models preloaded at startup")
        except Exception as exc:
            logger.warning(f"ML model preloading failed at startup (will retry on first request): {exc}")
    else:
        logger.info("Skipping ML preload at startup (PRELOAD_ML_AT_STARTUP disabled)")

    yield


app = FastAPI(
    title="HustleGuard AI",
    description="Parametric insurance platform for gig delivery workers.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — origins configurable via CORS_ORIGINS env var for production deployments.
# Defaults to localhost dev origins if env var is not set.
_CORS_ORIGINS_ENV = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://192.168.29.121:3000",
)
_CORS_ORIGINS = [o.strip().rstrip("/") for o in _CORS_ORIGINS_ENV.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    # Support local-network hosts in development and Vercel preview deployments.
    allow_origin_regex=r"(http://192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$)|(https://.*\.vercel\.app$)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(users.router)
app.include_router(ml.router)
app.include_router(fraud.router)
app.include_router(claims.router)
app.include_router(domain.router)
app.include_router(triggers.router)


# ─── Bare /zones/live-data and /payouts/recent aliases ─────────────────────
# The frontend calls these without the /api/v1 prefix
from fastapi import Depends, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas import ZoneLiveDataRead, PayoutEventRead
from app.services.domain_service import get_zone_live_data, get_recent_payouts
from fastapi import HTTPException


@app.get("/zones/live-data", response_model=list[ZoneLiveDataRead], tags=["live"])
async def zones_live_data(request: Request, db: Session = Depends(get_db)) -> list[ZoneLiveDataRead]:
    """Zone snapshot list — called directly by the Next.js frontend."""
    if not getattr(request.app.state, "database_ready", False):
        raise HTTPException(status_code=503, detail="Database is unavailable.")
    return get_zone_live_data(db)


@app.get("/payouts/recent", response_model=list[PayoutEventRead], tags=["live"])
async def payouts_recent(request: Request, db: Session = Depends(get_db)) -> list[PayoutEventRead]:
    """Recent payout events — called directly by the Next.js frontend."""
    if not getattr(request.app.state, "database_ready", False):
        raise HTTPException(status_code=503, detail="Database is unavailable.")
    return get_recent_payouts(db)


# ─── Bare /riders/onboard and /subscriptions aliases ───────────────────────
# The frontend calls these without the /api/v1 prefix
from app.schemas import RiderOnboardCreate, RiderOnboardRead, SubscriptionCreate, SubscriptionRead
from app.services.domain_service import onboard_rider, create_subscription


@app.post("/riders/onboard", response_model=RiderOnboardRead, tags=["live"])
async def riders_onboard(
    payload: RiderOnboardCreate,
    request: Request,
    db: Session = Depends(get_db),
) -> RiderOnboardRead:
    """Rider onboarding alias without /api/v1 prefix."""
    if not getattr(request.app.state, "database_ready", False):
        raise HTTPException(status_code=503, detail="Database is unavailable.")
    try:
        return onboard_rider(db, payload)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/subscriptions", response_model=SubscriptionRead, tags=["live"])
async def subscriptions_create(
    payload: SubscriptionCreate,
    request: Request,
    db: Session = Depends(get_db),
) -> SubscriptionRead:
    """Subscription creation alias without /api/v1 prefix."""
    if not getattr(request.app.state, "database_ready", False):
        raise HTTPException(status_code=503, detail="Database is unavailable.")
    try:
        return create_subscription(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc