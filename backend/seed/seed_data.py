"""
Seed script — populates demo-mode (or a connected MongoDB) with a
realistic, story-driven dataset:

  * 5 demo accounts, one per role used in the primary demo flow
  * Farms clustered around three villages near Bhayandar / Thane belt,
    Maharashtra (consistent with PS 26128's Government of Maharashtra scope)
  * Animals per farm
  * A tight geographic + temporal cluster of disease reports in "Village A"
    and "Village B" with overlapping symptoms — enough to trigger the
    outbreak-detection threshold (OUTBREAK_MIN_CASES) automatically via the
    same code path a live farmer submission would use
  * A handful of isolated, low-risk reports elsewhere that should NOT
    trigger an outbreak, to prove the detector isn't over-triggering

Run: python -m seed.seed_data
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from datetime import datetime, timedelta
from app.core.db import get_db, reset_db
from app.core.security import hash_password
from app.gis.service import geojson_point
from app.reports.router import ReportIn, submit_report

DEMO_PASSWORD = "Demo@123"

VILLAGES = {
    "Village A (Bhayandar Rural)": (19.3006, 72.8508, "Thane"),
    "Village B (Uttan)": (19.2745, 72.7960, "Thane"),
    "Village C (Naigaon)": (19.3550, 72.8500, "Palghar"),  # far enough not to cluster
}


def seed():
    reset_db()
    db = get_db()

    print("Seeding users...")
    users = {}
    demo_users = [
        ("Ramesh Patil", "farmer@pashuraksha.demo", "FARMER", "Thane"),
        ("Suresh Jadhav", "worker@pashuraksha.demo", "FIELD_WORKER", "Thane"),
        ("Dr. Anjali Deshmukh", "vet@pashuraksha.demo", "VETERINARIAN", "Thane"),
        ("Priya Sharma", "lab@pashuraksha.demo", "LAB_STAFF", "Thane"),
        ("Vikram Singh", "admin@pashuraksha.demo", "SUPER_ADMIN", "Thane"),
        ("Dr. Meena Kulkarni", "vet2@pashuraksha.demo", "VETERINARIAN", "Palghar"),
        ("Rahul More", "district@pashuraksha.demo", "DISTRICT_ADMIN", "Thane"),
        ("Sunita Rao", "state@pashuraksha.demo", "STATE_ADMIN", "Maharashtra"),
    ]
    for name, email, role, district in demo_users:
        doc = {
            "name": name, "email": email, "password_hash": hash_password(DEMO_PASSWORD),
            "role": role, "phone": "9800000000", "district": district,
            "created_at": datetime.utcnow(),
        }
        result = db.users.insert_one(doc)
        users[email] = str(result.inserted_id)
    print(f"  {len(users)} users created")

    farmer_id = users["farmer@pashuraksha.demo"]

    print("Seeding farms + animals...")
    farms = {}
    animals_by_farm = {}
    for village, (lat, lon, district) in VILLAGES.items():
        for i in range(3):
            jitter_lat = lat + (i * 0.006)
            jitter_lon = lon + (i * 0.004)
            farm_doc = {
                "farmer_id": farmer_id,
                "farm_name": f"{village.split(' (')[0]} Farm {i+1}",
                "village": village, "block": village.split(" (")[0], "district": district,
                "location": geojson_point(jitter_lon, jitter_lat),
                "livestock_count": 8 + i * 3,
                "created_at": datetime.utcnow(),
            }
            fr = db.farms.insert_one(farm_doc)
            farm_id = str(fr.inserted_id)
            farms[(village, i)] = (farm_id, jitter_lat, jitter_lon, district)

            animals_by_farm[farm_id] = []
            for a in range(3):
                species = "cattle" if a % 2 == 0 else "goat"
                animal_doc = {
                    "farm_id": farm_id, "tag_id": f"TAG-{village[:2]}{i}{a}",
                    "species": species, "breed": "local", "age_months": 24 + a * 6,
                    "sex": "female", "health_status": "HEALTHY", "created_at": datetime.utcnow(),
                }
                ar = db.animals.insert_one(animal_doc)
                animals_by_farm[farm_id].append((str(ar.inserted_id), species))
    print(f"  {len(farms)} farms, {sum(len(v) for v in animals_by_farm.values())} animals created")

    print("Submitting disease report cluster (Village A + B) to trigger outbreak detection...")
    cluster_farms = [k for k in farms if "Village A" in k[0] or "Village B" in k[0]]
    farmer_ctx = {"id": farmer_id, "role": "FARMER", "email": "farmer@pashuraksha.demo"}
    cluster_symptoms = ["fever", "skin_lesions", "reduced_appetite"]

    submitted = 0
    for i, key in enumerate(cluster_farms[:5]):
        farm_id, lat, lon, district = farms[key]
        animal_id, species = animals_by_farm[farm_id][0]
        payload = ReportIn(
            animal_id=animal_id, farm_id=farm_id, species=species,
            symptoms=cluster_symptoms, symptom_duration_days=3 + i,
            severity="severe" if i % 2 == 0 else "moderate",
            affected_head_count=2 + i, mortality_count=1 if i >= 3 else 0,
            vaccination_status="unvaccinated",
            latitude=lat, longitude=lon, village=key[0], district=district,
            notes="Seed cluster case for outbreak demo",
        )
        result = submit_report(payload, farmer_ctx)
        submitted += 1
        print(f"    Case {submitted}: risk={result['risk_assessment']['risk_level']} "
              f"outbreak={'YES' if result['outbreak'] else 'no'}")

    print("Submitting isolated low-risk report (Village C, should NOT trigger outbreak)...")
    farm_id, lat, lon, district = farms[("Village C (Naigaon)", 0)]
    animal_id, species = animals_by_farm[farm_id][0]
    payload = ReportIn(
        animal_id=animal_id, farm_id=farm_id, species=species,
        symptoms=["lethargy"], symptom_duration_days=1, severity="mild",
        affected_head_count=1, mortality_count=0, vaccination_status="vaccinated",
        latitude=lat, longitude=lon, village="Village C (Naigaon)", district=district,
        notes="Isolated mild case",
    )
    result = submit_report(payload, farmer_ctx)
    print(f"    Isolated case: risk={result['risk_assessment']['risk_level']} "
          f"outbreak={'YES' if result['outbreak'] else 'no'}")

    print("\nSeed complete.")
    print(f"  Users: {db.users.count_documents({})}")
    print(f"  Farms: {db.farms.count_documents({})}")
    print(f"  Animals: {db.animals.count_documents({})}")
    print(f"  Disease reports: {db.disease_reports.count_documents({})}")
    print(f"  Cases: {db.cases.count_documents({})}")
    print(f"  Outbreaks: {db.outbreaks.count_documents({})}")
    print(f"  Alerts: {db.alerts.count_documents({})}")
    return db


if __name__ == "__main__":
    seed()
