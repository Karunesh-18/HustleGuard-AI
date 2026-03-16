from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.domain import (
    PayoutRead,
    RiderOnboardCreate,
    RiderRead,
    SubscriptionCreate,
    SubscriptionRead,
    ZoneLiveData,
)
from app.services.domain_service import (
    create_rider,
    create_subscription,
    get_active_subscription,
    get_recent_payouts,
    get_zone_snapshots,
    seed_default_live_data,
)

router = APIRouter(tags=["hustleguard"])

DB_UNAVAILABLE_MSG = "Database is unavailable."

DbSession = Annotated[Session, Depends(get_db)]


@router.get("/zones/live-data", responses={503: {"description": DB_UNAVAILABLE_MSG}})
def get_live_zone_data(request: Request, db: DbSession) -> list[ZoneLiveData]:
    if not getattr(request.app.state, "database_ready", False):
        raise HTTPException(status_code=503, detail=DB_UNAVAILABLE_MSG)

    seed_default_live_data(db)
    zones = get_zone_snapshots(db)
    return [ZoneLiveData.model_validate(zone) for zone in zones]


@router.get("/payouts/recent", responses={503: {"description": DB_UNAVAILABLE_MSG}})
def get_recent_payout_events(request: Request, db: DbSession) -> list[PayoutRead]:
    if not getattr(request.app.state, "database_ready", False):
        raise HTTPException(status_code=503, detail=DB_UNAVAILABLE_MSG)

    seed_default_live_data(db)
    payouts = get_recent_payouts(db)
    return [PayoutRead.model_validate(payout) for payout in payouts]


@router.post(
    "/riders/onboard",
    status_code=status.HTTP_201_CREATED,
    responses={409: {"description": "A rider with this email already exists."}, 503: {"description": DB_UNAVAILABLE_MSG}},
)
def onboard_rider(
    rider_in: RiderOnboardCreate,
    request: Request,
    db: DbSession,
) -> RiderRead:
    if not getattr(request.app.state, "database_ready", False):
        raise HTTPException(status_code=503, detail=DB_UNAVAILABLE_MSG)

    try:
        rider = create_rider(db, rider_in)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    return RiderRead.model_validate(rider)


@router.post(
    "/subscriptions",
    status_code=status.HTTP_201_CREATED,
    responses={404: {"description": "Rider not found."}, 503: {"description": DB_UNAVAILABLE_MSG}},
)
def subscribe_rider(
    subscription_in: SubscriptionCreate,
    request: Request,
    db: DbSession,
) -> SubscriptionRead:
    if not getattr(request.app.state, "database_ready", False):
        raise HTTPException(status_code=503, detail=DB_UNAVAILABLE_MSG)

    try:
        subscription = create_subscription(db, subscription_in)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return SubscriptionRead.model_validate(subscription)


@router.get(
    "/subscriptions/{rider_id}",
    responses={404: {"description": "No active subscription found for rider."}, 503: {"description": DB_UNAVAILABLE_MSG}},
)
def get_rider_subscription(
    rider_id: int,
    request: Request,
    db: DbSession,
) -> SubscriptionRead:
    if not getattr(request.app.state, "database_ready", False):
        raise HTTPException(status_code=503, detail=DB_UNAVAILABLE_MSG)

    subscription = get_active_subscription(db, rider_id)
    if subscription is None:
        raise HTTPException(status_code=404, detail="No active subscription found for rider.")

    return SubscriptionRead.model_validate(subscription)
