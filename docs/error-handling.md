# Error Handling

## The problem this fixes

Audit found six silent `.catch(() => {})` call sites plus two unhandled
`await api.get(...)` calls with no try/catch at all (`admin/users`,
`lab/page.tsx` — and `vet/[id]/page.tsx` / `farmer/farms/page.tsx` had a
related bug: the initial load's exception was uncaught, so a real error
looked identical to "still loading" or rendered a blank page). All of
these made a genuine API failure indistinguishable from "0 records" or a
frozen loading spinner — exactly what section 32 of the brief calls out.

## The fix

`lib/api.ts` now exports `useApiList()`, a small shared hook used by every
simple list page (`farmer/cases`, `farmer/alerts`, `vet/alerts`,
`admin/audit`). It tracks four distinct states instead of one boolean:

- `loading` — request in flight
- `ready` — request succeeded (`data` may legitimately be an empty array)
- `error` — the server responded with a real error (`ApiError` — 4xx/5xx)
- `offline` — the request never reached the server (network/`TypeError`)

`components/ApiStateNotice.tsx` renders these consistently: a real error
message for `error`, an explicit "you appear to be offline" notice for
`offline`, and only shows "No X yet" once the state is actually `ready`
with zero items.

Pages with more custom logic (`farmer/farms`, `vet/[id]`, `admin/users`,
`lab`, `field-worker`) got the same fix applied inline — every `refresh()`/
load function now has a try/catch that sets a visible error string, and
every render guard checks for an error state before falling through to a
generic "Loading…" that would otherwise spin forever on a real failure.

## The distinction that matters throughout the app

`ApiError` (thrown only when the server actually responded with a non-2xx
status) is never confused with a plain network `TypeError` (thrown when
`fetch` can't reach the server at all — offline, DNS failure, timeout).
This distinction is what lets forms decide correctly between "show the
server's real error" (retrying won't help — e.g. validation failure) and
"queue this for offline sync" (retrying automatically once reconnected is
exactly right) — see `docs/offline-sync.md`.
