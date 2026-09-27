from fastapi import APIRouter, Depends
from app.core.db import get_db
from app.core.security import get_current_user
from app.core.utils import serialize_many, oid

router = APIRouter(prefix="/alerts", tags=["Alerts"])


@router.get("")
def list_alerts(district: str = None, user: dict = Depends(get_current_user)):
    db = get_db()
    query = {"district": district} if district else {}
    docs = list(db.alerts.find(query).sort("created_at", -1))
    return serialize_many(docs)


@router.post("/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    db.alerts.update_one({"_id": oid(alert_id)}, {"$set": {"acknowledged": True}})
    return {"detail": "Alert acknowledged"}
