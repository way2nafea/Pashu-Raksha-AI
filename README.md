# PASHU-RAKSHAK AI

**Detect Early · Respond Faster · Protect Livestock**

Smart India Hackathon 2026 · Problem Statement PS 26128 · Government of Maharashtra
Theme: Agriculture, FoodTech & Rural Development

---

## 1. Problem & Solution

Livestock disease outbreaks in Maharashtra often go undetected until they've
already spread across villages, because there is no shared system connecting
a farmer noticing symptoms to the veterinary and public-health response
chain. PASHU-RAKSHAK AI closes that gap with one connected workflow:

```
FARMER → DISEASE REPORT → AI RISK ASSESSMENT → GIS / NEARBY CASES
  → OUTBREAK DETECTION → ALERT → VETERINARIAN → FIELD RESPONSE
  → LAB / DIAGNOSIS → TREATMENT → GOVERNMENT DASHBOARD
```

A farmer reports symptoms with location and photo evidence in a guided
mobile-friendly form. A deterministic AI risk engine immediately triages the
report, checks for nearby similar cases, and flags a potential outbreak if a
geographic-temporal cluster threshold is met. Veterinarians see a
risk-prioritized case queue, record field visits, request lab tests, and
record treatment. Government users get a live command-center dashboard with
a GIS risk map and disease analytics.

## 2. Architecture

Modular monolith — one FastAPI backend, cleanly separated into modules that
can be split into microservices later without a rewrite. See
[`docs/architecture.md`](docs/architecture.md) for the full diagram.

```
apps/web/        Next.js 15 + TypeScript + Tailwind — Farmer, Vet, Lab,
                  Government and Admin portals in one role-based app
backend/         FastAPI (Python) — modular monolith, JWT + RBAC
docs/            Architecture, AI engine, outbreak detection, demo script
docker-compose.yml
```

## 3. Technology Stack

| Layer | Technology |
|---|---|
| Web dashboard | Next.js 15, React 19, TypeScript, Tailwind CSS v4 |
| Backend | Python 3.12, FastAPI, Pydantic, Uvicorn |
| Database | MongoDB (Atlas in production; in-memory `mongomock` in demo mode) |
| AI / Risk Engine | Deterministic rule-based expert system (Python) — Phase 1 per TRD |
| GIS | OpenStreetMap, Leaflet, GeoJSON, haversine-based proximity queries |
| Auth | JWT (python-jose) + bcrypt |
| Charts | Recharts |

**Mobile app note:** the Expo/React Native farmer app specified in the TRD
was out of scope for this build pass — the Next.js web app is fully
responsive (360px–1280px+) and serves as the demo substitute. See
[`docs/future-scope.md`](docs/future-scope.md).

## 4. Demo Mode (no external services required)

If `MONGODB_URI` is left empty, the backend runs entirely on `mongomock` —
an in-memory, API-compatible MongoDB substitute — and **auto-seeds a
realistic demo dataset on startup** (see `backend/seed/seed_data.py`). This
means the full prototype runs with zero paid services, zero setup beyond
`pip install`, for hackathon evaluation.

To run against real MongoDB Atlas in production, set `MONGODB_URI` in
`backend/.env` — the exact same code path is used, with real 2dsphere
geospatial indexes created automatically. MongoDB is intentionally the only
supported database (per the architecture spec) — **not** PostgreSQL/PostGIS.

## 5. Demo Accounts

| Role | Email | Password |
|---|---|---|
| Farmer | farmer@pashuraksha.demo | Demo@123 |
| Field Worker | worker@pashuraksha.demo | Demo@123 |
| Veterinarian | vet@pashuraksha.demo | Demo@123 |
| Lab Staff | lab@pashuraksha.demo | Demo@123 |
| District Admin | district@pashuraksha.demo | Demo@123 |
| State Admin | state@pashuraksha.demo | Demo@123 |
| Super Admin | admin@pashuraksha.demo | Demo@123 |

These are created automatically by the seed script on first backend
startup in demo mode — no manual setup needed.

## 6. Running It

### Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Swagger docs: http://localhost:8000/docs
The demo dataset is seeded automatically on first startup (see console log).

### Web app

```bash
cd apps/web
npm install
cp .env.local.example .env.local   # points to http://localhost:8000
npm run dev
```

Open http://localhost:3000 and sign in with any demo account above (click
a role chip to autofill the email).

### Access from another device on the LAN (Windows)

Find the host laptop's Wi-Fi IPv4 address with `ipconfig`. Before starting the
backend, allow the frontend origin in `backend/.env` (replace the example IP):

```env
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://192.168.X.X:3000
```

Start the backend from a PowerShell terminal:

```powershell
cd backend
$env:CORS_ORIGINS="http://localhost:3000,http://127.0.0.1:3000,http://192.168.X.X:3000"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Start the frontend in a separate PowerShell terminal, replacing the same
placeholder with the host laptop's Wi-Fi IPv4 address:

```powershell
cd apps/web
$env:NEXT_PUBLIC_API_URL="http://192.168.X.X:8000"
$env:NEXT_DEV_ALLOWED_ORIGINS="192.168.X.X"
npm run dev
```

On the host, verify `http://localhost:8000/health`. From another laptop on
the same Wi-Fi, verify `http://192.168.X.X:8000/health`, then open
`http://192.168.X.X:3000`. If Windows Firewall blocks access, allow inbound
TCP ports 3000 and 8000 on the Private profile. Do not open MongoDB port
27017; it must remain host/backend-only.

For Docker Compose, set `NEXT_PUBLIC_API_URL` to the same LAN backend URL and
`CORS_ORIGINS` to include the LAN frontend origin in the environment used by
Compose before running `docker compose up --build`.

### Google Sign-In

To enable the Google button for farmer sign-in, create a Google OAuth Web
Client ID in Google Cloud Console. Add `http://localhost:3000` as an
authorized JavaScript origin, then set the same client ID in both files:

```env
# backend/.env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com

# apps/web/.env.local
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

Enable the Google Identity Services client and restart both servers. Google
accounts are created as farmers, except the first account in an empty database,
which follows the existing bootstrap-admin rule.

### Docker (both services together)

```bash
docker compose up --build
```
Web: http://localhost:3000 · API: http://localhost:8000/docs

### Tests

```bash
cd backend
pytest -q
```
16 tests covering auth, RBAC, the AI risk engine, outbreak detection, and a
full integration test walking the entire farmer→government workflow.

## 7. API

All endpoints are under `/api/v1/` — see full interactive documentation at
`/docs` (Swagger) or `/openapi.json` once the backend is running. Endpoint
groups: `/auth /users /farms /animals /reports /cases /visits /treatments
/lab /vaccinations /gis /alerts /dashboard /sync /audit`.

## 8. AI Risk Engine

A **deterministic, rule-based** decision-support engine (not a trained ML
model — see [`docs/ai-risk-engine.md`](docs/ai-risk-engine.md) for the full
scoring specification). It never claims to provide a diagnosis: every
response carries the disclaimer *"This assessment supports veterinary
triage and does not replace professional veterinary diagnosis."*

## 9. GIS & Outbreak Detection

Geo-proximity queries use the haversine formula in Python for demo-mode
compatibility (`mongomock` doesn't support MongoDB's native geo operators);
against real MongoDB Atlas, 2dsphere indexes are created and can back a
native `$geoNear` aggregation. Outbreak detection is a documented,
explainable heuristic — not a research-grade epidemiological model. Full
spec: [`docs/outbreak-detection.md`](docs/outbreak-detection.md).

## 10. Offline Support

Basic offline-first support for farmer/field-worker reporting:
`LOCAL DATA → SYNC QUEUE → CENTRAL SYSTEM`. See
[`docs/offline-sync.md`](docs/offline-sync.md). The web client-side queue
implementation itself was left as an integration point in this pass (the
backend `/api/v1/sync/reports` endpoint is fully implemented and tested);
see limitations below.

## 11. RBAC

Seven roles (FARMER, FIELD_WORKER, VETERINARIAN, LAB_STAFF, DISTRICT_ADMIN,
STATE_ADMIN, SUPER_ADMIN), enforced on every protected endpoint via FastAPI
dependencies. Full permission matrix: [`docs/rbac.md`](docs/rbac.md).

## 12. Known Limitations

This is a **hackathon prototype**, not a production system. Explicitly out
of scope, per the source requirements:

- Advanced/trained ML models, computer-vision image diagnosis, weather
  integration, voice/IVR, WhatsApp bots, IoT sensor feeds.
- **Expo/React Native mobile app** — not built in this pass; the responsive
  web app is the demo substitute. Architecture is mobile-ready (JWT auth,
  clean REST API) so an Expo client could be added without backend changes.
- **Hindi/Marathi UI translation** — not implemented in this pass; the data
  model and component structure support adding an i18n layer.
- **Client-side offline queue (localStorage/IndexedDB)** — the backend sync
  endpoint exists and is tested, but the web client always submits online
  in this build; wiring up the local-queue UI is the next increment.
- Image upload accepts and stores a file reference for veterinary review;
  no computer-vision diagnosis is performed or implied, per spec.
- `mongomock` (demo mode) does not implement MongoDB's native geospatial
  operators, so proximity queries run in Python (haversine) rather than as
  a database-side `$geoNear`. This is fine at hackathon data volumes; see
  `docs/database.md` for the production migration note.

## 13. Future Scope

See [`docs/future-scope.md`](docs/future-scope.md) for the phased roadmap:
trained ML risk model, Expo mobile app, full i18n, FCM push notifications,
computer-vision-assisted triage, weather-correlated risk factors.
