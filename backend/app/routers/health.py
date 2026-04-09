from fastapi import APIRouter, Request

router = APIRouter(tags=["health"])


@router.get("/")
def read_root(request: Request) -> dict[str, object]:
    return {
        "message": "FastAPI is running.",
        "database_ready": getattr(request.app.state, "database_ready", False),
        "database_error": getattr(request.app.state, "database_error", None),
        "database_backend": getattr(request.app.state, "database_backend", "unknown"),
        "zone_refresh_last_ok": getattr(request.app.state, "zone_refresh_last_ok", None),
        "zone_refresh_fail_count": getattr(request.app.state, "zone_refresh_fail_count", 0),
    }


@router.get("/health")
def read_health(request: Request) -> dict[str, object]:
    fail_count = getattr(request.app.state, "zone_refresh_fail_count", 0)
    return {
        "status": "degraded" if fail_count >= 3 else "ok",
        "database_ready": getattr(request.app.state, "database_ready", False),
        "database_error": getattr(request.app.state, "database_error", None),
        "database_backend": getattr(request.app.state, "database_backend", "unknown"),
        # Zone refresh monitoring — alerts if background task silently fails
        "zone_refresh_last_ok": getattr(request.app.state, "zone_refresh_last_ok", None),
        "zone_refresh_fail_count": fail_count,
    }