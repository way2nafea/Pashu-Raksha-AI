from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.db import get_db
from app.core.security import get_current_user, require_roles
from app.core.utils import serialize, serialize_many, write_audit, oid

router = APIRouter(prefix="/animals", tags=["Animals"])


class AnimalIn(BaseModel):
    farm_id: str
    tag_id: str
    species: str
    breed: str = ""
    age_months: int = 0
    sex: str = "female"


@router.post("")
def create_animal(payload: AnimalIn, user: dict = Depends(require_roles("FARMER", "FIELD_WORKER", "SUPER_ADMIN"))):
    db = get_db()
    doc = {
        "farm_id": payload.farm_id,
        "tag_id": payload.tag_id,
        "species": payload.species,
        "breed": payload.breed,
        "age_months": payload.age_months,
        "sex": payload.sex,
        "health_status": "HEALTHY",
        "created_at": datetime.utcnow(),
    }
    result = db.animals.insert_one(doc)
    doc["_id"] = result.inserted_id
    write_audit(db, user, "CREATE", "animal", result.inserted_id)
    return serialize(doc)


@router.get("")
def list_animals(farm_id: str = None, user: dict = Depends(get_current_user)):
    db = get_db()
    query = {"farm_id": farm_id} if farm_id else {}
    return serialize_many(list(db.animals.find(query)))


@router.get("/{animal_id}")
def get_animal_passport(animal_id: str, user: dict = Depends(get_current_user)):
    """Digital health passport: profile + vaccination + treatment + report/case history."""
    db = get_db()
    animal = db.animals.find_one({"_id": oid(animal_id)})
    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found")

    reports = list(db.disease_reports.find({"animal_id": animal_id}))
    cases = list(db.cases.find({"animal_id": animal_id}))
    vaccinations = list(db.vaccinations.find({"animal_id": animal_id}))
    treatments = list(db.treatments.find({"animal_id": animal_id}))

    passport = serialize(animal)
    passport["disease_reports"] = serialize_many(reports)
    passport["cases"] = serialize_many(cases)
    passport["vaccinations"] = serialize_many(vaccinations)
    passport["treatments"] = serialize_many(treatments)
    return passport
