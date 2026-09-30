"""
Database connection layer.

Uses mongomock (an in-memory, drop-in-compatible implementation of the
pymongo API) when no MONGODB_URI is configured, so the entire prototype
runs without any external database. When MONGODB_URI is set, real pymongo
connects to MongoDB Atlas and 2dsphere geo indexes are created for real.

IMPORTANT: mongomock does not implement MongoDB's $near / $geoWithin
geospatial operators, so this codebase never relies on server-side geo
operators. Instead app/gis/service.py implements geo-proximity queries in
Python using the haversine formula over lat/lon fields that are stored
redundantly alongside the GeoJSON location for this reason. In production,
this can be swapped for a native $geoNear aggregation once evaluated against
a real Atlas cluster with 2dsphere indexes (see docs/database.md).
"""
from app.core.config import settings

import logging

logger = logging.getLogger("pashurakshak.database")
_client = None
_db = None


def _make_client():
    global _client
    if settings.DEMO_MODE:
        import mongomock
        _client = mongomock.MongoClient()
    else:
        from pymongo import MongoClient
        _client = MongoClient(settings.MONGODB_URI, serverSelectionTimeoutMS=5000)
    return _client


def get_db():
    global _db
    if _db is None:
        client = _make_client()
        _db = client[settings.MONGODB_DB]
        _ensure_indexes(_db)
    return _db


def _ensure_indexes(db):
    """Create indexes. 2dsphere indexes only created against real Mongo,
    since mongomock's geo index support is unreliable; demo-mode geo
    queries use the manual haversine layer instead (see module docstring)."""
    db.users.create_index("email", unique=True)
    db.animals.create_index("tag_id")
    db.disease_reports.create_index("farm_id")
    db.cases.create_index("status")
    db.cases.create_index("risk_level")

    if not settings.DEMO_MODE:
        try:
            db.farms.create_index([("location", "2dsphere")])
            db.disease_reports.create_index([("location", "2dsphere")])
            db.outbreaks.create_index([("center", "2dsphere")])
        except Exception:
            pass


def reset_db():
    """Used by tests / seed script to get a clean demo-mode database."""
    global _db, _client
    _db = None
    _client = None
    return get_db()


def database_connected() -> bool | None:
    """Return connectivity for persistent storage, or None in demo mode."""
    if settings.DEMO_MODE:
        return None
    try:
        get_db().command("ping")
    except Exception:
        logger.exception("MongoDB connectivity check failed")
        return False
    return True
