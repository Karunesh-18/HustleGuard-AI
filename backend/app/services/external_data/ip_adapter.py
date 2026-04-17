"""IP Geolocation adapter — resolves IP address to city for fraud detection.

Provider: ipapi.co (free tier, no API key needed for basic use)
Endpoint: GET https://ipapi.co/{ip}/json/

Returns dict:
  city: str
  region: str
  country: str
  latitude: float
  longitude: float

Returns None on failure — caller falls back to request header value.
"""

import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

_IPAPI_URL = "https://ipapi.co/{ip}/json/"
_TIMEOUT = 4.0

# Simple in-memory cache to avoid hammering the free tier (1000 req/day)
_cache: dict[str, dict] = {}


def fetch_ip_location(ip: str) -> Optional[dict]:
    """Resolve an IP address to its city. Returns None on failure."""
    enabled = os.getenv("ENABLE_IP_GEOLOCATION", "true").strip().lower() in {"1", "true", "yes"}
    if not enabled:
        return None

    # Skip private/reserved IPs immediately
    if ip in ("127.0.0.1", "::1", "localhost") or ip.startswith("192.168.") or ip.startswith("10."):
        return None

    if ip in _cache:
        return _cache[ip]

    try:
        resp = httpx.get(_IPAPI_URL.format(ip=ip), timeout=_TIMEOUT)
        if resp.status_code == 429:
            logger.warning("ipapi.co rate limit hit")
            return None
        if resp.status_code != 200:
            return None

        data = resp.json()
        if data.get("error"):
            return None

        result = {
            "city": data.get("city", ""),
            "region": data.get("region", ""),
            "country": data.get("country_name", ""),
            "latitude": data.get("latitude"),
            "longitude": data.get("longitude"),
        }
        _cache[ip] = result
        return result
    except Exception as exc:
        logger.debug(f"IP geolocation failed for {ip}: {exc}")
        return None
