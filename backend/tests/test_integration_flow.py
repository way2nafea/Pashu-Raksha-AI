"""
Integration test covering the FULL primary workflow:
Farmer Report -> AI Triage -> GIS -> Outbreak -> Alert -> Vet -> Field
Visit -> Treatment -> Lab -> Resolution -> Government Analytics.
"""
from tests.conftest import register_and_login, auth_headers


def test_full_end_to_end_workflow(client):
    farmer_token = register_and_login(client, "Farmer Full", "full-farmer@test.demo", "FARMER")
    vet_token = register_and_login(client, "Vet Full", "full-vet@test.demo", "VETERINARIAN")
    lab_token = register_and_login(client, "Lab Full", "full-lab@test.demo", "LAB_STAFF")
    admin_token = register_and_login(client, "State Full", "full-state@test.demo", "STATE_ADMIN")

    # 1. Farmer creates a farm
    r = client.post("/api/v1/farms", headers=auth_headers(farmer_token), json={
        "farm_name": "Full Flow Farm", "village": "Village X", "block": "Block X",
        "district": "Thane", "latitude": 19.30, "longitude": 72.85, "livestock_count": 10,
    })
    assert r.status_code == 200, r.text
    farm_id = r.json()["id"]

    # 2. Farmer registers an animal
    r = client.post("/api/v1/animals", headers=auth_headers(farmer_token), json={
        "farm_id": farm_id, "tag_id": "TAG-E2E-1", "species": "cattle", "breed": "local", "age_months": 30, "sex": "female",
    })
    assert r.status_code == 200, r.text
    animal_id = r.json()["id"]

    # 3. Farmer submits a HIGH-risk geotagged disease report
    r = client.post("/api/v1/reports", headers=auth_headers(farmer_token), json={
        "animal_id": animal_id, "farm_id": farm_id, "species": "cattle",
        "symptoms": ["fever", "respiratory_difficulty", "nasal_discharge"],
        "symptom_duration_days": 4, "severity": "severe", "affected_head_count": 3,
        "mortality_count": 1, "vaccination_status": "unvaccinated",
        "latitude": 19.30, "longitude": 72.85, "village": "Village X", "district": "Thane",
    })
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["risk_assessment"]["risk_level"] in ("HIGH", "CRITICAL")
    case_id = data["case"]["id"]

    # 4. Alert was generated
    r = client.get("/api/v1/alerts", headers=auth_headers(vet_token))
    assert r.status_code == 200
    assert any(a["case_id"] == case_id for a in r.json())

    # 5. Vet sees the case in the prioritized queue
    r = client.get("/api/v1/cases", headers=auth_headers(vet_token))
    assert r.status_code == 200
    assert any(c["id"] == case_id for c in r.json())

    # 6. Vet views full case detail (farmer, animal, report, outbreak context)
    r = client.get(f"/api/v1/cases/{case_id}", headers=auth_headers(vet_token))
    assert r.status_code == 200
    detail = r.json()
    assert detail["animal"]["id"] == animal_id
    assert detail["report"] is not None

    # 7. Vet assigns case to self and records a field visit
    import json
    me = client.get("/api/v1/auth/me", headers=auth_headers(vet_token)).json()
    r = client.post(f"/api/v1/cases/{case_id}/assign", headers=auth_headers(vet_token), json={"vet_id": me["id"]})
    assert r.status_code == 200

    r = client.post("/api/v1/visits", headers=auth_headers(vet_token), json={
        "case_id": case_id, "observations": "Elevated temperature, labored breathing",
        "symptoms_observed": ["fever", "respiratory_difficulty"], "sample_collected": True,
    })
    assert r.status_code == 200, r.text

    # 8. Vet requests a lab test
    r = client.post("/api/v1/lab/samples", headers=auth_headers(vet_token), json={
        "case_id": case_id, "animal_id": animal_id, "test_type": "PCR", "notes": "Suspected respiratory pathogen",
    })
    assert r.status_code == 200, r.text
    sample_id = r.json()["id"]

    # 9. Lab progresses sample and enters a result, linked back to the case
    for status in ["COLLECTED", "SENT", "RECEIVED", "TESTING"]:
        r = client.post(f"/api/v1/lab/samples/{sample_id}/status", headers=auth_headers(lab_token), json={"status": status})
        assert r.status_code == 200

    r = client.post(f"/api/v1/lab/samples/{sample_id}/result", headers=auth_headers(lab_token), json={
        "result": "Positive - respiratory pathogen detected", "result_notes": "Confirmed via PCR",
    })
    assert r.status_code == 200

    # 10. Vet records diagnosis + treatment and resolves the case
    r = client.post("/api/v1/treatments", headers=auth_headers(vet_token), json={
        "case_id": case_id, "animal_id": animal_id, "diagnosis": "Bovine respiratory infection",
        "medication": "Antibiotic course", "dosage": "As per body weight", "final": True,
    })
    assert r.status_code == 200, r.text

    r = client.get(f"/api/v1/cases/{case_id}", headers=auth_headers(vet_token))
    assert r.json()["status"] == "RESOLVED"

    # 11. Government dashboard reflects the case
    r = client.get("/api/v1/dashboard/overview", headers=auth_headers(admin_token))
    assert r.status_code == 200
    overview = r.json()
    assert overview["totals"]["farms"] >= 1
    assert overview["totals"]["resolved_cases"] >= 1

    r = client.get("/api/v1/gis/map-data", headers=auth_headers(admin_token))
    assert r.status_code == 200
    assert len(r.json()["cases"]) >= 1
