"""
seed_zones.py — Replace all mock zones with real Bangalore delivery zones.

Clears:
  - zones table (old mock entries like 'Zone-1')
  - zone_snapshots table (stale simulated snapshots)

Seeds:
  - 10 real Bangalore delivery hotspots into the zones table
  - Triggers refresh_all_zones() to immediately fetch real API data

Safe to run multiple times.
"""
import os, sys, logging

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
logger = logging.getLogger(__name__)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from app.database import SessionLocal
from app.models.zone import Zone
from app.models.domain import ZoneSnapshot

REAL_ZONES = [
    {"name": "Koramangala",    "city": "Bangalore", "baseline_orders_per_hour": 320.0, "baseline_active_riders": 95.0,  "baseline_delivery_time_minutes": 28.0, "risk_level": "high"},
    {"name": "HSR Layout",     "city": "Bangalore", "baseline_orders_per_hour": 260.0, "baseline_active_riders": 78.0,  "baseline_delivery_time_minutes": 26.0, "risk_level": "medium"},
    {"name": "Indiranagar",    "city": "Bangalore", "baseline_orders_per_hour": 290.0, "baseline_active_riders": 85.0,  "baseline_delivery_time_minutes": 25.0, "risk_level": "medium"},
    {"name": "Whitefield",     "city": "Bangalore", "baseline_orders_per_hour": 340.0, "baseline_active_riders": 110.0, "baseline_delivery_time_minutes": 35.0, "risk_level": "medium"},
    {"name": "Electronic City","city": "Bangalore", "baseline_orders_per_hour": 380.0, "baseline_active_riders": 120.0, "baseline_delivery_time_minutes": 32.0, "risk_level": "low"},
    {"name": "Marathahalli",   "city": "Bangalore", "baseline_orders_per_hour": 300.0, "baseline_active_riders": 92.0,  "baseline_delivery_time_minutes": 30.0, "risk_level": "high"},
    {"name": "Jayanagar",      "city": "Bangalore", "baseline_orders_per_hour": 220.0, "baseline_active_riders": 68.0,  "baseline_delivery_time_minutes": 24.0, "risk_level": "low"},
    {"name": "Rajajinagar",    "city": "Bangalore", "baseline_orders_per_hour": 240.0, "baseline_active_riders": 72.0,  "baseline_delivery_time_minutes": 27.0, "risk_level": "medium"},
    {"name": "Hebbal",         "city": "Bangalore", "baseline_orders_per_hour": 195.0, "baseline_active_riders": 60.0,  "baseline_delivery_time_minutes": 29.0, "risk_level": "medium"},
    {"name": "BTM Layout",     "city": "Bangalore", "baseline_orders_per_hour": 275.0, "baseline_active_riders": 83.0,  "baseline_delivery_time_minutes": 26.0, "risk_level": "high"},
]

db = SessionLocal()
try:
    old = db.query(Zone).count()
    db.query(Zone).delete()
    snaps = db.query(ZoneSnapshot).count()
    db.query(ZoneSnapshot).delete()
    db.commit()
    logger.info(f"Cleared {old} zone(s) and {snaps} snapshot(s)")

    for z in REAL_ZONES:
        db.add(Zone(**z))
    db.commit()
    logger.info(f"Inserted {len(REAL_ZONES)} real Bangalore zones")

    logger.info("Fetching live data from OWM + AQICN + Google Maps (10-20s)...")
    from app.services.zone_simulation_service import refresh_all_zones
    results = refresh_all_zones(db)

    real_n = sum(1 for r in results if r.get("data_source") == "real")
    print(f"\nDone: {real_n}/{len(results)} zones have REAL data\n")
    for r in results:
        badge = "REAL" if r.get("data_source") == "real" else "SIM "
        print(f"  [{badge}]  {r['zone_name']:<18}  rain={r['rainfall_mm']}mm  AQI={r['aqi']}  DAI={r['dai']:.3f}  temp={r.get('temperature_celsius')}C")
finally:
    db.close()
