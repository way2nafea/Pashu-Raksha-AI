from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr

from app.core.db import get_db
from app.core.security import require_roles, hash_password, ROLES
from app.core.utils import serialize, serialize_many, write_audit

router = APIRouter(prefix="/users", tags=["Users & Admin"])


class UserIn(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str
    phone: str = ""
    district: str = ""


@router.post("")
def create_user(payload: UserIn, user: dict = Depends(require_roles("SUPER_ADMIN"))):
    if payload.role not in ROLES:
        raise HTTPException(status_code=422, detail=f"role must be one of {ROLES}")
    db = get_db()
    if db.users.find_one({"email": payload.email}):
        raise HTTPException(status_code=409, detail="Email already registered")
    doc = {
        "name": payload.name, "email": payload.email, "password_hash": hash_password(payload.password),
        "role": payload.role, "phone": payload.phone, "district": payload.district,
        "created_at": datetime.utcnow(),
    }
    result = db.users.insert_one(doc)
    doc["_id"] = result.inserted_id
    write_audit(db, user, "CREATE", "user", result.inserted_id, {"role": payload.role})
    safe = serialize(doc)
    safe.pop("password_hash", None)
    return safe


@router.get("")
def list_users(role: str = None, user: dict = Depends(require_roles("SUPER_ADMIN", "STATE_ADMIN", "DISTRICT_ADMIN"))):
    db = get_db()
    query = {"role": role} if role else {}
    docs = list(db.users.find(query))
    out = serialize_many(docs)
    for d in out:
        d.pop("password_hash", None)
    return out
