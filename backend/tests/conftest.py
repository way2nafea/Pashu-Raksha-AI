import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from fastapi.testclient import TestClient

from app.core.db import get_db, reset_db
from app.main import app

COLLECTIONS = [
    "users", "farms", "animals", "disease_reports", "cases",
    "risk_scores", "outbreaks", "alerts", "field_visits",
    "treatments", "samples", "vaccinations", "audit_logs"
]


def _clean_all_collections():
    try:
        db = get_db()
        for col in COLLECTIONS:
            db[col].delete_many({})
    except Exception:
        pass


@pytest.fixture(autouse=True)
def clean_database():
    _clean_all_collections()
    yield
    _clean_all_collections()


@pytest.fixture()
def client():
    _clean_all_collections()
    return TestClient(app)


def register_and_login(client, name, email, role, password="Demo@123"):
    """Directly insert a user (bypassing the SUPER_ADMIN-only endpoint) for test setup."""
    from app.core.db import get_db
    from app.core.security import hash_password
    db = get_db()
    db.users.delete_many({"email": email})
    doc = {"name": name, "email": email, "password_hash": hash_password(password),
           "role": role, "phone": "", "district": "Thane"}
    from datetime import datetime
    doc["created_at"] = datetime.utcnow()
    db.users.insert_one(doc)
    resp = client.post("/api/v1/auth/login", data={"username": email, "password": password})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}
