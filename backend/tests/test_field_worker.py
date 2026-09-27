"""
Regression coverage for the report-visibility bug: docs/rbac.md documents
FIELD_WORKER as having case-queue + field-visit access, and the backend
enforces exactly that — but nothing previously tested it end-to-end, which
is how a frontend that never called these endpoints for FIELD_WORKER went
unnoticed.
"""
from tests.conftest import register_and_login, auth_headers


def test_field_worker_sees_new_case_in_queue(client):
    farmer_token = register_and_login(client, "Farmer FW", "farmer-fw@test.demo", "FARMER")
    worker_token = register_and_login(client, "Worker FW", "worker-fw@test.demo", "FIELD_WORKER")

    r = client.post("/api/v1/farms", headers=auth_headers(farmer_token), json={
        "farm_name": "FW Test Farm", "village": "Village FW", "block": "Block FW",
        "district": "Thane", "latitude": 19.30, "longitude": 72.85, "livestock_count": 5,
    })
    assert r.status_code == 200, r.text
    farm_id = r.json()["id"]

    r = client.post("/api/v1/animals", headers=auth_headers(farmer_token), json={
        "farm_id": farm_id, "tag_id": "TAG-FW-1", "species": "cattle", "breed": "local",
        "age_months": 24, "sex": "female",
    })
    assert r.status_code == 200, r.text
    animal_id = r.json()["id"]

    r = client.post("/api/v1/reports", headers=auth_headers(farmer_token), json={
        "animal_id": animal_id, "farm_id": farm_id, "species": "cattle",
        "symptoms": ["fever", "lethargy"], "symptom_duration_days": 2, "severity": "moderate",
        "affected_head_count": 1, "mortality_count": 0, "vaccination_status": "unknown",
        "latitude": 19.30, "longitude": 72.85, "village": "Village FW", "district": "Thane",
    })
    assert r.status_code == 200, r.text
    case_id = r.json()["case"]["id"]

    # Field worker sees it in the shared case queue
    r = client.get("/api/v1/cases", headers=auth_headers(worker_token))
    assert r.status_code == 200
    assert any(c["id"] == case_id for c in r.json())

    # Field worker can open the case detail
    r = client.get(f"/api/v1/cases/{case_id}", headers=auth_headers(worker_token))
    assert r.status_code == 200

    # Field worker can record a field visit
    r = client.post("/api/v1/visits", headers=auth_headers(worker_token), json={
        "case_id": case_id, "observations": "Field worker observed elevated temperature",
    })
    assert r.status_code == 200, r.text


def test_field_worker_cannot_assign_or_change_status(client):
    farmer_token = register_and_login(client, "Farmer FW2", "farmer-fw2@test.demo", "FARMER")
    worker_token = register_and_login(client, "Worker FW2", "worker-fw2@test.demo", "FIELD_WORKER")

    r = client.post("/api/v1/farms", headers=auth_headers(farmer_token), json={
        "farm_name": "FW2 Test Farm", "village": "Village FW2", "block": "Block FW2",
        "district": "Thane", "latitude": 19.31, "longitude": 72.86, "livestock_count": 5,
    })
    farm_id = r.json()["id"]
    r = client.post("/api/v1/animals", headers=auth_headers(farmer_token), json={
        "farm_id": farm_id, "tag_id": "TAG-FW-2", "species": "goat", "breed": "local",
        "age_months": 12, "sex": "female",
    })
    animal_id = r.json()["id"]
    r = client.post("/api/v1/reports", headers=auth_headers(farmer_token), json={
        "animal_id": animal_id, "farm_id": farm_id, "species": "goat",
        "symptoms": ["coughing"], "symptom_duration_days": 1, "severity": "mild",
        "affected_head_count": 1, "mortality_count": 0, "vaccination_status": "vaccinated",
        "latitude": 19.31, "longitude": 72.86, "village": "Village FW2", "district": "Thane",
    })
    case_id = r.json()["case"]["id"]

    r = client.post(f"/api/v1/cases/{case_id}/assign", headers=auth_headers(worker_token),
                     json={"vet_id": "irrelevant"})
    assert r.status_code == 403

    r = client.post(f"/api/v1/cases/{case_id}/status", headers=auth_headers(worker_token),
                     json={"status": "RESOLVED"})
    assert r.status_code == 403


def test_vet_can_assign_field_worker_to_case_and_worker_sees_it_in_my_tasks(client):
    """Covers the new dedicated Field Worker task-assignment flow
    (assigned_field_worker_id + POST /cases/{id}/assign-field-worker +
    GET /cases?assigned_to_me=true), added for the SIH Round-2 requirement
    that field workers get real assigned tasks, not just the shared queue."""
    farmer_token = register_and_login(client, "Farmer FW3", "farmer-fw3@test.demo", "FARMER")
    vet_token = register_and_login(client, "Vet FW3", "vet-fw3@test.demo", "VETERINARIAN")
    worker_token = register_and_login(client, "Worker FW3", "worker-fw3@test.demo", "FIELD_WORKER")
    other_worker_token = register_and_login(client, "Worker FW3b", "worker-fw3b@test.demo", "FIELD_WORKER")

    r = client.post("/api/v1/farms", headers=auth_headers(farmer_token), json={
        "farm_name": "FW3 Test Farm", "village": "Village FW3", "block": "Block FW3",
        "district": "Thane", "latitude": 19.32, "longitude": 72.87, "livestock_count": 5,
    })
    farm_id = r.json()["id"]
    r = client.post("/api/v1/animals", headers=auth_headers(farmer_token), json={
        "farm_id": farm_id, "tag_id": "TAG-FW-3", "species": "cattle", "breed": "local",
        "age_months": 20, "sex": "female",
    })
    animal_id = r.json()["id"]
    r = client.post("/api/v1/reports", headers=auth_headers(farmer_token), json={
        "animal_id": animal_id, "farm_id": farm_id, "species": "cattle",
        "symptoms": ["fever"], "symptom_duration_days": 1, "severity": "moderate",
        "affected_head_count": 1, "mortality_count": 0, "vaccination_status": "unknown",
        "latitude": 19.32, "longitude": 72.87, "village": "Village FW3", "district": "Thane",
    })
    case_id = r.json()["case"]["id"]
    assert r.json()["case"]["assigned_field_worker_id"] is None

    worker_me = client.get("/api/v1/auth/me", headers=auth_headers(worker_token)).json()

    # Field worker cannot self-assign — only vet/admin can (matches vet assignment rules).
    r = client.post(f"/api/v1/cases/{case_id}/assign-field-worker",
                     headers=auth_headers(worker_token), json={"field_worker_id": worker_me["id"]})
    assert r.status_code == 403

    r = client.post(f"/api/v1/cases/{case_id}/assign-field-worker",
                     headers=auth_headers(vet_token), json={"field_worker_id": worker_me["id"]})
    assert r.status_code == 200

    # Assigned worker sees it under "My Tasks"
    r = client.get("/api/v1/cases?assigned_to_me=true", headers=auth_headers(worker_token))
    assert any(c["id"] == case_id for c in r.json())

    # A different field worker does NOT see it under their own "My Tasks"
    r = client.get("/api/v1/cases?assigned_to_me=true", headers=auth_headers(other_worker_token))
    assert not any(c["id"] == case_id for c in r.json())

    # Shared queue visibility is preserved for everyone with case-queue access
    r = client.get("/api/v1/cases", headers=auth_headers(other_worker_token))
    assert any(c["id"] == case_id for c in r.json())
