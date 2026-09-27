"""
Offline-first sync support.

Model: LOCAL DATA -> SYNC QUEUE -> CENTRAL SYSTEM.

The web/mobile client stores unsynced disease reports locally (localStorage
on web, AsyncStorage/SQLite on Expo) tagged "PENDING_SYNC". When
connectivity returns, the client POSTs the queued records here; each is
created via the normal reports pipeline and marked "SYNCED" in the
response so the client can update its local status.

This endpoint intentionally reuses the exact same submit_report() logic as
the online path — offline and online reports go through identical AI
risk / GIS / outbreak / alert processing once synced.
"""
from fastapi import APIRouter, Depends

from app.core.db import get_db
from app.core.security import require_roles
from app.reports.router import ReportIn, submit_report

router = APIRouter(prefix="/sync", tags=["Offline Sync"])


@router.post("/reports")
def sync_reports(payloads: list[ReportIn], user: dict = Depends(require_roles("FARMER", "FIELD_WORKER"))):
    results = []
    for payload in payloads:
        result = submit_report(payload, user)
        results.append({"local_status": "SYNCED", **result})
    return {"synced_count": len(results), "results": results}


@router.get("/status")
def sync_status(user: dict = Depends(require_roles("FARMER", "FIELD_WORKER", "SUPER_ADMIN"))):
    db = get_db()
    pending = db.sync_queue.count_documents({"status": "PENDING"})
    return {"pending": pending, "detail": "Client-side queue status is authoritative; this reflects server-observed backlog only."}
