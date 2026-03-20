from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import SQLAlchemyError

from app import models as _models
from app.database import Base, engine
from app.routers import claims, domain, fraud, health, ml, users, triggers


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        Base.metadata.create_all(bind=engine)
        app.state.database_ready = True
        app.state.database_error = None
    except SQLAlchemyError as exc:
        app.state.database_ready = False
        app.state.database_error = str(exc)

    yield


app = FastAPI(
    title="HustleGuard AI",
    description="Parametric insurance platform for gig delivery workers.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow Next.js dev server and any deployed frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
    ],
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