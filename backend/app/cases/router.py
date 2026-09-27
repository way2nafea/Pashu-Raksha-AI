from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.db import get_db
from app.core.security import get_current_user, require_roles
from app.core.utils import serialize, serialize_many, write_audit, oid
from app.gis.service import find_within_radius
from app.core.config import settings

router = APIRouter(prefix="/cases", tags=["Cases"])

VALID_STATUSES = [
    "REPORTED", "AI_TRIAGE", "VET_ASSIGNED", "FIELD_VISIT",
    "DIAGNOSIS_LAB_TEST", "TREATMENT", "FOLLOW_UP", "RESOLVED", "ESCALATED",
]

_RISK_ORDER = {"CRITICAL": 0, "HIGH": 1, "MODERATE": 2, "LOW": 3}


@router.get("")
def list_cases(status: str = None, district: str = None, assigned_to_me: bool = False,
               user: dict = Depends(require_roles("VETERINARIAN", "FIELD_WORKER", "DISTRICT_ADMIN", "STATE_ADMIN", "SUPER_ADMIN"))):
    db = get_db()
    query = {}
    if status:
        query["status"] = status
    if district:
        query["district"] = district
    if assigned_to_me:
        if user["role"] == "FIELD_WORKER":
            query["assigned_field_worker_id"] = user["id"]
        elif user["role"] == "VETERINARIAN":
            query["assigned_vet_id"] = user["id"]
    docs = list(db.cases.find(query))
    # Prioritize by AI risk, then recency (temporal urgency)
    docs.sort(key=lambda d: (_RISK_ORDER.get(d.get("risk_level"), 4), -(d.get("created_at") or datetime.min).timestamp()))
    return serialize_many(docs)


@router.get("/nearby")
def nearby_cases(latitude: float, longitude: float, radius_km: float = None,
                  user: dict = Depends(require_roles("VETERINARIAN", "FIELD_WORKER", "DISTRICT_ADMIN", "STATE_ADMIN", "SUPER_ADMIN"))):
    db = get_db()
    radius = radius_km or settings.NEARBY_CASE_RADIUS_KM
    all_cases = list(db.cases.find({}))
    fake_loc = {"type": "Point", "coordinates": [longitude, latitude]}
    nearby = find_within_radius(all_cases, fake_loc, radius)
    return serialize_many(nearby)


@router.get("/{case_id}")
def get_case_detail(case_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    case = db.cases.find_one({"_id": oid(case_id)})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    animal = db.animals.find_one({"_id": oid(case["animal_id"])}) if case.get("animal_id") else None
    farm = db.farms.find_one({"_id": oid(case["farm_id"])}) if case.get("farm_id") else None
    report = db.disease_reports.find_one({"_id": oid(case["report_id"])}) if case.get("report_id") else None
    farmer = db.users.find_one({"_id": oid(case["farmer_id"])}) if case.get("farmer_id") else None
    visits = list(db.field_visits.find({"case_id": case_id}))
    treatments = list(db.treatments.find({"case_id": case_id}))
    samples = list(db.samples.find({"case_id": case_id}))
    outbreak = db.outbreaks.find_one({"_id": oid(case["outbreak_id"])}) if case.get("outbreak_id") else None

    detail = serialize(case)
    detail["animal"] = serialize(animal)
    detail["farm"] = serialize(farm)
    detail["report"] = serialize(report)
    detail["farmer"] = {k: v for k, v in (serialize(farmer) or {}).items() if k != "password_hash"} if farmer else None
    detail["field_visits"] = serialize_many(visits)
    detail["treatments"] = serialize_many(treatments)
    detail["samples"] = serialize_many(samples)
    detail["outbreak"] = serialize(outbreak)
    return detail


class AssignIn(BaseModel):
    vet_id: str


@router.post("/{case_id}/assign")
def assign_case(case_id: str, payload: AssignIn,
                 user: dict = Depends(require_roles("VETERINARIAN", "DISTRICT_ADMIN", "STATE_ADMIN", "SUPER_ADMIN"))):
    db = get_db()
    db.cases.update_one({"_id": oid(case_id)},
                         {"$set": {"assigned_vet_id": payload.vet_id, "status": "VET_ASSIGNED", "updated_at": datetime.utcnow()}})
    write_audit(db, user, "ASSIGN", "case", case_id, {"vet_id": payload.vet_id})
    return {"detail": "Case assigned"}


class AssignFieldWorkerIn(BaseModel):
    field_worker_id: str


@router.post("/{case_id}/assign-field-worker")
def assign_field_worker(case_id: str, payload: AssignFieldWorkerIn,
                         user: dict = Depends(require_roles("VETERINARIAN", "DISTRICT_ADMIN", "STATE_ADMIN", "SUPER_ADMIN"))):
    """Explicit field-worker task assignment (SIH Round-2 requirement: field
    workers need real assigned tasks, not just visibility into the shared
    queue). This is additive — it does not remove the existing shared-queue
    visibility FIELD_WORKER already has via GET /cases (see docs/rbac.md),
    it adds a way to make an assignment explicit and filterable so the
    dedicated Field Worker dashboard can show "My Tasks" vs "Unassigned
    nearby cases"."""
    db = get_db()
    if not db.cases.find_one({"_id": oid(case_id)}):
        raise HTTPException(status_code=404, detail="Case not found")
    db.cases.update_one({"_id": oid(case_id)},
                         {"$set": {"assigned_field_worker_id": payload.field_worker_id, "updated_at": datetime.utcnow()}})
    write_audit(db, user, "ASSIGN_FIELD_WORKER", "case", case_id, {"field_worker_id": payload.field_worker_id})
    return {"detail": "Field worker assigned"}


class StatusIn(BaseModel):
    status: str


@router.post("/{case_id}/status")
def update_status(case_id: str, payload: StatusIn, user: dict = Depends(require_roles("VETERINARIAN", "DISTRICT_ADMIN", "STATE_ADMIN", "SUPER_ADMIN"))):
    if payload.status not in VALID_STATUSES:
        raise HTTPException(status_code=422, detail=f"Invalid status. Must be one of {VALID_STATUSES}")
    db = get_db()
    if not db.cases.find_one({"_id": oid(case_id)}):
        raise HTTPException(status_code=404, detail="Case not found")
    db.cases.update_one({"_id": oid(case_id)}, {"$set": {"status": payload.status, "updated_at": datetime.utcnow()}})
    write_audit(db, user, "STATUS_CHANGE", "case", case_id, {"status": payload.status})
    return {"detail": f"Case status updated to {payload.status}"}
