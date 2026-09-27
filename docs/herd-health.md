# Herd-Level Health Intelligence

`GET /api/v1/farms/{farm_id}/herd-summary` (`app/farms/router.py`) — every
number is computed live from that farm's actual MongoDB records. Nothing
here is hardcoded or fabricated:

| Field | Computed from |
|---|---|
| `total_animals` | `count(animals where farm_id)` |
| `affected_animals` / `healthy_animals` | distinct animals with a non-`RESOLVED` case vs. the rest |
| `active_disease_cases` / `resolved_cases` | `cases` by status, real counts |
| `vaccination_coverage_pct` | distinct animals with ≥1 real `vaccinations` record ÷ total |
| `treatments_recorded` | real `treatments` count for this farm's animals |
| `mortality_reported` | sum of `disease_reports.mortality_count` for this farm |
| `disease_category_frequency` | real distribution of `cases.disease_category` |
| `high_risk_cases` | active cases with `risk_level` HIGH/CRITICAL |
| `weather` | live Open-Meteo lookup at the farm's stored coordinates |

On a genuinely empty farm (0 animals), every count is honestly `0` and
`herd_risk.herd_risk_level` is `INSUFFICIENT_DATA` rather than a misleading
score — see `test_herd_summary_on_empty_farm_shows_zero_not_fabricated`.

## Herd risk (`compute_herd_risk()` in `app/ai/risk_engine.py`)

Combines, transparently (see `reasons` in the response):
- % of the herd currently affected by an active case
- count of active HIGH/CRITICAL individual cases
- vaccination coverage (penalizes <50% and <80%)
- mortality reported
- the same weather-risk bonus used in individual case scoring

Reuses the exact same `classify_risk_level()` LOW/MODERATE/HIGH/CRITICAL
thresholds as individual-case risk, so the two scales are directly
comparable. This function only combines numbers the caller already
computed from real records — it never queries or invents data itself.

## Where it's surfaced

Farmer → My Farms: each farm card shows live animal/affected/active-case/
vaccination counts plus the herd risk badge and its reasons. Extending this
to the Vet/Government dashboards is a natural next step (same endpoint,
same data — no new backend work needed).
