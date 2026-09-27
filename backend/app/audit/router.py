from fastapi import APIRouter, Depends
from app.core.db import get_db
from app.core.security import require_roles
from app.core.utils import serialize_many

router = APIRouter(prefix="/audit", tags=["Audit"])


@router.get("")
def list_audit_logs(entity: str = None, user: dict = Depends(require_roles("SUPER_ADMIN", "STATE_ADMIN"))):
    db = get_db()
    query = {"entity": entity} if entity else {}
    docs = list(db.audit_logs.find(query).sort("timestamp", -1).limit(200))
    return serialize_many(docs)
