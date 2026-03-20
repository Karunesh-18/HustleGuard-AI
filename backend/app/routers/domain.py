from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import RiderCreate, RiderRead, ZoneCreate, ZoneRead
from app.services.domain_service import (
    compute_workability_score,
    create_rider,
    create_zone,
    list_riders,
    list_zones,
)

router = APIRouter(prefix="/api/v1", tags=["domain"])


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