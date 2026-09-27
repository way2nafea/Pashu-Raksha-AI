# Outbreak Detection

Implementation: `backend/app/outbreak/service.py` · Tests: `backend/tests/test_outbreak.py`

## Design goal

A simple, explainable spatial-temporal heuristic — explicitly **not** a
research-grade epidemiological model (no scan statistics, no
Kulldorff/SaTScan-style modeling). This matches the hackathon scope: prove
the end-to-end workflow reliably, rather than build a novel detection
algorithm.

## Algorithm

On every new disease report submission:

1. **Geographic filter** — find other `disease_reports` within
   `NEARBY_CASE_RADIUS_KM` (default 15km) of the new report's coordinates,
   using haversine distance (see `docs/database.md` for why this is
   computed in Python rather than via MongoDB's native geo operators).
2. **Temporal filter** — of those, keep only reports created within
   `OUTBREAK_TIME_WINDOW_DAYS` (default 14 days).
3. **Symptom similarity filter** — keep only reports that share **at least
   one symptom** with the new report.
4. **Threshold check** — if the resulting cluster (including the new
   report) has at least `OUTBREAK_MIN_CASES` (default 3) reports, an
   outbreak is flagged.
5. **Severity** — the outbreak record is marked `CRITICAL` if total cluster
   mortality exceeds 3, or the cluster has grown 3+ cases past the
   threshold; otherwise `HIGH`.
6. **Idempotency** — if an active/monitoring outbreak already exists for
   the same species, it's updated in place (case count, symptom union,
   mortality) rather than creating a duplicate.

## Tuning

All thresholds are environment variables (`backend/.env.example`):

```
OUTBREAK_RADIUS_KM=10
OUTBREAK_TIME_WINDOW_DAYS=14
OUTBREAK_MIN_CASES=3
NEARBY_CASE_RADIUS_KM=15
```

## Verified behavior (see tests)

- **Below threshold**: a single isolated report never creates an outbreak.
- **At threshold**: 3 geographically-close, symptom-overlapping,
  recent reports create an outbreak on the 3rd submission.
- **Distant reports never cluster**: reports hundreds of kilometers apart
  (even with identical symptoms) never trigger an outbreak, proving the
  geographic filter is doing real work and not just counting cases
  globally.

## What happens when an outbreak is detected

- An `alerts` record is created with type `OUTBREAK_DETECTED` and priority
  `HIGH`/`CRITICAL`, visible to veterinarians and government users.
- Every case created from a cluster report carries `outbreak_id`, so the
  vet case-detail view and the GIS map both surface "part of an active
  outbreak" context.
- The GIS map (`/gov/map`) draws a dashed circle of radius
  `OUTBREAK_RADIUS_KM` around the outbreak center.
