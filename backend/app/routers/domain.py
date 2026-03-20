from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import (
    RiderCreate,
    RiderRead,
    RiderOnboardCreate,
    RiderOnboardRead,
    SubscriptionCreate,
    SubscriptionRead,
    ZoneCreate,
    ZoneRead,
    ZoneLiveDataRead,
    PayoutEventRead,
    PremiumCalculateRequest,
    PremiumCalculateResponse,
)
from app.services.domain_service import (
    compute_workability_score,
    create_rider,
    create_zone,
    get_recent_payouts,
    get_zone_live_data,
    list_riders,
    list_zones,
    onboard_rider,
    create_subscription,
)
from app.services.premium_service import calculate_weekly_premium

router = APIRouter(prefix="/api/v1", tags=["domain"])


# ─── Zone endpoints ───────────────────────────────────────────────────────────

@router.post("/zones", response_model=ZoneRead)
async def create_zone_endpoint(zone_in: ZoneCreate, request: Request, db: Session = Depends(get_db)) -> ZoneRead:
    if not getattr(request.app.state, "database_ready", False):
        raise HTTPException(status_code=503, detail="Database is unavailable.")
    zone = create_zone(db, zone_in)
    return ZoneRead.model_validate(zone)


@router.get("/zones", response_model=list[ZoneRead])
async def list_zones_endpoint(request: Request, db: Session = Depends(get_db)) -> list[ZoneRead]:
    if not getattr(request.app.state, "database_ready", False):
        raise HTTPException(status_code=503, detail="Database is unavailable.")
    return [ZoneRead.model_validate(z) for z in list_zones(db)]


@router.get("/zones/workability")
async def zone_workability(
    rainfall: float = Query(ge=0),
    aqi: float = Query(alias="AQI", ge=0),
    traffic_speed: float = Query(ge=0),
    zone_dai: float = Query(ge=0, le=1),
) -> dict[str, float | str]:
    score = compute_workability_score(rainfall=rainfall, aqi=aqi, traffic_speed=traffic_speed, zone_dai=zone_dai)
    if score < 50:
        label = "work_not_feasible"
    elif score < 80:
        label = "moderate_disruption"
    else:
        label = "normal_conditions"
    return {"workability_score": score, "label": label}


# ─── Rider endpoints ──────────────────────────────────────────────────────────

@router.post("/riders", response_model=RiderRead)
async def create_rider_endpoint(rider_in: RiderCreate, request: Request, db: Session = Depends(get_db)) -> RiderRead:
    if not getattr(request.app.state, "database_ready", False):
        raise HTTPException(status_code=503, detail="Database is unavailable.")
    rider = create_rider(db, rider_in)
    return RiderRead.model_validate(rider)


@router.get("/riders", response_model=list[RiderRead])
async def list_riders_endpoint(request: Request, db: Session = Depends(get_db)) -> list[RiderRead]:
    if not getattr(request.app.state, "database_ready", False):
        raise HTTPException(status_code=503, detail="Database is unavailable.")
    return [RiderRead.model_validate(r) for r in list_riders(db)]


# ─── Rider onboard (frontend-compatible alias) ────────────────────────────────

@router.post("/riders/onboard", response_model=RiderOnboardRead)
async def onboard_rider_endpoint(
    payload: RiderOnboardCreate,
    request: Request,
    db: Session = Depends(get_db),
) -> RiderOnboardRead:
    """Create a rider using the frontend schema (name/email/city/home_zone)."""
    if not getattr(request.app.state, "database_ready", False):
        raise HTTPException(status_code=503, detail="Database is unavailable.")
    try:
        return onboard_rider(db, payload)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# ─── Subscription endpoint ────────────────────────────────────────────────────

@router.post("/subscriptions", response_model=SubscriptionRead)
async def create_subscription_endpoint(
    payload: SubscriptionCreate,
    request: Request,
    db: Session = Depends(get_db),
) -> SubscriptionRead:
    """Activate an insurance subscription for a rider."""
    if not getattr(request.app.state, "database_ready", False):
        raise HTTPException(status_code=503, detail="Database is unavailable.")
    try:
        return create_subscription(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


# ─── Premium calculation endpoint ─────────────────────────────────────────────

@router.post("/premium/calculate", response_model=PremiumCalculateResponse)
async def calculate_premium_endpoint(payload: PremiumCalculateRequest) -> PremiumCalculateResponse:
    """Calculate weekly premium and coverage based on zone risk and rider reliability."""
    return calculate_weekly_premium(payload)