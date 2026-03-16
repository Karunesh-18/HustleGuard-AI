from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import SQLAlchemyError

from app import models as _models
from app import database
from app.routers import domain, health, users


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        database.Base.metadata.create_all(bind=database.engine)
        app.state.database_ready = True
        app.state.database_error = None
        app.state.database_backend = "primary"
    except SQLAlchemyError as exc:
        try:
            database.enable_sqlite_fallback()
            database.Base.metadata.create_all(bind=database.engine)
            app.state.database_ready = True
            app.state.database_error = "Primary database is unreachable. Running on local SQLite fallback."
            app.state.database_error_detail = str(exc)
            app.state.database_backend = "sqlite-fallback"
        except SQLAlchemyError as fallback_exc:
            app.state.database_ready = False
            app.state.database_error = "Database startup failed. Check primary DB network access and local fallback configuration."
            app.state.database_error_detail = f"Primary: {exc} | Fallback: {fallback_exc}"
            app.state.database_backend = "none"

    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:3000", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(users.router)
app.include_router(domain.router)