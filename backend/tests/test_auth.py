from tests.conftest import register_and_login, auth_headers


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
