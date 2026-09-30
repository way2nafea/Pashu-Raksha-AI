from datetime import datetime
import logging
import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr

from app.core.db import get_db
from app.core.security import verify_password, create_access_token, get_current_user, hash_password
from app.core.utils import serialize, write_audit
from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["Auth"])
logger = logging.getLogger("pashurakshak.auth")


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: str = ""
    district: str = ""


class GoogleLoginIn(BaseModel):
    credential: str


@router.post("/register", response_model=LoginResponse)
def register(payload: RegisterIn):
    """Public self-registration.

    This is the only way a brand-new, empty database gets its first users —
    there is intentionally no seeded/demo account. Two rules keep this safe:

    1. Every self-registered account is a FARMER. Farmers are the only role
       the public should be able to sign up as directly (matches real-world
       practice: field staff and government accounts are provisioned by an
       administrator, not open self-signup — see docs/rbac.md).
    2. Bootstrap exception: if the `users` collection is completely empty
       (a genuinely fresh database), the very first registration is made
       SUPER_ADMIN instead of FARMER. That one admin can then create
       FIELD_WORKER / VETERINARIAN / LAB_STAFF / DISTRICT_ADMIN / STATE_ADMIN
       accounts via POST /users, exactly as RBAC intends. Once any user
       exists, this bootstrap path closes automatically and every further
       registration is a normal FARMER account.
    """
    db = get_db()
    if db.users.find_one({"email": payload.email}):
        raise HTTPException(status_code=409, detail="Email already registered")

    is_first_user_ever = db.users.count_documents({}) == 0
    role = "SUPER_ADMIN" if is_first_user_ever else "FARMER"

    doc = {
        "name": payload.name,
        "email": payload.email,
        "password_hash": hash_password(payload.password),
        "role": role,
        "phone": payload.phone,
        "district": payload.district,
        "created_at": datetime.utcnow(),
    }
    result = db.users.insert_one(doc)
    doc["_id"] = result.inserted_id

    token = create_access_token(str(doc["_id"]), role, payload.email)
    safe_user = serialize(doc)
    safe_user.pop("password_hash", None)
    write_audit(
        db, {"id": str(doc["_id"]), "email": payload.email, "role": role},
        "REGISTER", "user", doc["_id"],
        {"bootstrap_admin": is_first_user_ever},
    )
    return {"access_token": token, "user": safe_user}


@router.post("/google", response_model=LoginResponse)
def google_login(payload: GoogleLoginIn):
    """Verify a Google Identity Services ID token and sign in or create a farmer."""
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google sign-in is not configured yet.")
    try:
        from google.auth.transport import requests as google_requests
        from google.oauth2 import id_token
        claims = id_token.verify_oauth2_token(
            payload.credential, google_requests.Request(), settings.GOOGLE_CLIENT_ID
        )
    except Exception:
        raise HTTPException(status_code=401, detail="Google sign-in could not be verified. Please try again.")

    email = claims.get("email", "").lower().strip()
    if not email or not claims.get("email_verified"):
        raise HTTPException(status_code=401, detail="Google did not provide a verified email address.")

    db = get_db()
    user = db.users.find_one({"email": email})
    if not user:
        is_first_user_ever = db.users.count_documents({}) == 0
        role = "SUPER_ADMIN" if is_first_user_ever else "FARMER"
        doc = {
            "name": claims.get("name") or email.split("@", 1)[0],
            "email": email,
            "password_hash": hash_password(secrets.token_urlsafe(32)),
            "role": role,
            "phone": "",
            "district": "",
            "auth_provider": "google",
            "google_subject": claims.get("sub"),
            "created_at": datetime.utcnow(),
        }
        result = db.users.insert_one(doc)
        doc["_id"] = result.inserted_id
        user = doc
    else:
        db.users.update_one({"_id": user["_id"]}, {"$set": {"auth_provider": "google", "google_subject": claims.get("sub")}})

    token = create_access_token(str(user["_id"]), user["role"], user["email"])
    safe_user = serialize(user)
    safe_user.pop("password_hash", None)
    write_audit(db, {"id": str(user["_id"]), "email": user["email"], "role": user["role"]}, "GOOGLE_LOGIN", "user", user["_id"])
    return {"access_token": token, "user": safe_user}


@router.post("/login", response_model=LoginResponse)
def login(form: OAuth2PasswordRequestForm = Depends()):
    try:
        db = get_db()
        user = db.users.find_one({"email": form.username})
    except Exception:
        logger.exception("User lookup failed during password login")
        raise
    if not user or not verify_password(form.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    token = create_access_token(str(user["_id"]), user["role"], user["email"])
    safe_user = serialize(user)
    safe_user.pop("password_hash", None)
    try:
        write_audit(db, {"id": str(user["_id"]), "email": user["email"], "role": user["role"]}, "LOGIN", "user", user["_id"])
    except Exception:
        logger.exception("Audit write failed during password login")
        raise
    return {"access_token": token, "user": safe_user}


@router.get("/me")
def me(user: dict = Depends(get_current_user)):
    db = get_db()
    from app.core.utils import oid
    doc = db.users.find_one({"_id": oid(user["id"])})
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")
    safe = serialize(doc)
    safe.pop("password_hash", None)
    return safe


@router.post("/logout")
def logout(user: dict = Depends(get_current_user)):
    # Stateless JWT — logout is handled client-side by discarding the token.
    # Endpoint exists for audit logging and future token-blacklist support.
    db = get_db()
    write_audit(db, user, "LOGOUT", "user", user["id"])
    return {"detail": "Logged out"}
