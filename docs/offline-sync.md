# Offline-First Sync

Implementation: `backend/app/sync/router.py` · Model:
**LOCAL DATA → SYNC QUEUE → CENTRAL SYSTEM**

## Server side (fully implemented and tested)

`POST /api/v1/sync/reports` accepts a **list** of disease report payloads
(the same `ReportIn` schema as the normal online endpoint) and processes
each through the identical pipeline — AI risk engine, GIS nearby-case
check, outbreak detection, alert generation, case creation — as a normal
online submission. This guarantees offline-queued and online reports are
never treated differently once synced; there's exactly one code path
(`app.reports.router.submit_report`), reused by both the direct endpoint
and the sync endpoint.

```json
POST /api/v1/sync/reports
[ { "animal_id": "...", "farm_id": "...", "species": "cattle", "symptoms": [...], ... } ]
```

Response includes a `local_status: "SYNCED"` tag per item so the client can
update its local queue.

## Client side (now implemented)

`apps/web/src/lib/offline.ts` implements the flow described above:

1. When a POST fails with a genuine network error (not a server-rejected
   `ApiError`), the payload is saved via `enqueueForSync()` to a
   `localStorage`-backed queue, tagged `pending`.
2. `components/ConnectivityBadge.tsx` (shown in `PortalShell` on every
   page) displays the real state: Online / Offline · N pending sync /
   Syncing… / Sync failed (N).
3. `useSyncQueue()` auto-flushes the queue the moment the browser's
   `online` event fires.
4. On success each item is removed from the queue; on failure it's marked
   `failed` and stays queued for a manual retry (tapping the badge) or the
   next reconnect.

The farmer's disease-report form (`farmer/report/page.tsx`) queues to this
exact endpoint — `POST /api/v1/sync/reports` — wrapping the single report
in a one-item list, so a queued offline report goes through the identical
AI/weather/outbreak pipeline once synced as this endpoint was built for.
Field Worker forms (field visit, vaccination, sample status — see
`docs/offline-sync.md`'s companion note in `field-worker/[id]/page.tsx`)
queue to their own normal endpoints the same way, since those don't have
(or need) a batch variant.

**Not yet built:** a true Background Sync API registration (today's flush
only triggers while the tab is open and receives the `online` event) and
IndexedDB (localStorage was used instead — simpler, sufficient for the
data volumes involved here, but with a smaller storage ceiling).

