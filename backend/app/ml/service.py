"""
Real ML inference service — the PRIMARY layer in the layered risk
architecture described in docs/ml-disease-prediction.md. The existing
app/ai/risk_engine.py rule-based engine is the SECONDARY/fallback layer.

IMPORTANT — HONESTY CONTRACT:
This module never fabricates a prediction. If no trained model artifact
exists on disk or fails to load, predict() returns {"ml_available": False, "reason": "..."}
and the caller (app/reports/router.py) falls back to the rule engine and labels the
result "RULE_BASED_FALLBACK" in the API response.
"""
import json
import logging
import os

from app.ml.schema import vectorize, SCHEMA_VERSION

logger = logging.getLogger("pashurakshak.ml")

ARTIFACT_DIR = os.path.join(os.path.dirname(__file__), "artifacts")
MODEL_PATH = os.path.join(ARTIFACT_DIR, "model.joblib")
METADATA_PATH = os.path.join(ARTIFACT_DIR, "metadata.json")

_model = None
_metadata = None
_load_attempted = False


def _load(force: bool = False):
    global _model, _metadata, _load_attempted
    if _load_attempted and not force:
        return
    _load_attempted = True
    if os.path.exists(MODEL_PATH) and os.path.exists(METADATA_PATH):
        try:
            import joblib  # imported lazily so the app still runs without scikit-learn/joblib installed until a model actually exists
            _model = joblib.load(MODEL_PATH)
            with open(METADATA_PATH, "r", encoding="utf-8") as f:
                _metadata = json.load(f)
        except Exception as e:
            _model, _metadata = None, None
            logger.warning(f"[ml.service] Found model artifact but failed to load it: {e}")


def reload_model():
    """Explicitly reload the model artifact (useful for tests and dynamic updates)."""
    _load(force=True)
    return is_model_available()


def is_model_available() -> bool:
    _load()
    return _model is not None


def model_metadata() -> dict | None:
    _load()
    return _metadata


def predict(feature_dict: dict) -> dict:
    _load()
    if _model is None:
        return {
            "ml_available": False,
            "reason": (
                "No trained model artifact found in app/ml/artifacts/. Falling back to the "
                "rule-based engine."
            ),
        }
    if _metadata.get("feature_schema_version") != SCHEMA_VERSION:
        return {
            "ml_available": False,
            "reason": (
                f"Model was trained on feature schema "
                f"{_metadata.get('feature_schema_version')!r} but the app now "
                f"expects {SCHEMA_VERSION!r}. Refusing to run inference with a "
                f"mismatched schema rather than silently mis-predicting — "
                f"retrain via app/ml/train.py."
            ),
        }
    try:
        vector = vectorize(feature_dict)
        proba = _model.predict_proba([vector])[0]
        classes = list(_model.classes_)
        ranked = sorted(zip(classes, proba), key=lambda x: -x[1])
        top_label, top_prob = ranked[0]

        symptoms_reported = [str(s).replace("_", " ") for s in feature_dict.get("symptoms", [])]
        species_name = str(feature_dict.get("species", "animal")).capitalize()
        if symptoms_reported:
            explanation = (
                f"Predicted {top_label} ({round(float(top_prob) * 100)}% confidence) based on "
                f"{len(symptoms_reported)} reported symptom(s) ({', '.join(symptoms_reported)}) in {species_name}."
            )
        else:
            explanation = (
                f"Predicted {top_label} ({round(float(top_prob) * 100)}% confidence) based on "
                f"baseline clinical indicators for {species_name}."
            )

        return {
            "ml_available": True,
            "predicted_disease": top_label,
            "confidence": round(float(top_prob), 3),
            "probabilities": {c: round(float(p), 3) for c, p in ranked},
            "explanation": explanation,
            "model_version": _metadata.get("model_version"),
            "trained_at": _metadata.get("trained_at"),
            "dataset_source": _metadata.get("dataset_source"),
        }
    except Exception as e:
        logger.error(f"[ml.service] Inference error: {e}", exc_info=True)
        return {"ml_available": False, "reason": f"Inference error: {e}"}
