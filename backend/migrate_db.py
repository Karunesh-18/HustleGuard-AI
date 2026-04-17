import asyncio
from sqlalchemy import text
from app.database import SessionLocal

def main():
    db = SessionLocal()
    try:
        # Add new columns to claims table
        columns = [
            "claim_type VARCHAR DEFAULT 'parametric_auto'",
            "distress_reason VARCHAR",
            "base_payout_inr FLOAT",
            "partial_payout_ratio FLOAT",
            "current_dai_at_claim FLOAT",
            "community_trigger_count INTEGER",
            "appeal_of_claim_id INTEGER",
            "appeal_clarification TEXT",
            "appeal_status VARCHAR"
        ]
        
        for col in columns:
            try:
                db.execute(text(f"ALTER TABLE claims ADD COLUMN {col}"))
                db.commit()
                print(f"Added {col}")
            except Exception as e:
                db.rollback()
                print(f"Skipped {col} (might exist): {e}")

        # Also remove the two test users as requested
        from app.models.rider import Rider
        from app.models.rider_policy import RiderPolicy
        from app.models.claim import Claim
        from app.models.payout import Payout

        riders = db.query(Rider).filter(Rider.name.in_(["Ravi Good", "Ravi Disrupted"])).all()
        for r in riders:
            print(f"Deleting test rider: {r.name}")
            # Delete their policies
            db.query(RiderPolicy).filter_by(rider_id=r.id).delete()
            # Delete their claims
            claims = db.query(Claim).filter_by(rider_id=r.id).all()
            for c in claims:
                db.query(Payout).filter_by(claim_id=c.id).delete()
                db.delete(c)
            db.delete(r)
        
        db.commit()
        print("Cleaned up test riders.")

    finally:
        db.close()

if __name__ == "__main__":
    main()
