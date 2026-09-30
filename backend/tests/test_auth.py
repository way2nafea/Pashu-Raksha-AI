from tests.conftest import register_and_login, auth_headers
from app.core.config import DEVELOPMENT_JWT_SECRET, RENDER_FRONTEND_ORIGIN, settings
from app.main import warn_if_not_persistent
import pytest


def test_login_success(client):
    token = register_and_login(client, "Test Farmer", "f1@test.demo", "FARMER")
    assert token

    r = client.get("/api/v1/auth/me", headers=auth_headers(token))
    assert r.status_code == 200
    assert r.json()["email"] == "f1@test.demo"
    assert "password_hash" not in r.json()


def test_login_wrong_password(client):
    register_and_login(client, "Test Farmer", "f2@test.demo", "FARMER")
    r = client.post("/api/v1/auth/login", data={"username": "f2@test.demo", "password": "wrong"})
    assert r.status_code == 401


def test_rbac_blocks_wrong_role(client):
    farmer_token = register_and_login(client, "Farmer", "f3@test.demo", "FARMER")
    # Farmers cannot list all cases (vet/admin only)
    r = client.get("/api/v1/cases", headers=auth_headers(farmer_token))
    assert r.status_code == 403


def test_rbac_allows_correct_role(client):
    vet_token = register_and_login(client, "Vet", "v1@test.demo", "VETERINARIAN")
    r = client.get("/api/v1/cases", headers=auth_headers(vet_token))
    assert r.status_code == 200


def test_unauthenticated_request_rejected(client):
    r = client.get("/api/v1/auth/me")
    assert r.status_code == 401


def test_render_startup_rejects_demo_database_and_unsafe_settings(monkeypatch):
    monkeypatch.setattr(settings, "IS_RENDER", True)
    monkeypatch.setattr(settings, "DEMO_MODE", True)
    monkeypatch.setattr(settings, "JWT_SECRET", DEVELOPMENT_JWT_SECRET)
    monkeypatch.setattr(settings, "CORS_ORIGINS", ["http://localhost:3000"])

    with pytest.raises(RuntimeError, match="MONGODB_URI, JWT_SECRET, CORS_ORIGINS"):
        warn_if_not_persistent()


def test_render_startup_rejects_example_jwt_secret(monkeypatch):
    monkeypatch.setattr(settings, "IS_RENDER", True)
    monkeypatch.setattr(settings, "DEMO_MODE", False)
    monkeypatch.setattr(settings, "JWT_SECRET", "dev-secret-change-me-in-production")
    monkeypatch.setattr(settings, "CORS_ORIGINS", [RENDER_FRONTEND_ORIGIN])

    with pytest.raises(RuntimeError, match="JWT_SECRET"):
        warn_if_not_persistent()
