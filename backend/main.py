from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy.exc import SQLAlchemyError

from app import models as _models
from app.database import Base, engine
from app.routers import health, users


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        Base.metadata.create_all(bind=engine)
        app.state.database_ready = True
        app.state.database_error = None
    except SQLAlchemyError as exc:
        app.state.database_ready = False
        app.state.database_error = str(exc)

    yield


app = FastAPI(lifespan=lifespan)

app.include_router(health.router)
app.include_router(users.router)