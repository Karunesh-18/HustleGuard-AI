import urllib.request
import urllib.error
import json

BASE = "http://localhost:8000"

def get(path):
    with urllib.request.urlopen(f"{BASE}{path}") as r:
        return json.loads(r.read())

def post(path, data):
    body = json.dumps(data).encode()
    req = urllib.request.Request(f"{BASE}{path}", data=body,
                                  headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

zones_to_add = [
    {"name": "Koramangala",       "city": "Bangalore", "risk_level": "medium"},
    {"name": "HSR Layout",        "city": "Bangalore", "risk_level": "medium"},
    {"name": "Indiranagar",       "city": "Bangalore", "risk_level": "medium"},
    {"name": "Whitefield",        "city": "Bangalore", "risk_level": "low"},
    {"name": "Electronic City",   "city": "Bangalore", "risk_level": "low"},
    {"name": "Jayanagar",         "city": "Bangalore", "risk_level": "medium"},
    {"name": "MG Road",           "city": "Bangalore", "risk_level": "medium"},
    {"name": "Marathahalli",      "city": "Bangalore", "risk_level": "medium"},
    {"name": "BTm Layout",        "city": "Bangalore", "risk_level": "medium"},
    {"name": "Bellandur",         "city": "Bangalore", "risk_level": "low"},
]

existing = get("/api/v1/zones")
existing_names = {z["name"] for z in existing}
print("Existing zones:", sorted(existing_names))

for z in zones_to_add:
    if z["name"] in existing_names:
        print(f"  Skipping (exists): {z['name']}")
        continue
    status, resp = post("/api/v1/zones", z)
    if status == 200:
        print(f"  Added: {z['name']}")
    else:
        print(f"  Failed {z['name']}: {status} {resp}")

final = get("/api/v1/zones")
print("\nAll zones now:")
for z in final:
    print(f"  id={z['id']}  name={z['name']}  city={z['city']}")
