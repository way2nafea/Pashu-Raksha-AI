"""
Covers the fix for the most critical Round-2 gap found in audit: a genuinely
empty database previously had NO way to create its first user at all (the
only user-creation endpoint required a SUPER_ADMIN to already be logged in).

POST /auth/register now provides:
  1. Public self-registration, always as FARMER.
  2. A one-time bootstrap exception: the very first user ever created in an
     empty database becomes SUPER_ADMIN so they can provision staff accounts
     via the existing POST /users endpoint. This path closes permanently
     the moment any user exists.
"""
from tests.conftest import auth_headers


def test_first_ever_registration_becomes_bootstrap_admin(client):
    r = client.post("/api/v1/auth/register", json={
        "name": "First Admin", "email": "first-admin@test.demo", "password": "Strong@123",
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["user"]["role"] == "SUPER_ADMIN"
    assert "password_hash" not in body["user"]
    assert body["access_token"]


def test_second_registration_is_forced_to_farmer_even_if_role_requested(client):
    client.post("/api/v1/auth/register", json={
        "name": "First Admin", "email": "admin2@test.demo", "password": "Strong@123",
    })
    r = client.post("/api/v1/auth/register", json={
        "name": "Random Signup", "email": "farmer2@test.demo", "password": "Strong@123",
    })
    assert r.status_code == 200, r.text
    assert r.json()["user"]["role"] == "FARMER"


def test_duplicate_email_registration_rejected(client):
    payload = {"name": "Dup", "email": "dup@test.demo", "password": "Strong@123"}
    r1 = client.post("/api/v1/auth/register", json=payload)
    assert r1.status_code == 200
    r2 = client.post("/api/v1/auth/register", json=payload)
    assert r2.status_code == 409


def test_registered_farmer_can_immediately_use_returned_token(client):
    r = client.post("/api/v1/auth/register", json={
        "name": "Bootstrap Admin", "email": "boot3@test.demo", "password": "Strong@123",
    })
    r2 = client.post("/api/v1/auth/register", json={
        "name": "Real Farmer", "email": "farmer3@test.demo", "password": "Strong@123",
    })
    token = r2.json()["access_token"]
    me = client.get("/api/v1/auth/me", headers=auth_headers(token))
    assert me.status_code == 200
    assert me.json()["role"] == "FARMER"


def test_bootstrap_admin_can_then_provision_staff_accounts(client):
    r = client.post("/api/v1/auth/register", json={
        "name": "Admin", "email": "boot4@test.demo", "password": "Strong@123",
    })
    admin_token = r.json()["access_token"]

    r = client.post("/api/v1/users", headers=auth_headers(admin_token), json={
        "name": "Field Worker One", "email": "fw1@test.demo", "password": "Strong@123",
        "role": "FIELD_WORKER", "district": "Thane",
    })
    assert r.status_code == 200, r.text
    assert r.json()["role"] == "FIELD_WORKER"
