"""Zone condition simulation service.

Generates realistic synthetic zone conditions for Bangalore delivery zones.
Used in place of live weather/AQI/traffic API calls until production sensors
are integrated.

Design:
- Each zone has a baseline risk profile (inherent flood/AQI/traffic risk)
- Conditions vary by time-of-day (rush hour, monsoon afternoon, night calm)
- Small random perturbations make each refresh unique
- DAI is then computed by the ML model from the raw conditions
"""

import logging
import math
import random
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.domain import ZoneSnapshot

logger = logging.getLogger(__name__)

# ─── Zone baseline profiles ────────────────────────────────────────────────────
# Encodes Bangalore-specific risk knowledge per zone.
# rainfall_base: typical daily rainfall contribution (mm)
# aqi_base: typical AQI (Bangalore avg is 80–150, industrial zones higher)
# traffic_base: typical traffic index 0–100 (congestion)
# flood_risk: 0.0–1.0 (amplifies rainfall effect on deliverability)

_ZONE_PROFILES: dict[str, dict] = {
    "Koramangala": {
        "rainfall_base": 12.0,
        "aqi_base": 110,
        "traffic_base": 62,
        "flood_risk": 0.75,   # low-lying, notorious for waterlogging
        "lat": 12.935, "lon": 77.624,
    },
    "HSR Layout": {
        "rainfall_base": 9.0,
        "aqi_base": 95,
        "traffic_base": 55,
        "flood_risk": 0.45,
        "lat": 12.914, "lon": 77.641,
    },
    "Indiranagar": {
        "rainfall_base": 7.0,
        "aqi_base": 88,
        "traffic_base": 70,
        "flood_risk": 0.30,   # better drainage, elevated terrain
        "lat": 12.971, "lon": 77.640,
    },
    "Whitefield": {
        "rainfall_base": 6.0,
        "aqi_base": 145,      # industrial proximity
        "traffic_base": 80,   # notorious IT corridor congestion
        "flood_risk": 0.25,
        "lat": 12.970, "lon": 77.750,
    },
    "Electronic City": {
        "rainfall_base": 5.0,
        "aqi_base": 130,
        "traffic_base": 75,   # evening IT shift traffic
        "flood_risk": 0.20,
        "lat": 12.840, "lon": 77.677,
    },
}

# ─── Time-of-day multipliers ───────────────────────────────────────────────────
# Models Bangalore traffic and rainfall patterns by hour (0-23 IST)

def _time_multipliers(hour: int) -> dict[str, float]:
    """Return condition multipliers based on hour of day (IST)."""
    # Rainfall: afternoon monsoon peak (14:00–18:00), light at night
    if 14 <= hour < 18:
        rain_mult = 2.5 + 1.5 * math.sin((hour - 14) * math.pi / 4)
    elif 18 <= hour < 20:
        rain_mult = 1.8
    elif 6 <= hour < 10:
        rain_mult = 0.6  # morning light
    else:
        rain_mult = 0.3  # night calm

    # Traffic: double peaks 8-10am and 6-9pm, dead at night
    if 8 <= hour < 10:
        traffic_mult = 1.8
    elif 18 <= hour < 21:
        traffic_mult = 2.0
    elif 10 <= hour < 18:
        traffic_mult = 1.1
    elif 22 <= hour or hour < 6:
        traffic_mult = 0.25
    else:
        traffic_mult = 0.7

    # AQI: higher traffic = higher AQI with lag
    aqi_mult = 0.7 + 0.6 * traffic_mult

    return {
        "rainfall": rain_mult,
        "traffic": traffic_mult,
        "aqi": min(aqi_mult, 2.0),
    }


def generate_zone_conditions(zone_name: str, hour: int | None = None) -> dict:
    """Generate synthetic but realistic zone conditions for a given hour.

    Returns raw condition fields ready for ZoneSnapshot upsert.
    DAI is NOT set here — it must be computed by the ML model.
    """
    profile = _ZONE_PROFILES.get(zone_name)
    if profile is None:
        # Unknown zone — use medium defaults
        profile = {
            "rainfall_base": 8.0, "aqi_base": 105,
            "traffic_base": 60, "flood_risk": 0.4,
        }

    if hour is None:
        hour = datetime.now(tz=timezone.utc).hour
        # Convert UTC to IST (+05:30)
        hour = (hour + 5) % 24

    mults = _time_multipliers(hour)

    # Raw generated conditions with small random noise (~±15%)
    rainfall = max(0.0, round(
        profile["rainfall_base"] * mults["rainfall"] * random.uniform(0.85, 1.15), 1
    ))
    aqi = max(30, round(
        profile["aqi_base"] * mults["aqi"] * random.uniform(0.9, 1.10)
    ))
    # traffic_index: 0=free flow, 100=gridlock
    traffic_index = min(100, max(0, round(
        profile["traffic_base"] * mults["traffic"] * random.uniform(0.88, 1.12)
    )))

    # Workability score approximate (rough pre-ML composite)
    # Real dai comes from ML model call after this
    estimated_workability = max(0, min(100, round(
        100
        - min(40, rainfall * 0.4 * (1 + profile["flood_risk"]))
        - max(0, (aqi - 100) * 0.05)
        - max(0, (traffic_index - 40) * 0.3)
    )))

    return {
        "zone_name": zone_name,
        "rainfall_mm": rainfall,
        "aqi": aqi,
        "traffic_index": traffic_index,
        "workability_score": estimated_workability,
    }


def refresh_all_zones(db: Session, *, force_disruption_zone: str | None = None) -> list[dict]:
    """Simulate and upsert zone conditions for all known zones.

    If force_disruption_zone is set, that zone gets extreme conditions
    that will almost certainly trigger the ML disruption classifier.
    Used by the admin 'Simulate Disruption' endpoint for demos.
    """
    now = datetime.now(tz=timezone.utc)
    hour_ist = (now.hour + 5) % 24
    results = []

    for zone_name in _ZONE_PROFILES:
        if force_disruption_zone and zone_name == force_disruption_zone:
            # Force extreme conditions: heavy rain + low traffic + bad AQI
            conditions = {
                "zone_name": zone_name,
                "rainfall_mm": round(random.uniform(85.0, 110.0), 1),
                "aqi": random.randint(320, 420),
                "traffic_index": random.randint(5, 15),   # gridlock / road blocked
                "workability_score": random.randint(10, 25),
            }
        else:
            conditions = generate_zone_conditions(zone_name, hour=hour_ist)

        # Compute ML-predicted DAI from the conditions
        try:
            from app.schemas import DisruptionPredictionRequest
            from app.services.ml_service import predict_disruption

            ml_req = DisruptionPredictionRequest(
                rainfall=conditions["rainfall_mm"],
                AQI=float(conditions["aqi"]),
                traffic_speed=float(max(5, 80 - conditions["traffic_index"])),  # inverted: high index = low speed
                current_dai=float(conditions["workability_score"]) / 100.0,
            )
            prediction = predict_disruption(ml_req)
            dai = float(round(prediction.predicted_dai, 3))
        except Exception as exc:
            logger.warning(f"ML prediction failed for zone {zone_name!r}, using workability proxy: {exc}")
            dai = round(conditions["workability_score"] / 100.0, 3)

        conditions["dai"] = dai

        # Upsert ZoneSnapshot
        existing = db.query(ZoneSnapshot).filter_by(zone_name=zone_name).first()
        if existing:
            existing.rainfall_mm = conditions["rainfall_mm"]
            existing.aqi = conditions["aqi"]
            existing.traffic_index = conditions["traffic_index"]
            existing.dai = dai
            existing.workability_score = conditions["workability_score"]
            existing.updated_at = now
        else:
            db.add(ZoneSnapshot(
                zone_name=zone_name,
                rainfall_mm=conditions["rainfall_mm"],
                aqi=conditions["aqi"],
                traffic_index=conditions["traffic_index"],
                dai=dai,
                workability_score=conditions["workability_score"],
                updated_at=now,
            ))

        results.append(conditions)
        logger.debug(
            f"Zone {zone_name!r} | rain={conditions['rainfall_mm']}mm "
            f"AQI={conditions['aqi']} traffic={conditions['traffic_index']} DAI={dai:.3f}"
        )

    try:
        db.commit()
        logger.info(f"Zone snapshots refreshed for {len(results)} zones (IST hour {hour_ist})")
    except Exception as exc:
        db.rollback()
        logger.error(f"Failed to commit zone snapshot refresh: {exc}")

    return results
