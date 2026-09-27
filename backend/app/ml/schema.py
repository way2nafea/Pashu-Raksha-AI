"""
Feature schema for the real ML disease-prediction model (SIH Round-2,
section 9/10 of the brief: "training features and inference features MUST
match").

This is the single source of truth. app/ml/train.py trains on exactly these
columns; app/ml/service.py vectorizes inference requests with the exact
same function. Neither file duplicates this list — both import it from here.

Fields mirror what the app already collects today (see
app/reports/router.py:VALID_SYMPTOMS and app/animals/router.py:AnimalIn) so
a licensed dataset only needs to be mapped onto these columns, not invented
from scratch.
"""

SYMPTOM_VOCABULARY = [
    "fever", "reduced_appetite", "lethargy", "nasal_discharge", "coughing",
    "diarrhea", "skin_lesions", "swelling", "respiratory_difficulty", "sudden_mortality",
]

CATEGORICAL_FEATURES = {
    "species": ["cattle", "buffalo", "goat", "sheep", "poultry", "other"],
    "severity": ["mild", "moderate", "severe", "critical"],
    "vaccination_status": ["vaccinated", "unvaccinated", "unknown"],
}

NUMERIC_FEATURES = [
    "age_months",
    "symptom_duration_days",
    "affected_head_count",
    "mortality_count",
    "herd_size",
    "nearby_similar_case_count",
]

FEATURE_COLUMNS = (
    [f"symptom_{s}" for s in SYMPTOM_VOCABULARY]
    + NUMERIC_FEATURES
    + [f"species_{v}" for v in CATEGORICAL_FEATURES["species"]]
    + [f"severity_{v}" for v in CATEGORICAL_FEATURES["severity"]]
    + [f"vaccination_status_{v}" for v in CATEGORICAL_FEATURES["vaccination_status"]]
)

# Bump this whenever FEATURE_COLUMNS changes shape/meaning. service.py
# refuses to run inference if a loaded model's metadata doesn't match the
# app's current schema version, rather than silently mis-predicting.
SCHEMA_VERSION = "v1-2026.09"


def build_feature_dict(*, species, symptoms, severity, symptom_duration_days,
                        affected_head_count, mortality_count, vaccination_status,
                        age_months=0, herd_size=0, nearby_similar_case_count=0) -> dict:
    return {
        "species": species, "symptoms": symptoms or [], "severity": severity,
        "symptom_duration_days": symptom_duration_days,
        "affected_head_count": affected_head_count, "mortality_count": mortality_count,
        "vaccination_status": vaccination_status, "age_months": age_months,
        "herd_size": herd_size, "nearby_similar_case_count": nearby_similar_case_count,
    }


def vectorize(features: dict) -> list[float]:
    """Turn a raw feature dict (from build_feature_dict, or a training-set
    row normalized the same way) into the exact ordered numeric vector the
    model consumes."""
    symptoms = set(features.get("symptoms") or [])
    row = {f"symptom_{s}": 1.0 if s in symptoms else 0.0 for s in SYMPTOM_VOCABULARY}
    for f in NUMERIC_FEATURES:
        row[f] = float(features.get(f) or 0)
    for cat, options in CATEGORICAL_FEATURES.items():
        value = str(features.get(cat) or "").lower()
        for opt in options:
            row[f"{cat}_{opt}"] = 1.0 if value == opt else 0.0
    return [row[c] for c in FEATURE_COLUMNS]
