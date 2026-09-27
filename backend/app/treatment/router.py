from datetime import datetime
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.db import get_db
from app.core.security import require_roles, get_current_user
from app.core.utils import serialize, serialize_many, write_audit, oid

router = APIRouter(prefix="/treatments", tags=["Diagnosis & Treatment"])


class TreatmentIn(BaseModel):
    case_id: str
    animal_id: str
    diagnosis: str
    medication: str = ""
    dosage: str = ""
    treatment_notes: str = ""
    follow_up_date: str | None = None
    final: bool = False


@router.post("")
def record_treatment(payload: TreatmentIn, user: dict = Depends(require_roles("VETERINARIAN"))):
    db = get_db()
    doc = {**payload.dict(), "recorded_by": user["id"], "start_date": datetime.utcnow()}
    result = db.treatments.insert_one(doc)
    doc["_id"] = result.inserted_id

    db.cases.update_one({"_id": oid(payload.case_id)}, {"$set": {
        "status": "RESOLVED" if payload.final else "TREATMENT",
        "diagnosis": payload.diagnosis,
        "updated_at": datetime.utcnow(),
    }})
    write_audit(db, user, "CREATE", "treatment", result.inserted_id, {"case_id": payload.case_id})
    return serialize(doc)


@router.get("")
def list_treatments(case_id: str = None, animal_id: str = None, user: dict = Depends(get_current_user)):
    db = get_db()
    query = {}
    if case_id:
        query["case_id"] = case_id
    if animal_id:
        query["animal_id"] = animal_id
    return serialize_many(list(db.treatments.find(query)))
