"""Weather adapter — fetches real-time rainfall & temperature.

Primary:  OpenWeatherMap Current Weather API (free, no card required for basic endpoint)
          GET https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={key}&units=metric

Backup:   WeatherAPI Current API
          GET https://api.weatherapi.com/v1/current.json?key={key}&q={lat},{lon}

Returns a dict with:
  rainfall_mm: float        — precipitation in last 1 hour (mm); 0.0 if dry
  temperature_celsius: float
  description: str          — e.g. "light rain", "clear sky"
  source: str               — "openweathermap" | "weatherapi" | "none"

Returns None on both-fail so callers fall back to simulation.
"""

import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

_OWM_URL = "https://api.openweathermap.org/data/2.5/weather"
_WAPI_URL = "https://api.weatherapi.com/v1/current.json"
_TIMEOUT = 5.0  # seconds — short timeout so a dead API doesn't block the refresh loop


def fetch_weather(lat: float, lon: float) -> Optional[dict]:
    """Fetch current weather for coordinates. Returns None on failure."""
    owm_key = os.getenv("OWM_API_KEY", "").strip()
    wapi_key = os.getenv("WEATHER_API_KEY", "").strip()

    # ── Try OpenWeatherMap first ───────────────────────────────────────────────
    if owm_key:
        try:
            resp = httpx.get(
                _OWM_URL,
                params={"lat": lat, "lon": lon, "appid": owm_key, "units": "metric"},
                timeout=_TIMEOUT,
            )
            if resp.status_code == 200:
                data = resp.json()
                rainfall_mm = data.get("rain", {}).get("1h", 0.0)
                temp = data.get("main", {}).get("temp", 28.0)
                desc = data.get("weather", [{}])[0].get("description", "")
                logger.debug(
                    f"OWM weather | lat={lat} lon={lon} rain={rainfall_mm}mm temp={temp}°C desc={desc!r}"
                )
                return {
                    "rainfall_mm": float(rainfall_mm),
                    "temperature_celsius": float(temp),
                    "description": desc,
                    "source": "openweathermap",
                }
            else:
                logger.warning(f"OWM returned HTTP {resp.status_code} for lat={lat} lon={lon}")
        except Exception as exc:
            logger.warning(f"OWM fetch failed for lat={lat} lon={lon}: {exc}")

    # ── Fall back to WeatherAPI ────────────────────────────────────────────────
    if wapi_key:
        try:
            resp = httpx.get(
                _WAPI_URL,
                params={"key": wapi_key, "q": f"{lat},{lon}"},
                timeout=_TIMEOUT,
            )
            if resp.status_code == 200:
                data = resp.json()
                current = data.get("current", {})
                rainfall_mm = current.get("precip_mm", 0.0)
                temp = current.get("temp_c", 28.0)
                desc = current.get("condition", {}).get("text", "")
                logger.debug(
                    f"WeatherAPI weather | lat={lat} lon={lon} rain={rainfall_mm}mm temp={temp}°C"
                )
                return {
                    "rainfall_mm": float(rainfall_mm),
                    "temperature_celsius": float(temp),
                    "description": desc,
                    "source": "weatherapi",
                }
            else:
                logger.warning(f"WeatherAPI returned HTTP {resp.status_code}")
        except Exception as exc:
            logger.warning(f"WeatherAPI fetch failed: {exc}")

    logger.info(f"No weather API keys available/working for lat={lat} lon={lon} — using simulation")
    return None
