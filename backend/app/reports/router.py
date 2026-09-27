from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.db import get_db
from app.core.security import get_current_user, require_roles
from app.core.utils import serialize, serialize_many, write_audit, oid
from app.gis.service import geojson_point, find_within_radius
from app.core.config import settings
from app.ai.risk_engine import assess_risk
from app.ml import service as ml_service
from app.ml.schema import build_feature_dict
from app.outbreak.service import evaluate_outbreak, find_nearby_similar_reports
from app.alerts.service import create_alert
from app.weather.service import get_weather, weather_disease_risk_note

router = APIRouter(prefix="/reports", tags=["Disease Reports"])

VALID_SYMPTOMS = {
    "fever", "reduced_appetite", "lethargy", "nasal_discharge", "coughing",
    "diarrhea", "skin_lesions", "swelling", "respiratory_difficulty", "sudden_mortality",
}


class ReportIn(BaseModel):
    animal_id: str
    farm_id: str
    species: str
    symptoms: list[str]
    symptom_duration_days: int = 1
    severity: str = Field(default="moderate")  # mild | moderate | severe | critical
    affected_head_count: int = 1
    mortality_count: int = 0
    vaccination_status: str = "unknown"  # vaccinated | unvaccinated | unknown
    latitude: float
    longitude: float
    village: str = ""
    district: str = ""
    image_url: str | None = None
    notes: str = ""


@router.post("")
def submit_report(payload: ReportIn, user: dict = Depends(require_roles("FARMER", "FIELD_WORKER", "SUPER_ADMIN"))):
    db = get_db()

    unknown = set(payload.symptoms) - VALID_SYMPTOMS
    if unknown:
        raise HTTPException(status_code=422, detail=f"Unrecognized symptoms: {sorted(unknown)}")

    location = geojson_point(payload.longitude, payload.latitude)

    report_doc = {
        "farmer_id": user["id"],
        "animal_id": payload.animal_id,
        "farm_id": payload.farm_id,
        "species": payload.species,
        "symptoms": payload.symptoms,
        "symptom_duration_days": payload.symptom_duration_days,
        "severity": payload.severity,
        "affected_head_count": payload.affected_head_count,
        "mortality_count": payload.mortality_count,
        "vaccination_status": payload.vaccination_status,
        "location": location,
        "village": payload.village,
        "district": payload.district,
        "image_url": payload.image_url,
        "notes": payload.notes,
        "created_at": datetime.utcnow(),
        "sync_status": "SYNCED",
    }
    result = db.disease_reports.insert_one(report_doc)
    report_doc["_id"] = result.inserted_id

    # --- GIS: nearby similar cases -------------------------------------
    all_reports = list(db.disease_reports.find({}))
    nearby = find_within_radius(all_reports, location, settings.NEARBY_CASE_RADIUS_KM, exclude_id=report_doc["_id"])
    symptom_set = set(payload.symptoms)
    nearby_similar = [r for r in nearby if symptom_set & set(r.get("symptoms", []))]

    # --- Outbreak engine (also gives us recent cluster size) ------------
    cluster_reports = find_nearby_similar_reports(db, report_doc)

    # --- ML Disease Prediction (PRIMARY layer — see docs/ml-disease-prediction.md) ---
    animal = db.animals.find_one({"_id": oid(payload.animal_id)}) if payload.animal_id else None
    farm = db.farms.find_one({"_id": oid(payload.farm_id)}) if payload.farm_id else None
    feature_dict = build_feature_dict(
        species=payload.species,
        symptoms=payload.symptoms,
        severity=payload.severity,
        symptom_duration_days=payload.symptom_duration_days,
        affected_head_count=payload.affected_head_count,
        mortality_count=payload.mortality_count,
        vaccination_status=payload.vaccination_status,
        age_months=(animal or {}).get("age_months", 0),
        herd_size=(farm or {}).get("livestock_count", 0),
        nearby_similar_case_count=len(nearby_similar),
    )
    ml_result = ml_service.predict(feature_dict)
    if ml_result["ml_available"]:
        disease_prediction = {
            "engine": "ML",
            "predicted_disease": ml_result["predicted_disease"],
            "confidence": ml_result["confidence"],
            "probabilities": ml_result["probabilities"],
            "model_version": ml_result["model_version"],
        }
    else:
        disease_prediction = {
            "engine": "RULE_BASED_FALLBACK",
            "predicted_disease": None,  # filled in below once assess_risk() runs
            "confidence": None,
            "reason": ml_result["reason"],
        }

    # --- Weather Intelligence (real Open-Meteo lookup at report coordinates;
    # never fabricated — see app/weather/service.py for failure handling) ---
    weather = get_weather(payload.latitude, payload.longitude)
    weather_note = weather_disease_risk_note(weather)
    db.disease_reports.update_one({"_id": report_doc["_id"]}, {"$set": {"weather_at_report": weather}})
    report_doc["weather_at_report"] = weather

    # --- AI Risk Engine (SECONDARY layer: operational risk/urgency, always
    # rule-based per the brief's layered architecture — combines symptoms +
    # herd context + outbreak/geographic/weather signals; disease
    # *identification* above is what ML replaces when a trained model is
    # available) -----------------------------------------------------------
    assessment = assess_risk(
        symptoms=payload.symptoms,
        severity=payload.severity,
        duration_days=payload.symptom_duration_days,
        affected_count=payload.affected_head_count,
        mortality_count=payload.mortality_count,
        vaccination_status=payload.vaccination_status,
        nearby_similar_case_count=len(nearby_similar),
        recent_cluster_case_count=len(cluster_reports),
        weather_risk_bonus=weather_note["risk_bonus_points"],
    )
    assessment["weather_context"] = weather_note
    if not ml_result["ml_available"]:
        disease_prediction["predicted_disease"] = assessment["disease_category"]
        disease_prediction["confidence"] = assessment["confidence"]
    assessment["disease_prediction"] = disease_prediction
    risk_doc = {**assessment, "report_id": str(report_doc["_id"]), "created_at": datetime.utcnow()}
    db.risk_scores.insert_one(dict(risk_doc))

    # --- Outbreak detection ----------------------------------------------
    outbreak = evaluate_outbreak(db, report_doc)

    # --- Case creation ------------------------------------------------
    case_doc = {
        "report_id": str(report_doc["_id"]),
        "farmer_id": user["id"],
        "animal_id": payload.animal_id,
        "farm_id": payload.farm_id,
        "species": payload.species,
        "risk_score": assessment["risk_score"],
        "risk_level": assessment["risk_level"],
        "disease_category": assessment["disease_category"],
        "disease_prediction": disease_prediction,
        "weather_at_report": weather,
        "outbreak_id": str(outbreak["_id"]) if outbreak else None,
        "status": "AI_TRIAGE",
        "assigned_vet_id": None,
        "assigned_field_worker_id": None,
        "location": location,
        "district": payload.district,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    case_result = db.cases.insert_one(case_doc)
    case_doc["_id"] = case_result.inserted_id

    # --- Alerts ------------------------------------------------------
    if assessment["risk_level"] in ("HIGH", "CRITICAL"):
        create_alert(
            db, alert_type="HIGH_RISK_CASE",
            priority="CRITICAL" if assessment["risk_level"] == "CRITICAL" else "HIGH",
            title=f"{assessment['risk_level']} risk case reported — {payload.species}",
            message=f"{assessment['disease_category']} suspected in {payload.village or payload.district}. "
                    f"Risk score {assessment['risk_score']}.",
            case_id=str(case_doc["_id"]), district=payload.district,
        )
    if outbreak:
        create_alert(
            db, alert_type="OUTBREAK_DETECTED",
            priority="CRITICAL" if outbreak["severity"] == "CRITICAL" else "HIGH",
            title=f"Potential outbreak detected — {payload.species} ({outbreak['case_count']} cases)",
            message=f"{outbreak['case_count']} similar cases within {outbreak['radius_km']}km in the last "
                    f"{settings.OUTBREAK_TIME_WINDOW_DAYS} days.",
            case_id=str(case_doc["_id"]), district=payload.district, outbreak_id=str(outbreak["_id"]),
        )

    write_audit(db, user, "CREATE", "disease_report", report_doc["_id"], {"risk_level": assessment["risk_level"]})

    return {
        "report": serialize(report_doc),
        "risk_assessment": assessment,
        "nearby_similar_cases": len(nearby_similar),
        "nearby_cases_preview": serialize_many(nearby_similar[:5]),
        "outbreak": serialize(outbreak) if outbreak else None,
        "case": serialize(case_doc),
    }


@router.get("")
def list_reports(user: dict = Depends(get_current_user)):
    db = get_db()
    if user["role"] == "FARMER":
        docs = db.disease_reports.find({"farmer_id": user["id"]})
    else:
        docs = db.disease_reports.find({})
    return serialize_many(list(docs))


@router.get("/{report_id}")
def get_report(report_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = db.disease_reports.find_one({"_id": oid(report_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    return serialize(doc)
