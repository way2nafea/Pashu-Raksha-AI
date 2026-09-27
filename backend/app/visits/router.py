from datetime import datetime
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.db import get_db
from app.core.security import require_roles, get_current_user
from app.core.utils import serialize, serialize_many, write_audit, oid

router = APIRouter(prefix="/visits", tags=["Field Visits"])


class VisitIn(BaseModel):
    case_id: str
    observations: str
    clinical_notes: str = ""
    symptoms_observed: list[str] = []
    mortality_observed: int = 0
    actions_taken: str = ""
    sample_collected: bool = False
    follow_up_date: str | None = None


@router.post("")
def record_visit(payload: VisitIn, user: dict = Depends(require_roles("VETERINARIAN", "FIELD_WORKER"))):
    db = get_db()
    doc = {**payload.dict(), "recorded_by": user["id"], "visit_date": datetime.utcnow()}
    result = db.field_visits.insert_one(doc)
    doc["_id"] = result.inserted_id
    db.cases.update_one({"_id": oid(payload.case_id)},
                         {"$set": {"status": "FIELD_VISIT", "updated_at": datetime.utcnow()}})
    write_audit(db, user, "CREATE", "field_visit", result.inserted_id, {"case_id": payload.case_id})
    return serialize(doc)


@router.get("")
def list_visits(case_id: str = None, user: dict = Depends(get_current_user)):
    db = get_db()
    query = {"case_id": case_id} if case_id else {}
    return serialize_many(list(db.field_visits.find(query)))
