# Database

MongoDB is the only supported database (per the architecture spec — not
PostgreSQL/PostGIS). In demo mode, `mongomock` provides an in-memory,
API-compatible substitute so the prototype runs without any external
service; in production, the exact same code targets MongoDB Atlas via
`pymongo` (`backend/app/core/db.py`).

## Collections

| Collection | Purpose |
|---|---|
| `users` | All roles; email unique-indexed |
| `farms` | Farmer-owned farms, GeoJSON `location` |
| `animals` | Digital health passport per animal |
| `disease_reports` | Raw farmer/field-worker submissions |
| `cases` | The tracked workflow entity (status machine) |
| `risk_scores` | Historical AI assessments (one per report) |
| `outbreaks` | Detected geographic-temporal clusters |
| `alerts` | In-app alert feed |
| `field_visits` | Vet/field-worker visit records |
| `treatments` | Diagnosis + treatment records |
| `samples` | Lab sample workflow (`lab` module) |
| `vaccinations` | Vaccination history per animal |
| `audit_logs` | Action log for compliance |
| `sync_queue` | Reserved for server-observed offline sync backlog |

## GeoJSON

All location fields use the standard GeoJSON Point format:

```json
{ "type": "Point", "coordinates": [longitude, latitude] }
```

## Indexes

- `users.email` — unique
- `animals.tag_id`, `disease_reports.farm_id`, `cases.status`,
  `cases.risk_level` — lookup indexes, created in both demo and production
  modes.
- `farms.location`, `disease_reports.location`, `outbreaks.center` —
  **2dsphere**, created **only against real MongoDB** (`DEMO_MODE=False`).
  `mongomock`'s 2dsphere support is unreliable, so demo mode intentionally
  skips creating these indexes and never relies on MongoDB's geo query
  operators (`$near`, `$geoWithin`, `$geoNear`).

## Geo query strategy (important production note)

Because demo mode can't rely on native geo operators, all proximity logic
(`app/gis/service.py`) is implemented in Python using the haversine
formula, applied to an in-memory list of documents fetched with a plain
`find({})`. This is correct and fully tested, but does not scale past a
few thousand documents per collection.

**Production migration path:** once running against real MongoDB Atlas
with the 2dsphere indexes already created, replace
`find_within_radius()`'s callers with a `$geoNear` aggregation stage. The
function signature and return shape can stay identical, so this is a
localized change in `app/gis/service.py`, `app/reports/router.py`, and
`app/outbreak/service.py` — not a rewrite.
