# Architecture

## System Diagram

```
FARMER APP (web, responsive)    VETERINARIAN WEB APP
FIELD WORKER (web)              LAB WEB MODULE
                                 GOVERNMENT WEB DASHBOARD
              \                  /
               \                /
                FASTAPI BACKEND (modular monolith)
                        |
        ┌───────────────┼───────────────┐
        |               |               |
   AI ENGINE        GIS ENGINE     ALERT ENGINE
        |               |               |
        └───────────────┼───────────────┘
                         |
                  OUTBREAK ENGINE
                         |
                  MONGODB (Atlas / mongomock demo)
                         |
          ANALYTICS / AUDIT / FILE REFERENCES
                         |
               GOVERNMENT DASHBOARD
```

## Why a modular monolith

One FastAPI process, one deployable unit — appropriate for a 36-hour
hackathon build — but every domain (auth, farms, animals, reports, cases,
ai, gis, outbreak, alerts, vaccination, treatment, visits, lab, analytics,
sync, audit) lives in its own `app/<module>/` package with its own router
and, where relevant, its own service module. Nothing reaches into another
module's collection directly except through its router or service
functions, so any module can be lifted into its own microservice later
without restructuring the domain logic itself.

## Request flow: disease report submission

This is the critical path and the one the demo is built around
(`backend/app/reports/router.py`):

1. `POST /api/v1/reports` validates the payload (Pydantic) and RBAC
   (FARMER / FIELD_WORKER only).
2. The report is inserted into `disease_reports`.
3. `app/gis/service.find_within_radius` finds nearby reports (haversine).
4. `app/outbreak/service.find_nearby_similar_reports` narrows that to
   symptom-overlapping, time-windowed cases.
5. `app/ai/risk_engine.assess_risk` scores the report using symptom
   severity, duration, mortality, affected count, vaccination status, and
   the nearby/cluster counts from steps 3–4.
6. `app/outbreak/service.evaluate_outbreak` checks whether the cluster
   meets `OUTBREAK_MIN_CASES` and creates/updates an outbreak record.
7. A `case` document is created linking the report, risk assessment, and
   outbreak (if any).
8. `app/alerts/service.create_alert` fires for HIGH/CRITICAL risk and for
   outbreak detection.
9. The full assessment, nearby-case count, outbreak status, and case are
   returned to the client in one response — this is what the farmer sees
   immediately after submitting.

Every step is a plain Python function call within the same request — no
message queue, no async job — which keeps the hackathon build simple and
fully synchronous/testable, while still being organized so an async task
queue could be introduced later for steps 3–8 without touching the API
contract.

## Data model

See [`database.md`](database.md) for the full collection list and indexing
strategy.

## Frontend architecture

One Next.js app (`apps/web`) serves five role-based portals from a single
codebase, gated by `useRequireRole()` (client-side route guard reading the
JWT-derived role from `localStorage`) — not five separate apps, since RBAC
is already enforced server-side on every API call; the frontend guard is a
UX convenience, not a security boundary.

- `/farmer/*` — Farmer & Field Worker
- `/vet/*` — Veterinarian case queue and case detail workflow
- `/lab/*` — Lab sample queue
- `/gov/*` — Government analytics dashboard + GIS map
- `/admin/*` — User management, audit log
