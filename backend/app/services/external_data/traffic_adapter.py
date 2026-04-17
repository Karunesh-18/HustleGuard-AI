"""Traffic adapter — fetches real-time road speed using Google Maps Roads API.

Primary approach: Google Maps Roads API — "Nearest Roads" + speed limits,
combined with current traffic data from the Distance Matrix API.

We use the Distance Matrix API (simpler, same key) to get travel time
vs distance and derive an effective speed for a zone's central roads.

Endpoint:
  GET https://maps.googleapis.com/maps/api/distancematrix/json
  Params: origins={lat},{lon}&destinations={dlat},{dlon}&departure_time=now
          &traffic_model=best_guess&key={key}

Returns dict:
  traffic_speed_kmh: float  — estimated current road speed (km/h)
  free_flow_speed_kmh: float — baseline (estimated from normal travel time)
  congestion_index: float   — 0.0 (free flow) to 1.0 (total gridlock)
  source: str               — "google_maps"

Returns None if key missing or API fails — caller uses simulation.

Note: We run two points ~2km apart within the zone boundary to get
the 'with traffic' vs 'without traffic' duration comparison.
"""

import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

_GMAPS_URL = "https://maps.googleapis.com/maps/api/distancematrix/json"
_TIMEOUT = 6.0

# Zone landmark pairs — origin → destination ~2km apart for intra-zone speed estimate
_ZONE_ROUTE_PAIRS: dict[str, tuple[str, str]] = {
    "Koramangala": ("12.934,77.614", "12.921,77.638"),
    "HSR Layout":  ("12.921,77.632", "12.905,77.653"),
    "Indiranagar": ("12.975,77.630", "12.960,77.650"),
    "Whitefield":  ("12.973,77.740", "12.955,77.763"),
    "Electronic City": ("12.850,77.668", "12.828,77.685"),
}

# Default intra-zone distance (km) — used when exact pair not defined
_DEFAULT_DISTANCE_KM = 2.0


def fetch_traffic(lat: float, lon: float, zone_name: str) -> Optional[dict]:
    """Fetch current traffic speed estimate for a zone. Returns None on failure."""
    key = os.getenv("GOOGLE_MAPS_API_KEY", "").strip()
    if not key:
        logger.debug("GOOGLE_MAPS_API_KEY not set — skipping real traffic fetch")
        return None

    route = _ZONE_ROUTE_PAIRS.get(zone_name)
    if route is None:
        # Use lat/lon as origin and a nearby point as destination
        origin = f"{lat},{lon}"
        destination = f"{lat + 0.018},{lon + 0.018}"  # ~2km NE
    else:
        origin, destination = route

    try:
        # Request with departure_time=now to get live traffic-aware duration
        resp = httpx.get(
            _GMAPS_URL,
            params={
                "origins": origin,
                "destinations": destination,
                "departure_time": "now",
                "traffic_model": "best_guess",
                "key": key,
            },
            timeout=_TIMEOUT,
        )

        if resp.status_code != 200:
            logger.warning(f"Google Maps Distance Matrix returned HTTP {resp.status_code}")
            return None

        data = resp.json()
        if data.get("status") != "OK":
            logger.warning(f"Google Maps API error: {data.get('status')} — {data.get('error_message', '')}")
            return None

        row = data["rows"][0]["elements"][0]
        if row.get("status") != "OK":
            logger.warning(f"Google Maps route element status: {row.get('status')}")
            return None

        # distance in metres
        distance_m = row["distance"]["value"]
        distance_km = distance_m / 1000.0

        # duration_in_traffic = with live congestion (seconds)
        # duration = normal duration without traffic (seconds)
        traffic_duration_s = row.get("duration_in_traffic", {}).get("value", 0)
        normal_duration_s = row["duration"]["value"]

        if traffic_duration_s == 0:
            traffic_duration_s = normal_duration_s  # fallback if API doesn't return it

        # Speed = distance / time (km / (seconds/3600) = km/h)
        current_speed = (distance_km / traffic_duration_s) * 3600 if traffic_duration_s > 0 else 30.0
        free_flow_speed = (distance_km / normal_duration_s) * 3600 if normal_duration_s > 0 else 40.0

        # Cap to realistic road speeds for Indian urban areas
        current_speed = min(max(current_speed, 3.0), 80.0)
        free_flow_speed = min(max(free_flow_speed, 5.0), 80.0)

        # congestion index: 0 = free flow, 1 = total gridlock
        congestion = 1.0 - (current_speed / free_flow_speed) if free_flow_speed > 0 else 0.0
        congestion = max(0.0, min(1.0, congestion))

        # Convert to our traffic_index scale (0–100, higher = more congested)
        traffic_index = round(congestion * 100)

        logger.debug(
            f"Google Maps traffic | zone={zone_name!r} speed={current_speed:.1f}km/h "
            f"free_flow={free_flow_speed:.1f}km/h congestion={congestion:.2f} index={traffic_index}"
        )
        return {
            "traffic_speed_kmh": round(current_speed, 1),
            "free_flow_speed_kmh": round(free_flow_speed, 1),
            "congestion_index": round(congestion, 3),
            "traffic_index": traffic_index,
            "source": "google_maps",
        }
    except Exception as exc:
        logger.warning(f"Google Maps traffic fetch failed for zone {zone_name!r}: {exc}")
        return None
