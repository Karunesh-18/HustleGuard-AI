"""News adapter — fetches live government & disaster alerts relevant to Bangalore.

Provider: NewsAPI (newsapi.org)
Endpoint: GET https://newsapi.org/v2/everything

Searches for keywords relevant to delivery disruption:
  - "Bangalore flood" / "Bengaluru flood"
  - "Bangalore cyclone" / "Karnataka government alert"
  - "NDMA alert Karnataka"

Returns list of AlertItem dicts:
  title: str
  description: str
  url: str
  published_at: str   — ISO datetime
  source_name: str
  severity: str       — "high" | "medium" | "info"

Returns [] on API failure (non-blocking).

Note: NewsAPI free plan allows 100 req/day. We call this at most once per
zone-refresh cycle (every 10 minutes), so daily usage is well within limits.
"""

import logging
import os
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

_NEWSAPI_URL = "https://newsapi.org/v2/everything"
_TIMEOUT = 5.0

# Keywords that indicate delivery-disrupting events in Bangalore
_ALERT_KEYWORDS = [
    "Bangalore flood",
    "Bengaluru flood",
    "Bangalore rain heavy",
    "Karnataka cyclone",
    "NDMA Karnataka",
    "Bangalore traffic blocked",
    "Bengaluru waterlogging",
    "Karnataka emergency",
]

# Keywords in headline that suggest high severity
_HIGH_SEVERITY_HINTS = ["flood", "cyclone", "emergency", "curfew", "disaster", "ndma", "blocked"]
_MED_SEVERITY_HINTS = ["heavy rain", "waterlogging", "traffic jam", "disruption"]

# Cache last fetch to avoid hammering the API — refresh max once per 10 min
_cache: dict = {"ts": None, "items": []}
_CACHE_TTL_SECONDS = 600


def _classify_severity(title: str, desc: str) -> str:
    text = (title + " " + desc).lower()
    if any(h in text for h in _HIGH_SEVERITY_HINTS):
        return "high"
    if any(h in text for h in _MED_SEVERITY_HINTS):
        return "medium"
    return "info"


def fetch_alerts() -> list[dict]:
    """Fetch recent government / disaster alerts for Bangalore. Returns [] on failure."""
    # Serve from cache if recent enough
    now = datetime.now(tz=timezone.utc)
    if _cache["ts"] and (now - _cache["ts"]).total_seconds() < _CACHE_TTL_SECONDS:
        return _cache["items"]

    api_key = os.getenv("NEWS_API_KEY", "").strip()
    if not api_key:
        logger.debug("NEWS_API_KEY not set — skipping real news fetch")
        return []

    query = " OR ".join(f'"{kw}"' for kw in _ALERT_KEYWORDS[:4])  # keep query short
    since = (now - timedelta(hours=24)).strftime("%Y-%m-%dT%H:%M:%SZ")

    try:
        resp = httpx.get(
            _NEWSAPI_URL,
            params={
                "q": query,
                "from": since,
                "sortBy": "publishedAt",
                "language": "en",
                "pageSize": 10,
                "apiKey": api_key,
            },
            timeout=_TIMEOUT,
        )

        if resp.status_code == 429:
            logger.warning("NewsAPI rate limit hit — returning cached/empty alerts")
            return _cache["items"]

        if resp.status_code != 200:
            logger.warning(f"NewsAPI returned HTTP {resp.status_code}")
            return []

        data = resp.json()
        articles = data.get("articles", [])
        items = []
        for a in articles:
            title = a.get("title") or ""
            desc = a.get("description") or ""
            if not title or title == "[Removed]":
                continue
            items.append({
                "title": title[:200],
                "description": desc[:400],
                "url": a.get("url", ""),
                "published_at": a.get("publishedAt", ""),
                "source_name": a.get("source", {}).get("name", "Unknown"),
                "severity": _classify_severity(title, desc),
            })

        _cache["ts"] = now
        _cache["items"] = items
        logger.info(f"NewsAPI fetched {len(items)} Bangalore alerts")
        return items

    except Exception as exc:
        logger.warning(f"NewsAPI fetch failed: {exc}")
        return _cache["items"]  # return stale cache rather than nothing
