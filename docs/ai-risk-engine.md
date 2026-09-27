# AI Risk Engine

Implementation: `backend/app/ai/risk_engine.py` · Tests: `backend/tests/test_risk_engine.py`

## Phase 1: Deterministic Rule-Based Expert System

This is intentionally **not** a trained machine-learning model. It's a
transparent, fully explainable point-scoring system built from veterinary
triage heuristics, matching the hackathon prototype scope in the TRD. Every
rule below has a corresponding line of code — there is no hidden logic.

## Inputs

`symptoms, severity, duration_days, affected_count, mortality_count,
vaccination_status, nearby_similar_case_count, recent_cluster_case_count`

The last two are supplied by the GIS and outbreak-detection layers, so the
same clinical report scores higher if it's part of a growing local cluster
— consistent with real epidemiological triage.

## Scoring

1. **Symptom points** — each selected symptom contributes a fixed weight
   (`SYMPTOM_WEIGHTS`), e.g. `sudden_mortality`: 25, `respiratory_difficulty`: 16,
   `skin_lesions`: 14, `fever`: 12, down to `reduced_appetite`: 6.
2. **Severity multiplier** — mild ×0.6, moderate ×1.0, severe ×1.4, critical ×1.8.
3. **Duration multiplier** — ≤1 day ×0.8, 2–3 days ×1.0, 4–7 days ×1.2, >7 days ×1.4.
4. **Mortality bonus** — +30 base, plus +5 per animal lost (capped at 10).
5. **Affected-count bonus** — +2 per affected animal, capped at 20 animals.
6. **Unvaccinated/unknown bonus** — flat +8.
7. **Nearby similar cases** — +4 per case within `NEARBY_CASE_RADIUS_KM`, capped at 10.
8. **Recent cluster activity** — +6 per case in the active outbreak window, capped at 10.

Total points are normalized against a ceiling of 150 to a `risk_score` in
`[0.0, 1.0]`, then classified:

| Score | Level |
|---|---|
| ≥ 0.75 | CRITICAL |
| ≥ 0.50 | HIGH |
| ≥ 0.25 | MODERATE |
| < 0.25 | LOW |

`veterinary_referral` is `true` for HIGH/CRITICAL only.

## Suspected disease category

A simple symptom-cluster overlap heuristic (`CATEGORY_RULES`) suggests a
**"Suspected ___"** category — e.g. "Suspected respiratory infection" for
`{coughing, nasal_discharge, respiratory_difficulty}`. This is illustrative
pattern-matching for triage, not a diagnostic reference, and the code never
labels output as a confirmed diagnosis.

## Output contract

```json
{
  "risk_score": 0.62,
  "risk_level": "HIGH",
  "disease_category": "Suspected respiratory infection",
  "confidence": 0.63,
  "recommended_action": "Veterinary field visit recommended within 24 hours...",
  "veterinary_referral": true,
  "disclaimer": "AI-assisted preliminary risk assessment. This assessment supports veterinary triage and does not replace professional veterinary diagnosis.",
  "scoring_breakdown": { "...": "full transparent breakdown for audit/demo purposes" }
}
```

The `disclaimer` field is always present and is surfaced verbatim in the
farmer-facing UI after every report submission.

## Future phase (documented, not built)

Phase 2 (post-hackathon) would retrain this as an XGBoost/scikit-learn
classifier on real historical case + lab-confirmation data, without
changing the function signature or output contract — callers (the reports
router, tests) are unaffected by the internal scoring method.
