# Future Scope

Phased roadmap beyond this hackathon prototype. Items below marked ✅ were
completed in the Round-2 rebuild; see the referenced docs for exactly what
was and wasn't done.

## Near-term (next iteration)
- **Expo/React Native mobile app** — the TRD-specified farmer/field-worker
  mobile client. The backend's JWT REST API is already mobile-ready; this
  is additive work, not a backend change.
- ✅ **Client-side offline queue UI** — done. See `docs/offline-sync.md`.
- **Hindi/Marathi UI translation** — a full i18n layer (e.g. `next-intl`)
  over the component structure is still outstanding. ✅ Voice input/output
  in Hindi/Marathi/English exists (`docs/voice-assistant.md`) using
  best-effort, unreviewed keyword translations — that's a narrower slice
  than full UI translation and should not be conflated with it.
- **FCM push notifications** — the alert engine already has a `channel`
  field (`IN_APP` today) designed to add `PUSH_FCM` without changing
  callers.

## Medium-term
- ⚠️ **Phase 2 AI risk model** — the *architecture* is done (real feature
  schema, training pipeline, inference service — see
  `docs/ml-disease-prediction.md`), wired into the report flow with honest
  `ML`/`RULE_BASED_FALLBACK` labeling. **No model is actually trained** —
  no dataset with independently verifiable licensing was reachable from
  the tools available while building this. `docs/ml-disease-prediction.md`
  documents exactly which candidates were checked, why each was rejected,
  and the exact command to run once a properly licensed dataset is sourced.
- **Native MongoDB geo queries** — once running against a real Atlas
  cluster with 2dsphere indexes at scale, replace the Python/haversine
  proximity layer with `$geoNear` aggregations for performance.
- ✅ **Weather-correlated risk factors** — done, via Open-Meteo. See
  `docs/weather-integration.md`.

## Longer-term
- Computer-vision-assisted triage on uploaded images (currently stored as
  evidence only, never auto-diagnosed).
- ⚠️ **Voice reporting** — a voice *assistant* (navigation + reading
  advisories aloud) exists; full hands-free voice *reporting* (dictating an
  entire disease report by voice) is not built.
- SMS gateway integration for alerts in areas with poor data connectivity.
- Research-grade spatio-temporal outbreak modeling (e.g. scan statistics)
  as a complement to — not replacement for — the current explainable
  heuristic, which should remain available for transparency/audit.
- Background Sync API + IndexedDB for the offline queue (currently
  localStorage + `online`-event flushing — see `docs/offline-sync.md`).
- A native "assigned to me" default view / stricter RBAC scoping for
  Field Worker case visibility (currently additive: assignment exists
  alongside the original shared-queue visibility, not a replacement for
  it — see `docs/rbac.md`).
