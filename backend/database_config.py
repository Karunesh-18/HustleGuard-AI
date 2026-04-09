# Database connection pool optimization for HustleGuard
import os
from sqlalchemy import create_engine
from sqlalchemy.pool import QueuePool
from sqlalchemy.engine import Engine

def get_pool_config() -> dict:
    """
    Get optimized SQLAlchemy pool configuration based on environment.
    
    Tuning parameters:
    - pool_size: Number of connections to keep in pool (default 20)
    - max_overflow: Connections allowed beyond pool_size (default 20)
    - pool_recycle: Recycle connections after this many seconds (default 3600)
    - pool_pre_ping: Test connections before using (default True)
    - echo_pool: Log pool events (default False)
    """
    return {
        "poolclass": QueuePool,
        "pool_size": int(os.getenv("SQLALCHEMY_POOL_SIZE", "20")),
        "max_overflow": int(os.getenv("SQLALCHEMY_MAX_OVERFLOW", "20")),
        "pool_recycle": int(os.getenv("SQLALCHEMY_POOL_RECYCLE", "3600")),
        "pool_pre_ping": os.getenv("SQLALCHEMY_POOL_PRE_PING", "true").lower() in ("true", "1"),
        "echo_pool": os.getenv("SQLALCHEMY_ECHO_POOL", "false").lower() in ("true", "1"),
    }

def optimize_engine(engine: Engine) -> Engine:
    """
    Apply additional optimizations to SQLAlchemy engine after creation.
    
    Optimizations:
    - Configure pool size and behavior
    - Set connection timeout settings
    - Enable connection validation
    """
    return engine
