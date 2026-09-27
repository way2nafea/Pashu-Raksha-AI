"""
Alert Engine.

Prototype alert delivery is in-app only (stored in the alerts collection and
surfaced via GET /api/v1/alerts). The `channel` field and this module's
structure are designed so a push layer (Firebase Cloud Messaging) or SMS
gateway can be plugged in later without changing callers — see
create_alert()'s single call site pattern.
"""
from datetime import datetime


def create_alert(db, alert_type: str, priority: str, title: str, message: str,
                  case_id: str = None, district: str = None, outbreak_id: str = None):
    doc = {
        "type": alert_type,
        "priority": priority,  # LOW | MEDIUM | HIGH | CRITICAL
        "title": title,
        "message": message,
        "case_id": case_id,
        "outbreak_id": outbreak_id,
        "district": district,
        "channel": "IN_APP",  # future: PUSH_FCM, SMS
        "acknowledged": False,
        "created_at": datetime.utcnow(),
    }
    result = db.alerts.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc
