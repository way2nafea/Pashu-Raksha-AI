"""
Test fallback honesty contract: when the ML model artifact is unavailable,
the report/case pipeline must clearly label results as "RULE_BASED_FALLBACK"
rather than silently presenting rule-engine output as if it were ML.
"""
from app.ml import service as ml_service
from tests.conftest import register_and_login, auth_headers


def test_ml_service_reports_unavailable_without_artifact(monkeypatch):
    monkeypatch.setattr(ml_service, "_model", None)
    monkeypatch.setattr(ml_service, "_load_attempted", True)

    result = ml_service.predict({
        "species": "cattle", "symptoms": ["fever"], "severity": "moderate",
        "symptom_duration_days": 2, "affected_head_count": 1, "mortality_count": 0,
        "vaccination_status": "unknown",
    })
    assert result["ml_available"] is False
    assert "reason" in result
    ml_service.reload_model()


def test_report_submission_labels_prediction_as_rule_based_fallback(client, monkeypatch):
    monkeypatch.setattr(ml_service, "_model", None)
    monkeypatch.setattr(ml_service, "_load_attempted", True)

    farmer_token = register_and_login(client, "Farmer ML1", "farmer-ml1@test.demo", "FARMER")
    r = client.post("/api/v1/farms", headers=auth_headers(farmer_token), json={
        "farm_name": "ML Test Farm", "village": "Village ML1", "block": "Block ML1",
        "district": "Pune", "latitude": 18.52, "longitude": 73.85, "livestock_count": 10,
    })
    farm_id = r.json()["id"]
    r = client.post("/api/v1/animals", headers=auth_headers(farmer_token), json={
        "farm_id": farm_id, "tag_id": "TAG-ML-1", "species": "cattle", "breed": "local",
        "age_months": 24, "sex": "female",
    })
    animal_id = r.json()["id"]
    r = client.post("/api/v1/reports", headers=auth_headers(farmer_token), json={
        "animal_id": animal_id, "farm_id": farm_id, "species": "cattle",
        "symptoms": ["fever", "coughing"], "symptom_duration_days": 2, "severity": "moderate",
        "affected_head_count": 1, "mortality_count": 0, "vaccination_status": "unknown",
        "latitude": 18.52, "longitude": 73.85, "village": "Village ML1", "district": "Pune",
    })
    assert r.status_code == 200, r.text
    body = r.json()
    pred = body["risk_assessment"]["disease_prediction"]
    assert pred["engine"] == "RULE_BASED_FALLBACK"
    assert pred["predicted_disease"] is not None
    assert body["case"]["disease_prediction"]["engine"] == "RULE_BASED_FALLBACK"
    ml_service.reload_model()
