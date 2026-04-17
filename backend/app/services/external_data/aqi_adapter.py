"""AQI adapter — fetches real-time Air Quality Index by coordinates.

Provider: AQICN / World Air Quality Index (WAQI)
Endpoint: GET https://api.waqi.info/feed/geo:{lat};{lon}/?token={token}

Returns dict:
  aqi: int                  — AQI value on 0–500 scale (matches our ML model)
  dominant_pollutant: str   — e.g. "pm25", "o3"
  station_name: str         — name of nearest monitoring station
  source: str               — "aqicn"

Returns None if token missing or API fails.

Free token: register at https://aqicn.org/data-platform/token/
India coverage is excellent — Bangalore has 10+ stations.

NOTE: The "demo" token is heavily rate-limited (few requests/day) and will
return {"status":"error","data":"Over quota"} after the first call. Set a
real free token in backend/.env as AQICN_TOKEN=<your_token>.
"""

import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

_AQICN_URL = "https://api.waqi.info/feed/geo:{lat};{lon}/"
_TIMEOUT = 5.0
_WARNED_DEMO = False  # warn once per process, not every call


def fetch_aqi(lat: float, lon: float) -> Optional[dict]:
    """Fetch current AQI for coordinates from AQICN. Returns None on failure."""
    global _WARNED_DEMO

    token = os.getenv("AQICN_TOKEN", "").strip()
    if not token:
        logger.debug("AQICN_TOKEN not set — skipping real AQI fetch")
        return None

    # Warn once when the demo token is used — it's heavily rate-limited
    if token == "demo" and not _WARNED_DEMO:
        logger.warning(
            "AQICN_TOKEN is set to 'demo'. The demo token is rate-limited "
            "and will return overQuota after a few calls. Register for a free "
            "token at https://aqicn.org/data-platform/token/ and set "
            "AQICN_TOKEN=<your_token> in backend/.env."
        )
        _WARNED_DEMO = True

    url = _AQICN_URL.format(lat=lat, lon=lon)
    try:
        resp = httpx.get(url, params={"token": token}, timeout=_TIMEOUT)
        if resp.status_code != 200:
            logger.warning(f"AQICN returned HTTP {resp.status_code}")
            return None

        body = resp.json()
        if body.get("status") != "ok":
            msg = body.get("data", "unknown error")
            # overQuota is a common demo-token failure — log specifically
            if isinstance(msg, str) and "quota" in msg.lower():
                logger.warning(
                    "AQICN overQuota — demo token rate limit reached. "
                    "Get a free real token at https://aqicn.org/data-platform/token/"
                )
            else:
                logger.warning(f"AQICN API error: {msg}")
            return None

        data = body["data"]
        raw_aqi = data.get("aqi")
        # AQICN sometimes returns "-" when station is offline
        if raw_aqi is None or raw_aqi == "-":
            logger.warning(f"AQICN returned no AQI value for lat={lat} lon={lon}")
            return None

        aqi = int(raw_aqi)
        dominant = data.get("dominentpol", "pm25")
        station_name = data.get("city", {}).get("name", "Unknown")

        logger.debug(f"AQICN | lat={lat} lon={lon} aqi={aqi} pol={dominant} station={station_name!r}")
        return {
            "aqi": aqi,
            "dominant_pollutant": dominant,
            "station_name": station_name,
            "source": "aqicn",
        }
    except Exception as exc:
        logger.warning(f"AQICN fetch failed for lat={lat} lon={lon}: {exc}")
        return None
