import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
SQLITE_FALLBACK_URL = "sqlite:///./hustleguard.db"


def _build_engine(database_url: str):
    engine_kwargs = {"pool_pre_ping": True}

    if database_url.startswith("postgresql"):
        engine_kwargs["connect_args"] = {"connect_timeout": 5}
    elif database_url.startswith("sqlite"):
        engine_kwargs["connect_args"] = {"check_same_thread": False}

    return create_engine(database_url, **engine_kwargs)


def _initial_database_url() -> str:
    return DATABASE_URL or SQLITE_FALLBACK_URL


engine = _build_engine(_initial_database_url())

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def configure_engine(database_url: str) -> None:
    global engine, SessionLocal
    engine = _build_engine(database_url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def enable_sqlite_fallback() -> None:
    configure_engine(SQLITE_FALLBACK_URL)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()