"""
migrate.py - Idempotent schema migration for HustleGuard AI.

Adds columns that exist in SQLAlchemy models but may be missing from the live
Neon PostgreSQL database (because create_all only creates tables, not new cols).

Safe to run multiple times - uses ADD COLUMN IF NOT EXISTS.

Usage:
    .venv/scripts/python.exe migrate.py
"""
import os
import sys
from dotenv import load_dotenv
import psycopg2

load_dotenv()  # reads .env

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not set in .env")
    sys.exit(1)

# Map psycopg2 connection string from SQLAlchemy URL format
# SQLAlchemy uses postgresql://, psycopg2 uses postgresql:// too — same format.
conn_str = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
conn = psycopg2.connect(conn_str)
conn.autocommit = True
cur = conn.cursor()

migrations = [
    # ── ZoneSnapshot — Phase 3 real-API enrichment fields ──────────────────
    "ALTER TABLE zone_snapshots ADD COLUMN IF NOT EXISTS data_source VARCHAR DEFAULT 'simulated'",
    "ALTER TABLE zone_snapshots ADD COLUMN IF NOT EXISTS temperature_celsius FLOAT",
    "ALTER TABLE zone_snapshots ADD COLUMN IF NOT EXISTS dominant_pollutant VARCHAR",
    "ALTER TABLE zone_snapshots ADD COLUMN IF NOT EXISTS traffic_speed_kmh FLOAT",

    # ── Disruption — concurrent disruption detection fields ─────────────────
    "ALTER TABLE disruptions ADD COLUMN IF NOT EXISTS is_concurrent BOOLEAN DEFAULT FALSE",
    "ALTER TABLE disruptions ADD COLUMN IF NOT EXISTS concurrent_zones TEXT",

    # ── RiderLocationLog — full table (IF NOT EXISTS) ───────────────────────
    """
    CREATE TABLE IF NOT EXISTS rider_location_logs (
        id SERIAL PRIMARY KEY,
        rider_id INTEGER NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
        latitude FLOAT NOT NULL,
        longitude FLOAT NOT NULL,
        accuracy_meters FLOAT,
        zone_name VARCHAR,
        source VARCHAR DEFAULT 'gps',
        context VARCHAR DEFAULT 'app_open',
        logged_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_rider_location_logs_rider_id ON rider_location_logs (rider_id)",
    "CREATE INDEX IF NOT EXISTS ix_rider_location_logs_logged_at ON rider_location_logs (logged_at)",
]

print(f"Connecting to: {DATABASE_URL[:60]}...")
print(f"Running {len(migrations)} migration statements...\n")

for i, sql in enumerate(migrations, 1):
    stmt = sql.strip().split('\n')[0][:80]  # first line, trimmed for display
    try:
        cur.execute(sql)
        print(f"  [{i:02d}] OK  — {stmt}")
    except psycopg2.Error as e:
        print(f"  [{i:02d}] ERR — {stmt}")
        print(f"         {e.pgerror or str(e)}")

cur.close()
conn.close()
print("\nMigration complete.")
