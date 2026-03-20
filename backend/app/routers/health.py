from fastapi import APIRouter, Request

router = APIRouter(tags=["health"])


@router.get("/")
def read_root(request: Request) -> dict[str, object]:
    return {
        "message": "FastAPI is running.",
        "database_ready": getattr(request.app.state, "database_ready", False),
        "database_error": getattr(request.app.state, "database_error", None),
        "database_backend": getattr(request.app.state, "database_backend", "unknown"),
    }


@router.get("/health")
def read_health(request: Request) -> dict[str, object]:
    return {
        "status": "ok",
        "database_ready": getattr(request.app.state, "database_ready", False),
        "database_error": getattr(request.app.state, "database_error", None),
        "database_backend": getattr(request.app.state, "database_backend", "unknown"),
    }