from tests.conftest import register_and_login, auth_headers


def test_herd_summary_on_empty_farm_shows_zero_not_fabricated(client):
    farmer_token = register_and_login(client, "Farmer HH1", "farmer-hh1@test.demo", "FARMER")
    r = client.post("/api/v1/farms", headers=auth_headers(farmer_token), json={
        "farm_name": "Empty Herd Farm", "village": "V1", "block": "B1",
        "district": "Pune", "latitude": 18.5, "longitude": 73.8, "livestock_count": 0,
    })
    farm_id = r.json()["id"]

    r = client.get(f"/api/v1/farms/{farm_id}/herd-summary", headers=auth_headers(farmer_token))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total_animals"] == 0
    assert body["healthy_animals"] == 0
    assert body["affected_animals"] == 0
    assert body["active_disease_cases"] == 0
    assert body["vaccination_coverage_pct"] == 0.0
    assert body["mortality_reported"] == 0
    assert body["herd_risk"]["herd_risk_level"] == "INSUFFICIENT_DATA"


def test_herd_summary_reflects_real_records_after_report_and_vaccination(client):
    farmer_token = register_and_login(client, "Farmer HH2", "farmer-hh2@test.demo", "FARMER")
    vet_token = register_and_login(client, "Vet HH2", "vet-hh2@test.demo", "VETERINARIAN")

    r = client.post("/api/v1/farms", headers=auth_headers(farmer_token), json={
        "farm_name": "Real Herd Farm", "village": "V2", "block": "B2",
        "district": "Pune", "latitude": 18.5, "longitude": 73.8, "livestock_count": 2,
    })
    farm_id = r.json()["id"]

    animal_ids = []
    for tag in ["A1", "A2"]:
        r = client.post("/api/v1/animals", headers=auth_headers(farmer_token), json={
            "farm_id": farm_id, "tag_id": tag, "species": "cattle", "breed": "local",
            "age_months": 24, "sex": "female",
        })
        animal_ids.append(r.json()["id"])

    # Vaccinate one of the two animals -> expect 50% coverage
    client.post("/api/v1/vaccinations", headers=auth_headers(vet_token), json={
        "animal_id": animal_ids[0], "vaccine_name": "FMD vaccine",
    })

    # Report a case on the other animal, with mortality
    r = client.post("/api/v1/reports", headers=auth_headers(farmer_token), json={
        "animal_id": animal_ids[1], "farm_id": farm_id, "species": "cattle",
        "symptoms": ["fever", "sudden_mortality"], "symptom_duration_days": 2, "severity": "critical",
        "affected_head_count": 1, "mortality_count": 1, "vaccination_status": "unvaccinated",
        "latitude": 18.5, "longitude": 73.8, "village": "V2", "district": "Pune",
    })
    assert r.status_code == 200, r.text

    r = client.get(f"/api/v1/farms/{farm_id}/herd-summary", headers=auth_headers(farmer_token))
    body = r.json()
    assert body["total_animals"] == 2
    assert body["affected_animals"] == 1
    assert body["healthy_animals"] == 1
    assert body["active_disease_cases"] == 1
    assert body["vaccination_coverage_pct"] == 50.0
    assert body["mortality_reported"] == 1
    assert body["herd_risk"]["herd_risk_level"] in ("HIGH", "CRITICAL", "MODERATE")
    assert len(body["herd_risk"]["reasons"]) > 0
    assert body["disease_category_frequency"]  # non-empty, real distribution
