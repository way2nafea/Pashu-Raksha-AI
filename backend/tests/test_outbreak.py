from app.core.db import get_db
from app.gis.service import geojson_point
from app.reports.router import ReportIn, submit_report


def _farmer_ctx(user_id):
    return {"id": user_id, "role": "FARMER", "email": "f@test.demo"}


def _make_farm_and_animal(db, farmer_id, lat, lon, district="Thane"):
    farm = db.farms.insert_one({
        "farmer_id": farmer_id, "farm_name": "F", "village": "V", "block": "B",
        "district": district, "location": geojson_point(lon, lat), "livestock_count": 5,
    })
    animal = db.animals.insert_one({"farm_id": str(farm.inserted_id), "tag_id": "T1", "species": "cattle"})
    return str(farm.inserted_id), str(animal.inserted_id)


def test_no_outbreak_below_threshold(client):
    from app.core.security import hash_password
    from datetime import datetime
    db = get_db()
    farmer = db.users.insert_one({"name": "F", "email": "of1@test.demo", "password_hash": hash_password("x"),
                                   "role": "FARMER", "created_at": datetime.utcnow()})
    farmer_id = str(farmer.inserted_id)
    farm_id, animal_id = _make_farm_and_animal(db, farmer_id, 19.30, 72.85)

    payload = ReportIn(animal_id=animal_id, farm_id=farm_id, species="cattle",
                        symptoms=["fever"], symptom_duration_days=2, severity="moderate",
                        affected_head_count=1, mortality_count=0, vaccination_status="unknown",
                        latitude=19.30, longitude=72.85, village="V", district="Thane")
    result = submit_report(payload, _farmer_ctx(farmer_id))
    assert result["outbreak"] is None


def test_outbreak_triggers_at_threshold(client):
    from app.core.security import hash_password
    from datetime import datetime
    db = get_db()
    farmer = db.users.insert_one({"name": "F", "email": "of2@test.demo", "password_hash": hash_password("x"),
                                   "role": "FARMER", "created_at": datetime.utcnow()})
    farmer_id = str(farmer.inserted_id)

    last_result = None
    for i in range(3):
        farm_id, animal_id = _make_farm_and_animal(db, farmer_id, 19.30 + i * 0.01, 72.85 + i * 0.01)
        payload = ReportIn(animal_id=animal_id, farm_id=farm_id, species="cattle",
                            symptoms=["fever", "skin_lesions"], symptom_duration_days=2, severity="severe",
                            affected_head_count=2, mortality_count=0, vaccination_status="unvaccinated",
                            latitude=19.30 + i * 0.01, longitude=72.85 + i * 0.01, village="V", district="Thane")
        last_result = submit_report(payload, _farmer_ctx(farmer_id))

    assert last_result["outbreak"] is not None
    assert last_result["outbreak"]["case_count"] >= 3


def test_distant_reports_do_not_cluster(client):
    from app.core.security import hash_password
    from datetime import datetime
    db = get_db()
    farmer = db.users.insert_one({"name": "F", "email": "of3@test.demo", "password_hash": hash_password("x"),
                                   "role": "FARMER", "created_at": datetime.utcnow()})
    farmer_id = str(farmer.inserted_id)

    # 3 reports, but each > 100km apart -> should never cluster
    coords = [(19.30, 72.85), (28.61, 77.20), (13.08, 80.27)]
    last_result = None
    for lat, lon in coords:
        farm_id, animal_id = _make_farm_and_animal(db, farmer_id, lat, lon)
        payload = ReportIn(animal_id=animal_id, farm_id=farm_id, species="cattle",
                            symptoms=["fever", "skin_lesions"], symptom_duration_days=2, severity="severe",
                            affected_head_count=2, mortality_count=0, vaccination_status="unvaccinated",
                            latitude=lat, longitude=lon, village="V", district="X")
        last_result = submit_report(payload, _farmer_ctx(farmer_id))

    assert last_result["outbreak"] is None
