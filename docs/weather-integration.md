# Weather Intelligence

Real weather via [Open-Meteo](https://open-meteo.com) (`app/weather/service.py`)
— free, no API key, so nothing needs to be added to `.env.example`.

## What's real

- Every disease report fetches live current conditions + a 3-day forecast
  at the **actual report coordinates** (`payload.latitude`/`longitude`,
  which themselves come from the farmer's real browser geolocation on the
  report form — never hardcoded).
- The snapshot is persisted on both the `disease_reports` and `cases`
  documents (`weather_at_report`), so it survives and is viewable later —
  not just shown once and discarded.
- `GET /api/v1/weather?latitude=&longitude=` is available for any
  authenticated role to look up weather for any coordinates on demand
  (farm view, case view, GIS map, etc.).

## Failure handling (never fake weather)

`get_weather()` never raises and never fabricates a plausible-looking
number. Every failure mode returns `{"available": false, "reason": "..."}`:

| Failure | Behavior |
|---|---|
| No coordinates | Immediate `available: false`, no network call |
| Network unreachable / DNS failure | Caught `httpx.RequestError` → `available: false` |
| Timeout (6s) | Caught `httpx.TimeoutException` → `available: false` |
| Non-200 response | Caught `httpx.HTTPStatusError` → `available: false` with the status code |
| Malformed/unexpected JSON shape | Caught `ValueError`/`KeyError`/`TypeError` → `available: false` |

The frontend (`vet/[id]/page.tsx`) renders both states explicitly — real
conditions when available, or a visible "Weather unavailable (`<reason>`)"
message. It never silently omits the weather panel in a way indistinguishable
from "no report yet."

This repository's own sandboxed test/build environment cannot reach
`api.open-meteo.com` at all (restricted egress), so `tests/test_weather.py`
exercises the real failure path directly (genuinely offline) plus the
response-parsing logic against a mocked HTTP response, so the Open-Meteo
response-shape handling itself is verified even without live network access.
In a normal deployment with outbound internet access, `available: true`
responses will flow immediately.

## Weather → risk context (illustrative, not a diagnostic claim)

`weather_disease_risk_note()` adds a small, transparent bonus to the rule
engine's operational risk score (see `app/ai/risk_engine.py`'s
`weather_bonus` — `scoring_breakdown`) when humidity ≥ 75% or there is
current precipitation, with a plain-language note explaining why. This is
explicitly the same "illustrative heuristic, not a veterinary reference"
category as the existing `CATEGORY_RULES` — it does not claim a validated
epidemiological correlation. When weather is unavailable, the bonus is `0`
and the note says so; the rest of the risk assessment proceeds normally so
report submission is never blocked by a weather-service outage.
