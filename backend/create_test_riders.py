import asyncio
import requests
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

# Import the DB and models
from app.database import SessionLocal
from app.models.rider import Rider
from app.models.domain import ZoneSnapshot
from app.services.policy_service import subscribe_rider_to_policy
from app.schemas import RiderPolicyCreate

def main():
    db = SessionLocal()
    try:
        # Create user 1 (Good DAI)
        rider1 = db.query(Rider).filter_by(name="Ravi Good").first()
        if not rider1:
            rider1 = Rider(
                name="Ravi Good",
                email="ravi.good@example.com",
                city="Bengaluru",
                home_zone="Indiranagar",
                reliability_score=85
            )
            db.add(rider1)
            db.commit()
            db.refresh(rider1)
            print(f"Created {rider1.name} with ID {rider1.id}")
            
        # Create user 2 (Bad DAI)
        rider2 = db.query(Rider).filter_by(name="Ravi Disrupted").first()
        if not rider2:
            rider2 = Rider(
                name="Ravi Disrupted",
                email="ravi.bad@example.com",
                city="Bengaluru",
                home_zone="Koramangala",
                reliability_score=80
            )
            db.add(rider2)
            db.commit()
            db.refresh(rider2)
            print(f"Created {rider2.name} with ID {rider2.id}")
            
        # Ensure policies are subscribed (Premium Armor for 0 waiting period)
        subscribe_rider_to_policy(db, RiderPolicyCreate(rider_id=rider1.id, policy_name="Premium Armor"))
        print(f"Subscribed {rider1.name} to Premium Armor")
        
        subscribe_rider_to_policy(db, RiderPolicyCreate(rider_id=rider2.id, policy_name="Premium Armor"))
        print(f"Subscribed {rider2.name} to Premium Armor")
        
        # We also need to update eligible_from to be in the past so it triggers immediately
        from app.models.rider_policy import RiderPolicy
        policies = db.query(RiderPolicy).filter(RiderPolicy.rider_id.in_([rider1.id, rider2.id])).all()
        for p in policies:
            p.eligible_from = datetime.utcnow() - timedelta(days=2)
        db.commit()

        # Simulate disruption
        resp = requests.post(
            "http://127.0.0.1:8000/api/v1/admin/simulate-disruption",
            json={"zone_name": "Koramangala"}
        )
        print("Simulated Disruption on Koramangala:", resp.json())
        
        # Fetch latest zone data to trigger evaluate
        db.refresh(rider2) # ensure up to date
        zone_snap = db.query(ZoneSnapshot).filter_by(zone_name="Koramangala").first()
        if zone_snap:
            eval_resp = requests.post(
                "http://127.0.0.1:8000/api/v1/triggers/evaluate",
                json={
                    "zone_id": 1, # dummy zone_id if needed, backend usually ignores
                    "rainfall": zone_snap.rainfall_mm,
                    "AQI": zone_snap.aqi,
                    "traffic_speed": zone_snap.traffic_index,
                    "current_dai": zone_snap.dai,
                    "rider_id": rider2.id
                }
            )
            print("Triggered Payout Evaluation for Rider 2:", eval_resp.json())

    finally:
        db.close()

if __name__ == "__main__":
    main()
