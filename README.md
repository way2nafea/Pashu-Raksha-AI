# PASHU-RAKSHAK AI

**Detect Early. Respond Faster. Protect Livestock.**

Smart India Hackathon 2026 | Problem Statement PS 26128 | Government of Maharashtra

PASHU-RAKSHAK AI is a livestock disease surveillance prototype for symptom
reporting, preliminary disease prediction and risk assessment, case
management, and government monitoring. It connects farmer reports with
field-worker and veterinary workflows, laboratory records, outbreak
monitoring, and role-specific dashboards. It is decision support, not a
veterinary diagnosis system.

## Current Features

- Farm and animal records; symptom reports with location and optional photo reference.
- Disease prediction using the included trained model artifact, with a clearly identified rule-based disease-category fallback.
- Rule-based case risk scoring, nearby-case analysis, potential outbreak clusters, and risk alerts.
- Field-worker tasks and visits; veterinary case queues, treatment, and laboratory sample/results workflows.
- Vaccination records, weather context, herd-health summaries, government analytics, GIS map, user administration, and audit log.
- Selected report, field-visit, vaccination, and lab-status actions can be queued in browser local storage and synced when connectivity returns.
- English, Hindi, and Marathi UI strings are available through the language switcher; translation coverage is partial.

## Architecture

| Component | Implementation |
|---|---|
| Frontend | `apps/web`: Next.js 16, React 19, TypeScript, Tailwind CSS |
| Backend | `backend`: FastAPI modular application, Python 3.12, Uvicorn |
| Persistence | MongoDB via PyMongo; MongoDB Atlas is suitable for hosted environments |
| Authentication | Email/password and optional Google Identity Services; JWT bearer tokens and server-side role checks |
| GIS | Leaflet and OpenStreetMap tiles; GeoJSON locations and Python haversine proximity queries |
| Disease prediction | Trained scikit-learn RandomForest artifact with rule-based fallback; separate deterministic rule engine computes operational risk/urgency |

The backend modules cover authentication, users, farms, animals, reports,
cases, visits, treatment, laboratory, vaccination, GIS, alerts, analytics,
sync, audit, and weather. See [architecture](docs/architecture.md),
[RBAC](docs/rbac.md), [database](docs/database.md), and
[outbreak detection](docs/outbreak-detection.md) for deeper details.

## Roles and Routes

All roles use the same sign-in page at `/`. `/login` redirects to `/`. After
sign-in, users are routed to their role home. Route guards and backend
dependencies enforce access; the frontend routes are not a substitute for
API authorization.

| Role | Main frontend routes |
|---|---|
| `FARMER` | `/farmer`, `/farmer/farms`, `/farmer/report`, `/farmer/cases`, `/farmer/alerts` |
| `FIELD_WORKER` | `/field-worker`, `/field-worker/[id]`, `/vet` (case queue/detail), `/farmer/farms` |
| `VETERINARIAN` | `/vet`, `/vet/[id]`, `/vet/alerts` |
| `LAB_STAFF` | `/lab` |
| `DISTRICT_ADMIN` | `/gov`, `/gov/cases`, `/gov/map`, `/admin/users` (view users) |
| `STATE_ADMIN` | `/gov`, `/gov/cases`, `/gov/map`, `/admin/users` |
| `SUPER_ADMIN` | `/gov`, `/gov/cases`, `/gov/map`, `/admin/users`, `/admin/audit` |

Farmers can publicly register; public registrations create `FARMER` accounts.
The first account registered on a completely empty database is a bootstrap
`SUPER_ADMIN` so that initial staff provisioning is possible. This exception
closes as soon as an account exists. Staff and government users are otherwise
provisioned by an authorized administrator. `SUPER_ADMIN` creates accounts
from `/admin/users`; district and state admins can view the user list but
cannot create accounts.

## Database and Environment

A real MongoDB connection is required for SIH demos, evaluation, and deployed
use. Do not use the in-memory `mongomock` fallback for these runs: its data is
lost when the backend restarts. No demo users or records are automatically
seeded. For a fresh database, the first account follows the bootstrap rule
above. The optional developer seed script is manual-only.

Connection examples:

```text
Local MongoDB: mongodb://localhost:27017
MongoDB Atlas: mongodb+srv://<user>:<password>@<cluster>.mongodb.net
Database name: pashurakshak
```

Set backend values in `backend/.env` (copy `backend/.env.example`):

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | Real local MongoDB or Atlas connection string; required for persistent data |
| `MONGODB_DB` | Database name; defaults to `pashurakshak` |
| `JWT_SECRET` | Token signing secret; replace the development default with a strong private value |
| `CORS_ORIGINS` | Comma-separated exact frontend origins; use the deployed frontend URL in Render |
| `GOOGLE_CLIENT_ID` | Optional backend Google ID-token audience; needed only for Google sign-in |
| `GOOGLE_MAPS_API_KEY` | Optional; selects Google Weather/Air Quality APIs instead of the default Open-Meteo weather provider |
| `OUTBREAK_RADIUS_KM` | Outbreak cluster radius; default `10` |
| `OUTBREAK_TIME_WINDOW_DAYS` | Outbreak time window; default `14` |
| `OUTBREAK_MIN_CASES` | Minimum reports for a cluster; default `3` |
| `NEARBY_CASE_RADIUS_KM` | Nearby-case search radius; default `15` |

The `.env.example` also contains `CLOUDINARY_*` placeholders, but current
backend settings do not read them. Do not treat them as a configured upload
integration. Never commit real connection strings, passwords, or API keys.

## Local Development

The following commands use PowerShell. Configure `MONGODB_URI` and a private
`JWT_SECRET` in `backend/.env` before running the application.

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
# Edit .env: set MONGODB_URI to a real MongoDB connection string.
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

In a second terminal:

```powershell
cd apps/web
npm install
Copy-Item .env.local.example .env.local
# Keep NEXT_PUBLIC_API_URL=http://localhost:8000 for host-local development.
npm run dev
```

Open `http://localhost:3000`. Backend health and interactive API docs are at
`http://localhost:8000/health` and `http://localhost:8000/docs`.

For another device on the LAN, set `NEXT_PUBLIC_API_URL` to
`http://<HOST_LAN_IP>:8000`, `NEXT_DEV_ALLOWED_ORIGINS` to `<HOST_LAN_IP>`,
and include `http://<HOST_LAN_IP>:3000` in backend `CORS_ORIGINS`. The host
firewall may need inbound TCP 3000 and 8000. Do not expose MongoDB port 27017.

## Render Deployment

There is no Render manifest in this repository; create two separate Render
Web Services using the monorepo subdirectories as their Root Directories.
Use MongoDB Atlas for the hosted backend. Render cannot reach a MongoDB server
running at `mongodb://localhost:27017` on a developer's PC; configure Atlas
network access to allow the backend service to connect.

### Backend service

| Render setting | Value |
|---|---|
| Root Directory | `backend` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |

Set `MONGODB_URI` to the Atlas connection string, `MONGODB_DB=pashurakshak`,
`JWT_SECRET` to a strong private value, and `CORS_ORIGINS` to the exact
deployed frontend origin, for example `https://<frontend-service>.onrender.com`.
Add optional Google variables only when configuring those integrations.

### Frontend service

| Render setting | Value |
|---|---|
| Root Directory | `apps/web` |
| Build Command | `npm install && npm run build` |
| Start Command | `npm run start` |

Set `NEXT_PUBLIC_API_URL` to the deployed backend origin, for example
`https://<backend-service>.onrender.com`, not `localhost`. Next.js embeds this
public variable during the build, so set it before building/redeploying. If
Google sign-in is enabled, also set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` to the same
OAuth client ID as backend `GOOGLE_CLIENT_ID` and authorize the deployed
frontend origin in Google Identity Services.

### Deployment order

1. Create MongoDB Atlas database and obtain its connection string.
2. Deploy the backend Web Service on Render with the `backend` Root Directory.
3. Check `https://<backend-service>.onrender.com/health` and `/docs`.
4. Deploy the frontend Web Service with the `apps/web` Root Directory.
5. Set frontend `NEXT_PUBLIC_API_URL` to the deployed backend URL and rebuild.
6. Set backend `CORS_ORIGINS` to the deployed frontend URL.
7. Redeploy or restart services after environment changes.
8. Test sign-in and the report, case, field-response, lab, and dashboard workflows.

## Authentication

Email/password sign-in is available to every provisioned account. Passwords
are stored as bcrypt hashes; successful sign-in returns a JWT bearer token
with a 12-hour expiry. The frontend stores the token locally and sends it on
API requests. Backend role dependencies protect restricted endpoints.

Google sign-in is optional and appears only when
`NEXT_PUBLIC_GOOGLE_CLIENT_ID` is configured; the backend verifies the
credential using `GOOGLE_CLIENT_ID`. Role redirects are `FARMER` to
`/farmer`, `FIELD_WORKER` to `/field-worker`, `VETERINARIAN` to `/vet`,
`LAB_STAFF` to `/lab`, district/state admins to `/gov`, and `SUPER_ADMIN` to
`/admin/users`.

## Disease Prediction and Risk

The repository includes `backend/app/ml/artifacts/model.joblib` and its
metadata, plus cleaned CSV data and the training/inference code. The loaded
scikit-learn `RandomForestClassifier` predicts among anthrax, blackleg, foot
and mouth, lumpy virus, and pneumonia. If the model is unavailable or its
feature schema does not match, disease-category prediction uses the
rule-based fallback and the API labels it `RULE_BASED_FALLBACK`.

Model metadata reports 43,778 records and held-out accuracy of 0.6861 with
macro F1 of 0.6777. The listed dataset source is mentor-provided, but its
licensing/provenance is not independently verified. These metrics are not
clinical validation and do not establish veterinary diagnostic accuracy.
Separately, a transparent rule-based engine always calculates operational
risk/urgency and recommended action using report, herd, nearby-case, outbreak,
and weather context. See [ML prediction](docs/ml-disease-prediction.md) and
[risk engine](docs/ai-risk-engine.md).

## API and Testing

The API is versioned under `/api/v1`. Interactive documentation is served at
`/docs`; health is served at `/health`. Main route groups include auth, users,
farms, animals, reports, cases, visits, treatments, laboratory, vaccinations,
GIS, alerts, dashboard, sync, audit, and weather.

Run backend tests from `backend`:

```powershell
python -m pytest -q
```

Run frontend checks from `apps/web`:

```powershell
npm run build
npm run lint
```

The build includes TypeScript validation. There is no separate typecheck
script in `package.json`; `npm run lint` runs ESLint.

## Troubleshooting

- **Database connection fails:** verify the Atlas URI, credentials, database name, and Atlas network access for the Render backend.
- **Browser API requests fail:** check `NEXT_PUBLIC_API_URL`, make sure it has no `localhost` in deployment, and set backend `CORS_ORIGINS` to the exact frontend origin including scheme.
- **No account can sign in:** no demo accounts are seeded. Register the first account on an empty database (it becomes `SUPER_ADMIN`), then provision staff accounts at `/admin/users`.
- **Google sign-in is missing or rejected:** verify both Google client ID variables and the authorized frontend origin.
- **Disease prediction uses fallback:** check backend logs, model artifact presence, and the metadata feature schema version; fallback risk scoring remains available.

## Further Documentation

- [Architecture](docs/architecture.md)
- [Database](docs/database.md)
- [RBAC](docs/rbac.md)
- [AI risk engine](docs/ai-risk-engine.md)
- [ML disease prediction](docs/ml-disease-prediction.md)
- [Outbreak detection](docs/outbreak-detection.md)
- [Offline sync](docs/offline-sync.md)
- [Weather integration](docs/weather-integration.md)
