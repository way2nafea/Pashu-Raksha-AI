from datetime import datetime
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.db import get_db
from app.core.security import require_roles, get_current_user
from app.core.utils import serialize, serialize_many, write_audit

router = APIRouter(prefix="/vaccinations", tags=["Vaccinations"])


class VaccinationIn(BaseModel):
    animal_id: str
    vaccine_name: str
    dose: str = "1"
    next_due_date: str | None = None
    notes: str = ""


@router.post("")
def record_vaccination(payload: VaccinationIn, user: dict = Depends(require_roles("FIELD_WORKER", "VETERINARIAN"))):
    db = get_db()
    doc = {**payload.dict(), "administered_by": user["id"], "date": datetime.utcnow()}
    result = db.vaccinations.insert_one(doc)
    doc["_id"] = result.inserted_id
    write_audit(db, user, "CREATE", "vaccination", result.inserted_id, {"animal_id": payload.animal_id})
    return serialize(doc)


@router.get("")
def list_vaccinations(animal_id: str = None, user: dict = Depends(get_current_user)):
    db = get_db()
    query = {"animal_id": animal_id} if animal_id else {}
    return serialize_many(list(db.vaccinations.find(query)))
