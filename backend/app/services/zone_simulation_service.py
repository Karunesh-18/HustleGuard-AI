"""Zone condition service — real API data with simulation fallback.

Priority order per zone per refresh cycle:
  1. Fetch from real APIs (OWM/WeatherAPI, AQICN, Google Maps) concurrently
  2. Fill any missing field from the time-of-day simulation
  3. Run ML model to compute DAI
  4. Upsert ZoneSnapshot with data_source flag: "real" | "simulated"

Design:
  - Each zone has a baseline risk profile (inherent flood/AQI/traffic risk)
  - Simulation conditions vary by time-of-day (rush hour, monsoon afternoon, night calm)
  - Small random perturbations make each refresh unique
  - DAI is computed by the ML model from the raw conditions
"""

import logging
import math
import random
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.domain import ZoneSnapshot

logger = logging.getLogger(__name__)

# ─── Zone baseline profiles ────────────────────────────────────────────────────
_ZONE_PROFILES: dict[str, dict] = {
    "Koramangala": {
        "rainfall_base": 12.0, "aqi_base": 110, "traffic_base": 62, "flood_risk": 0.75,
        "lat": 12.9279, "lon": 77.6271,
    },
    "HSR Layout": {
        "rainfall_base": 9.0, "aqi_base": 95, "traffic_base": 55, "flood_risk": 0.45,
        "lat": 12.9082, "lon": 77.6476,
    },
    "Indiranagar": {
        "rainfall_base": 7.0, "aqi_base": 88, "traffic_base": 70, "flood_risk": 0.30,
        "lat": 12.9784, "lon": 77.6408,
    },
    "Whitefield": {
        "rainfall_base": 6.0, "aqi_base": 145, "traffic_base": 80, "flood_risk": 0.25,
        "lat": 12.9698, "lon": 77.7499,
    },
    "Electronic City": {
        "rainfall_base": 5.0, "aqi_base": 130, "traffic_base": 75, "flood_risk": 0.20,
        "lat": 12.8399, "lon": 77.6770,
    },
    "Marathahalli": {
        "rainfall_base": 8.5, "aqi_base": 135, "traffic_base": 85, "flood_risk": 0.55,
        "lat": 12.9591, "lon": 77.6971,
    },
    "Jayanagar": {
        "rainfall_base": 6.5, "aqi_base": 82, "traffic_base": 58, "flood_risk": 0.20,
        "lat": 12.9250, "lon": 77.5938,
    },
    "Rajajinagar": {
        "rainfall_base": 7.5, "aqi_base": 102, "traffic_base": 65, "flood_risk": 0.35,
        "lat": 12.9914, "lon": 77.5530,
    },
    "Hebbal": {
        "rainfall_base": 8.0, "aqi_base": 115, "traffic_base": 72, "flood_risk": 0.60,
        "lat": 13.0358, "lon": 77.5970,
    },
    "BTM Layout": {
        "rainfall_base": 10.0, "aqi_base": 105, "traffic_base": 68, "flood_risk": 0.65,
        "lat": 12.9166, "lon": 77.6101,
    },
}

# ─── Time-of-day multipliers ───────────────────────────────────────────────────
def _time_multipliers(hour: int) -> dict[str, float]:
    """Return condition multipliers based on hour of day (IST)."""
    if 14 <= hour < 18:
        rain_mult = 2.5 + 1.5 * math.sin((hour - 14) * math.pi / 4)
    elif 18 <= hour < 20:
        rain_mult = 1.8
    elif 6 <= hour < 10:
        rain_mult = 0.6
    else:
        rain_mult = 0.3

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

    aqi_mult = 0.7 + 0.6 * traffic_mult
    return {
        "rainfall": rain_mult,
        "traffic": traffic_mult,
        "aqi": min(aqi_mult, 2.0),
    }


def _simulate_zone(zone_name: str, profile: dict, hour: int) -> dict:
    """Return a purely simulated condition dict for a zone at a given IST hour."""
    mults = _time_multipliers(hour)
    rainfall = max(0.0, round(
        profile["rainfall_base"] * mults["rainfall"] * random.uniform(0.85, 1.15), 1
    ))
    aqi = max(30, round(
        profile["aqi_base"] * mults["aqi"] * random.uniform(0.9, 1.10)
    ))
    traffic_index = min(100, max(0, round(
        profile["traffic_base"] * mults["traffic"] * random.uniform(0.88, 1.12)
    )))
    estimated_workability = max(0, min(100, round(
        100
        - min(40, rainfall * 0.4 * (1 + profile["flood_risk"]))
        - max(0, (aqi - 100) * 0.05)
        - max(0, (traffic_index - 40) * 0.3)
    )))
    # Approximate traffic speed from index
    speed_kmh = max(5.0, 80.0 - traffic_index * 0.75)
    return {
        "zone_name": zone_name,
        "rainfall_mm": rainfall,
        "aqi": aqi,
        "traffic_index": traffic_index,
        "workability_score": estimated_workability,
        "traffic_speed_kmh": round(speed_kmh, 1),
        "data_source": "simulated",
        "temperature_celsius": None,
        "dominant_pollutant": None,
        "weather_description": None,
    }


def _fetch_real_data(zone_name: str, profile: dict) -> dict | None:
    """Attempt to fetch real data for a zone. Returns None if all APIs unavailable.

    Calls weather, AQI, and traffic adapters in parallel via threads.
    Any adapter returning None means the simulation value is used for that field.
    """
    from app.services.external_data.weather_adapter import fetch_weather
    from app.services.external_data.aqi_adapter import fetch_aqi
    from app.services.external_data.traffic_adapter import fetch_traffic

    lat, lon = profile["lat"], profile["lon"]
    results: dict = {}

    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = {
            pool.submit(fetch_weather, lat, lon): "weather",
            pool.submit(fetch_aqi, lat, lon): "aqi",
            pool.submit(fetch_traffic, lat, lon, zone_name): "traffic",
        }
        for future in as_completed(futures):
            key = futures[future]
            try:
                results[key] = future.result()
            except Exception as exc:
                logger.warning(f"Real data fetch failed ({key}) for {zone_name!r}: {exc}")
                results[key] = None

    # Return None only if ALL three adapters also returned None
    # (means no API keys are configured at all)
    if all(v is None for v in results.values()):
        return None

    return results


def generate_zone_conditions(zone_name: str, hour: int | None = None) -> dict:
    """Generate zone conditions — real API first, simulation fallback.

    Returns raw condition fields ready for ZoneSnapshot upsert.
    DAI is NOT set here — it must be computed by the ML model.
    """
    profile = _ZONE_PROFILES.get(zone_name)
    if profile is None:
        profile = {"rainfall_base": 8.0, "aqi_base": 105, "traffic_base": 60, "flood_risk": 0.4,
                   "lat": 12.971, "lon": 77.594}

    if hour is None:
        utc_hour = datetime.now(tz=timezone.utc).hour
        hour = (utc_hour + 5) % 24  # IST

    # Always generate the simulation baseline first as the safe default
    sim = _simulate_zone(zone_name, profile, hour)

    real = _fetch_real_data(zone_name, profile)

    if real is None:
        # No API keys configured — pure simulation
        return sim

    # Merge: prefer real values where available, keep sim as fallback
    weather = real.get("weather") or {}
    aqi_data = real.get("aqi") or {}
    traffic_data = real.get("traffic") or {}

    # Rainfall: real API wins
    rainfall_mm = weather.get("rainfall_mm", sim["rainfall_mm"])
    temperature_celsius = weather.get("temperature_celsius")
    weather_description = weather.get("description")

    # AQI: real API wins
    aqi = aqi_data.get("aqi", sim["aqi"])
    dominant_pollutant = aqi_data.get("dominant_pollutant")

    # Traffic: real API wins
    traffic_index = traffic_data.get("traffic_index", sim["traffic_index"])
    traffic_speed_kmh = traffic_data.get("traffic_speed_kmh", sim["traffic_speed_kmh"])

    # Workability from merged real/sim data
    estimated_workability = max(0, min(100, round(
        100
        - min(40, rainfall_mm * 0.4 * (1 + profile["flood_risk"]))
        - max(0, (aqi - 100) * 0.05)
        - max(0, (traffic_index - 40) * 0.3)
    )))

    # Data source label: "real" if at least one field came from a live API
    any_real = any(bool(v) for v in [weather, aqi_data, traffic_data])
    data_source = "real" if any_real else "simulated"

    return {
        "zone_name": zone_name,
        "rainfall_mm": float(rainfall_mm),
        "aqi": int(aqi),
        "traffic_index": int(traffic_index),
        "workability_score": int(estimated_workability),
        "traffic_speed_kmh": float(traffic_speed_kmh) if traffic_speed_kmh else sim["traffic_speed_kmh"],
        "data_source": data_source,
        "temperature_celsius": temperature_celsius,
        "dominant_pollutant": dominant_pollutant,
        "weather_description": weather_description,
    }


def refresh_all_zones(db: Session, *, force_disruption_zone: str | None = None) -> list[dict]:
    """Fetch (real or sim) zone conditions for all known zones and upsert ZoneSnapshot.

    If force_disruption_zone is set, that zone gets extreme conditions for demo purposes.
    """
    now = datetime.now(tz=timezone.utc)
    hour_ist = (now.hour + 5) % 24
    results = []

    for zone_name, profile in _ZONE_PROFILES.items():
        if force_disruption_zone and zone_name == force_disruption_zone:
            # Force extreme conditions for demo
            conditions = {
                "zone_name": zone_name,
                "rainfall_mm": round(random.uniform(85.0, 110.0), 1),
                "aqi": random.randint(320, 420),
                "traffic_index": random.randint(5, 15),
                "workability_score": random.randint(10, 25),
                "traffic_speed_kmh": round(random.uniform(3.0, 8.0), 1),
                "data_source": "simulated",
                "temperature_celsius": None,
                "dominant_pollutant": None,
                "weather_description": "Heavy rain and flooding",
            }
        else:
            conditions = generate_zone_conditions(zone_name, hour=hour_ist)

        # Compute ML-predicted DAI from conditions
        try:
            from app.schemas import DisruptionPredictionRequest
            from app.services.ml_service import predict_disruption

            speed = conditions.get("traffic_speed_kmh") or max(5.0, 80.0 - conditions["traffic_index"] * 0.75)
            ml_req = DisruptionPredictionRequest(
                rainfall=conditions["rainfall_mm"],
                AQI=float(conditions["aqi"]),
                traffic_speed=float(speed),
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
            existing.data_source = conditions.get("data_source", "simulated")
            existing.temperature_celsius = conditions.get("temperature_celsius")
            existing.dominant_pollutant = conditions.get("dominant_pollutant")
            existing.traffic_speed_kmh = conditions.get("traffic_speed_kmh")
        else:
            db.add(ZoneSnapshot(
                zone_name=zone_name,
                rainfall_mm=conditions["rainfall_mm"],
                aqi=conditions["aqi"],
                traffic_index=conditions["traffic_index"],
                dai=dai,
                workability_score=conditions["workability_score"],
                updated_at=now,
                data_source=conditions.get("data_source", "simulated"),
                temperature_celsius=conditions.get("temperature_celsius"),
                dominant_pollutant=conditions.get("dominant_pollutant"),
                traffic_speed_kmh=conditions.get("traffic_speed_kmh"),
            ))

        results.append(conditions)
        logger.debug(
            f"Zone {zone_name!r} [{conditions['data_source']}] "
            f"rain={conditions['rainfall_mm']}mm AQI={conditions['aqi']} "
            f"traffic_idx={conditions['traffic_index']} DAI={dai:.3f}"
        )

    try:
        db.commit()
        logger.info(f"Zone snapshots refreshed for {len(results)} zones (IST hour {hour_ist})")
    except Exception as exc:
        db.rollback()
        logger.error(f"Failed to commit zone snapshot refresh: {exc}")

    return results
