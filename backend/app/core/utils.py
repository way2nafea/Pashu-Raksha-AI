from datetime import datetime
from bson import ObjectId


def oid(v):
    """Coerce a string to ObjectId for query filters; passthrough otherwise."""
    try:
        return ObjectId(v)
    except Exception:
        return v


def serialize(doc: dict) -> dict:
    """Convert a Mongo document into a JSON-safe dict (ObjectId -> str)."""
    if doc is None:
        return None
    out = {}
    for k, v in doc.items():
        if isinstance(v, ObjectId):
            out[k] = str(v)
        elif isinstance(v, list):
            out[k] = [str(i) if isinstance(i, ObjectId) else i for i in v]
        elif isinstance(v, datetime):
            out[k] = v.isoformat() + "Z"
        else:
            out[k] = v
    if "_id" in out:
        out["id"] = out.pop("_id")
    return out


def serialize_many(docs) -> list:
    return [serialize(d) for d in docs]


def write_audit(db, user: dict, action: str, entity: str, entity_id=None, metadata: dict = None):
    db.audit_logs.insert_one({
        "user_id": user.get("id"),
        "user_email": user.get("email"),
        "role": user.get("role"),
        "action": action,
        "entity": entity,
        "entity_id": str(entity_id) if entity_id else None,
        "metadata": metadata or {},
        "timestamp": datetime.utcnow(),
    })
