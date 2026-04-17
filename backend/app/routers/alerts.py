"""Real-time government / disaster alerts router — powered by NewsAPI.

Endpoint:
  GET /api/v1/alerts          — return live Bangalore disruption alerts from NewsAPI
                                with severity classification and 10-minute cache

The frontend Alerts tab calls this to show real news articles about floods,
government curfews, NDMA alerts, etc. rather than synthetic placeholder items.
Falls back to an empty list if the NEWS_API_KEY is not configured.
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Request
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/alerts", tags=["alerts"])


class AlertItem(BaseModel):
    title: str
    description: str
    url: str
    published_at: str
    source_name: str
    severity: str  # "high" | "medium" | "info"


@router.get("", response_model=list[AlertItem])
async def get_live_alerts(request: Request) -> list[AlertItem]:
    """Fetch live disruption alerts for Bangalore from NewsAPI.

    Results are cached for 10 minutes per the adapter's built-in TTL.
    Returns [] when NEWS_API_KEY is not configured rather than raising an error,
    so the frontend gracefully shows an empty state.
    """
    try:
        from app.services.external_data.news_adapter import fetch_alerts
        raw = fetch_alerts()
        return [AlertItem(**item) for item in raw]
    except Exception as exc:
        logger.warning(f"Alerts fetch failed: {exc}")
        return []


@router.get("/status")
async def alerts_status() -> dict:
    """Return metadata about the alerts data source for transparency."""
    import os
    has_key = bool(os.getenv("NEWS_API_KEY", "").strip())
    return {
        "provider": "NewsAPI (newsapi.org)",
        "configured": has_key,
        "keywords": [
            "Bangalore flood",
            "Bengaluru flood",
            "Bangalore rain heavy",
            "Karnataka cyclone",
            "NDMA Karnataka",
            "Bangalore traffic blocked",
            "Bengaluru waterlogging",
            "Karnataka emergency",
        ],
        "cache_ttl_seconds": 600,
        "last_fetch": None,  # adapter caches per-process; no persistent timestamp
    }
