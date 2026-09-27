# Real ML Disease Prediction — Architecture, Status & Dataset Audit

This document is deliberately blunt about what is and isn't real here, per
the SIH Round-2 requirement to never claim a model is trained when it isn't.

## Current status: architecture complete, model NOT trained

`app/ml/` contains a complete, reproducible ML pipeline (schema, training
script, inference service) — but **no trained model artifact ships in this
repository**, because no dataset with independently verifiable licensing
was reachable from the tools available while building this. The inference
service (`app/ml/service.py`) honestly reports `ml_available: False` and
every report submission is clearly labeled `"engine": "RULE_BASED_FALLBACK"`
in the API response (`risk_assessment.disease_prediction.engine`). It is
never presented as ML.

## Layered architecture (per the brief's section 11)

- **PRIMARY** — `app/ml/service.py`: a real trained classifier predicting
  the specific disease + probability distribution, once trained.
- **SECONDARY** — `app/ai/risk_engine.py` (unchanged, pre-existing): rules
  combining symptoms + herd context + outbreak/geographic signals into an
  *operational risk/urgency* level (LOW/MODERATE/HIGH/CRITICAL) and a
  recommended action. This layer always runs, regardless of ML
  availability — it is not a fallback for risk scoring, only for disease
  *identification* is there a fallback.
- If `ml_available` is `False`, disease identification falls back to the
  rule engine's `guess_disease_category()`, explicitly tagged
  `RULE_BASED_FALLBACK` end-to-end (API response → case record → UI).

## Feature schema (`app/ml/schema.py`)

Matches exactly what the app already collects, so a licensed dataset only
needs to be *mapped* onto these columns, not invented:

- 10 binary symptom columns (`app/reports/router.py:VALID_SYMPTOMS`)
- numeric: `age_months`, `symptom_duration_days`, `affected_head_count`,
  `mortality_count`, `herd_size`, `nearby_similar_case_count`
- one-hot: `species`, `severity`, `vaccination_status`

Training and inference both import `FEATURE_COLUMNS`/`vectorize()` from
this one file, so they cannot silently drift apart.

## Training pipeline (`app/ml/train.py`)

Manual-only (same convention as `backend/seed/seed_data.py` — never runs
automatically):

```bash
python -m app.ml.train --data /path/to/dataset.csv --target disease \
    --dataset-source "<exact source + verified license>"
```

Cleans/validates columns → stratified 80/20 train/test split (fixed seed
42) → `RandomForestClassifier` (class-balanced, 300 trees — a reasonable
default for tabular symptom data: interpretable via feature importances,
fast to train, cheap to serve from FastAPI, no GPU required) → evaluates
**actual** accuracy/macro-precision/recall/F1/confusion matrix on the held-
out test set → saves `app/ml/artifacts/model.joblib` +
`app/ml/artifacts/metadata.json` (version, timestamp, dataset source,
feature schema version, every metric above). Refuses to run if the CSV is
missing required columns, and never invents a metric.

## Dataset audit — what was checked and why each candidate was rejected

The assistant's sandboxed tooling can browse the web (via search/fetch) but
its code-execution environment can only reach `github.com` and package
registries — not Kaggle, UCI, or Hugging Face — so a dataset had to be both
**verifiably licensed** and **actually downloadable** from that restricted
environment. None of the candidates found cleared both bars:

| Candidate | Rows / shape | License finding | Verdict |
|---|---|---|---|
| `thyagarajank/Cattle-disease-prediction-using-Machine-Learning` (GitHub) | 2,044 rows, 93 binary symptom columns → 26 diseases (`Training.csv`/`Testing.csv`) | **No LICENSE file** in the repo (default all-rights-reserved) | Rejected — unlicensed |
| `roshan8312/cattle-disease-prediction` (Hugging Face, "duplicated from scorder96") | Same 2,070-row dataset as above, re-uploaded | Tagged `license: mit` in HF metadata, **but the README is empty** and the uploader is not the original author — a self-applied tag with no substantiation is not verified licensing | Rejected — unverifiable, and it's the same unlicensed dataset from the row above |
| `Dharine/livestock-5k` (Hugging Face) | 5,000 rows, Animal/Symptom 1-3/Disease columns | No license documented anywhere in the dataset card | Rejected — undocumented |
| Kaggle `shijo96john/animal-disease-prediction` | Unknown (Kaggle-hosted) | Could not be determined — Kaggle serves a JS shell to unauthenticated fetches, and the sandbox has no network path to `kaggle.com`/the Kaggle API to inspect the license page or download the file | Rejected — inaccessible, not just unverified |

Also worth noting even setting licensing aside: the 93-symptom vocabulary
in the two `cattle-disease-prediction` datasets above does **not** align
with the app's actual 10-symptom farmer-facing vocabulary, so it would
need lossy remapping even if it were cleared for use.

**Bottom line: do not train on any of the above.** None should be used
without a human verifying license terms directly against the original
rights-holder (not a re-uploader's self-applied tag).

## What's needed to finish this

1. A **team member with browser + Kaggle/UCI access** downloads a dataset
   with a clear, verifiable license (e.g. an explicit `CC0`/`ODbL`/`MIT`
   `LICENSE` file from the original publisher, not a re-uploader's tag).
   Reasonable next places to check personally: Kaggle's own license filter
   (`https://www.kaggle.com/datasets?license=cc0-1.0` scoped to livestock/
   veterinary), or a government/university veterinary open-data portal.
2. Map its columns onto `app/ml/schema.py:FEATURE_COLUMNS` (extend the
   symptom vocabulary there — and the farmer-facing report form — if the
   dataset's symptom set is meaningfully richer than today's 10).
3. Run `python -m app.ml.train --data ... --target ... --dataset-source ...`.
4. Restart the backend — `app/ml/service.py` will pick up the new artifact
   automatically (no code change needed), and every new report will show
   `"engine": "ML"` with real confidence/probabilities instead of the
   fallback label.

## Model versioning

`metadata.json` records `model_version` (timestamp-based), `trained_at`,
`dataset_source`, `feature_schema_version`, and the full metrics used above.
`app/ml/service.py` refuses to run inference if a loaded model's
`feature_schema_version` doesn't match the app's current schema, rather
than silently mis-predicting with stale features.

## Future verified-feedback retraining loop (not yet built)

Per the brief's section 14, the *intended* future loop is: farmer report →
ML prediction → vet diagnosis → lab confirmation → verified outcome → next
training set → retrain → new version. Nothing unverified (a farmer's own
report) should become training ground truth on its own. This isn't
implemented yet — `case.disease_category`/lab `result` fields already exist
and are the natural source for it once real diagnosis/lab-confirmed
outcomes accumulate in the database.
