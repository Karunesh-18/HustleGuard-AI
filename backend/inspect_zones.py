import os
from dotenv import load_dotenv
load_dotenv()
import psycopg2

conn = psycopg2.connect(os.getenv("DATABASE_URL"))
cur = conn.cursor()

cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='zones' ORDER BY ordinal_position")
cols = [r[0] for r in cur.fetchall()]
print("zones cols:", cols)

cur.execute("SELECT * FROM zones LIMIT 20")
rows = cur.fetchall()
print(f"rows ({len(rows)}):")
for r in rows:
    print(" ", r)

cur.execute("SELECT zone_name, data_source, updated_at FROM zone_snapshots ORDER BY updated_at DESC LIMIT 10")
snaps = cur.fetchall()
print(f"\nzone_snapshots ({len(snaps)}):")
for s in snaps:
    print(" ", s)

cur.close()
conn.close()
