from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.db import get_db
from app.core.security import require_roles, get_current_user
from app.core.utils import serialize, serialize_many, write_audit, oid

router = APIRouter(prefix="/lab", tags=["Laboratory"])

SAMPLE_STATUSES = ["REQUESTED", "COLLECTED", "SENT", "RECEIVED", "TESTING", "RESULT_AVAILABLE"]
TEST_TYPES = ["PCR", "ELISA", "MICROSCOPY"]


class SampleRequestIn(BaseModel):
    case_id: str
    animal_id: str
    test_type: str
    notes: str = ""


@router.post("/samples")
def request_sample(payload: SampleRequestIn, user: dict = Depends(require_roles("VETERINARIAN"))):
    if payload.test_type not in TEST_TYPES:
        raise HTTPException(status_code=422, detail=f"test_type must be one of {TEST_TYPES}")
    db = get_db()
    doc = {**payload.dict(), "status": "REQUESTED", "requested_by": user["id"],
           "result": None, "created_at": datetime.utcnow(), "updated_at": datetime.utcnow()}
    result = db.samples.insert_one(doc)
    doc["_id"] = result.inserted_id
    db.cases.update_one({"_id": oid(payload.case_id)}, {"$set": {"status": "DIAGNOSIS_LAB_TEST", "updated_at": datetime.utcnow()}})
    write_audit(db, user, "CREATE", "sample", result.inserted_id, {"case_id": payload.case_id})
    return serialize(doc)


@router.get("/samples")
def list_samples(status: str = None, case_id: str = None,
                  user: dict = Depends(require_roles("LAB_STAFF", "VETERINARIAN", "FIELD_WORKER", "DISTRICT_ADMIN", "STATE_ADMIN", "SUPER_ADMIN"))):
    db = get_db()
    query = {}
    if status:
        query["status"] = status
    if case_id:
        query["case_id"] = case_id
    return serialize_many(list(db.samples.find(query)))


class SampleStatusIn(BaseModel):
    status: str


@router.post("/samples/{sample_id}/status")
def update_sample_status(sample_id: str, payload: SampleStatusIn,
                          user: dict = Depends(require_roles("LAB_STAFF", "FIELD_WORKER"))):
    if payload.status not in SAMPLE_STATUSES:
        raise HTTPException(status_code=422, detail=f"status must be one of {SAMPLE_STATUSES}")
    # Field workers physically collect and dispatch samples in the field, but
    # custody from here onward (RECEIVED/TESTING/RESULT_AVAILABLE) is a lab
    # responsibility only — matches docs/rbac.md's "samples" scope for
    # FIELD_WORKER without touching the Lab workflow's own authority.
    if user["role"] == "FIELD_WORKER" and payload.status not in ("COLLECTED", "SENT"):
        raise HTTPException(status_code=403, detail="Field workers may only mark samples COLLECTED or SENT")
    db = get_db()
    db.samples.update_one({"_id": oid(sample_id)}, {"$set": {"status": payload.status, "updated_at": datetime.utcnow()}})
    write_audit(db, user, "STATUS_CHANGE", "sample", sample_id, {"status": payload.status})
    return {"detail": "Sample status updated"}


class ResultIn(BaseModel):
    result: str
    result_notes: str = ""


@router.post("/samples/{sample_id}/result")
def record_result(sample_id: str, payload: ResultIn, user: dict = Depends(require_roles("LAB_STAFF"))):
    db = get_db()
    sample = db.samples.find_one({"_id": oid(sample_id)})
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")
    db.samples.update_one({"_id": oid(sample_id)}, {"$set": {
        "status": "RESULT_AVAILABLE", "result": payload.result,
        "result_notes": payload.result_notes, "updated_at": datetime.utcnow(),
    }})
    db.cases.update_one({"_id": oid(sample["case_id"])}, {"$set": {"lab_result": payload.result, "updated_at": datetime.utcnow()}})
    write_audit(db, user, "UPDATE", "sample_result", sample_id, {"result": payload.result})
    return {"detail": "Result recorded and linked to case"}
