"""
This sandbox's network egress does not reach api.open-meteo.com, so these
tests exercise both real paths available to us:
  1. The actual graceful-failure path (no network) — must never raise and
     must never fabricate weather.
  2. The response-parsing logic against a mocked HTTP response, so the
     Open-Meteo response-shape handling itself is verified without a live
     network call.
"""
import httpx
import pytest

from app.weather import service as weather_service
from app.weather import router as weather_router
from app.reports import router as reports_router
from tests.conftest import register_and_login, auth_headers


def test_get_weather_with_no_coordinates_is_unavailable():
    result = weather_service.get_weather(None, None)
    assert result["available"] is False
    assert "reason" in result


def test_get_weather_gracefully_handles_unreachable_network(monkeypatch):
    def fail_get(*args, **kwargs):
        raise httpx.ConnectError("network unavailable")

    monkeypatch.setattr(httpx, "get", fail_get)
    result = weather_service.get_weather(19.07, 72.87)
    assert result["available"] is False
    assert "reason" in result


def test_get_weather_parses_a_successful_mocked_response(monkeypatch):
    fake_payload = {
        "current": {
            "temperature_2m": 29.4,
            "relative_humidity_2m": 82,
            "precipitation": 1.2,
            "weather_code": 61,
        },
        "daily": {
            "time": ["2026-09-06", "2026-09-07", "2026-09-08"],
            "temperature_2m_max": [31.0, 30.5, 29.8],
            "temperature_2m_min": [24.0, 23.5, 23.1],
            "precipitation_sum": [2.0, 0.0, 5.4],
        },
    }

    class FakeResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return fake_payload

    def fake_get(url, params=None, timeout=None):
        assert "open-meteo.com" in url
        return FakeResponse()

    monkeypatch.setattr(httpx, "get", fake_get)

    result = weather_service.get_weather(19.07, 72.87)
    assert result["available"] is True
    assert result["current"]["temperature_c"] == 29.4
    assert result["current"]["humidity_pct"] == 82
    assert result["current"]["condition"] == "Slight rain"
    assert len(result["forecast_3day"]) == 3

    note = weather_service.weather_disease_risk_note(result)
    assert note["risk_bonus_points"] > 0  # high humidity + precipitation both trigger


def test_weather_disease_risk_note_is_zero_when_unavailable():
    note = weather_service.weather_disease_risk_note({"available": False, "reason": "x"})
    assert note["risk_bonus_points"] == 0

def test_get_weather_parses_google_weather_and_air_quality(monkeypatch):
    monkeypatch.setattr(weather_service.settings, "GOOGLE_MAPS_API_KEY", "test-google-key")

    class FakeResponse:
        def __init__(self, payload):
            self.payload = payload

        def raise_for_status(self):
            pass

        def json(self):
            return self.payload

    def fake_get(url, params=None, timeout=None):
        if "currentConditions" in url:
            return FakeResponse({
                        "weatherCondition": {"description": {"text": "Sunny"}, "type": "CLEAR"},
                        "temperature": {"degrees": 37, "unit": "CELSIUS"},
                        "feelsLikeTemperature": {"degrees": 39, "unit": "CELSIUS"},
                        "heatIndex": {"degrees": 40, "unit": "CELSIUS"},
                        "relativeHumidity": 82, "uvIndex": 8,
                        "precipitation": {"qpf": {"quantity": 0}, "probability": {"percent": 5}},
                        "wind": {"speed": {"value": 12}, "direction": {"cardinal": "WEST"}},
            })
        return FakeResponse({"forecastDays": [{
                    "displayDate": {"year": 2026, "month": 9, "day": 7},
                    "daytimeForecast": {"weatherCondition": {"description": {"text": "Sunny"}}, "relativeHumidity": 70, "uvIndex": 7},
                    "maxTemperature": {"degrees": 38}, "minTemperature": {"degrees": 26},
            }]})

    def fake_post(url, params=None, json=None, timeout=None):
        return FakeResponse({
                    "indexes": [{"code": "uaqi", "aqi": 125, "category": "Poor air quality", "dominantPollutant": "pm25"}],
                    "pollutants": [{"code": "pm25", "fullName": "Fine particles", "concentration": {"value": 55, "units": "MICROGRAMS_PER_CUBIC_METER"}}],
                    "healthRecommendations": {"generalPopulation": "Reduce prolonged outdoor exertion."},
            })

    monkeypatch.setattr(httpx, "get", fake_get)
    monkeypatch.setattr(httpx, "post", fake_post)
    result = weather_service.get_weather(19.07, 72.87)

    assert result["source"].startswith("Google Maps Platform")
    assert result["current"]["heat_index_c"] == 40
    assert result["air_quality"]["aqi"] == 125
    assert result["air_quality"]["pollutants"]["pm25"]["value"] == 55
    assert result["animal_health"]["risk_level"] == "ELEVATED"

def test_weather_endpoint_requires_auth(client):
    r = client.get("/api/v1/weather?latitude=19.0&longitude=73.0")
    assert r.status_code == 401


def test_weather_endpoint_returns_unavailable_state_not_error(client, monkeypatch):
    unavailable = lambda latitude, longitude: {"available": False, "reason": "test outage"}
    monkeypatch.setattr(weather_router, "get_weather", unavailable)
    token = register_and_login(client, "Farmer WX1", "farmer-wx1@test.demo", "FARMER")
    r = client.get("/api/v1/weather?latitude=19.0&longitude=73.0", headers=auth_headers(token))
    assert r.status_code == 200
    assert r.json()["available"] is False


def test_report_submission_stores_weather_snapshot_even_when_unavailable(client, monkeypatch):
    monkeypatch.setattr(reports_router, "get_weather", lambda latitude, longitude: {"available": False, "reason": "test outage"})
    farmer_token = register_and_login(client, "Farmer WX2", "farmer-wx2@test.demo", "FARMER")
    r = client.post("/api/v1/farms", headers=auth_headers(farmer_token), json={
        "farm_name": "WX Test Farm", "village": "Village WX2", "block": "Block WX2",
        "district": "Nashik", "latitude": 20.0, "longitude": 73.78, "livestock_count": 8,
    })
    farm_id = r.json()["id"]
    r = client.post("/api/v1/animals", headers=auth_headers(farmer_token), json={
        "farm_id": farm_id, "tag_id": "TAG-WX-2", "species": "cattle", "breed": "local",
        "age_months": 30, "sex": "female",
    })
    animal_id = r.json()["id"]
    r = client.post("/api/v1/reports", headers=auth_headers(farmer_token), json={
        "animal_id": animal_id, "farm_id": farm_id, "species": "cattle",
        "symptoms": ["fever"], "symptom_duration_days": 1, "severity": "mild",
        "affected_head_count": 1, "mortality_count": 0, "vaccination_status": "vaccinated",
        "latitude": 20.0, "longitude": 73.78, "village": "Village WX2", "district": "Nashik",
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert "weather_at_report" in body["report"]
    assert "weather_context" in body["risk_assessment"]
    assert body["case"]["weather_at_report"]["available"] is False  # no network in this sandbox
