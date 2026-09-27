"""
Outbreak Detection Engine — basic spatial-temporal clustering.

Algorithm (documented fully in docs/outbreak-detection.md):

For a newly submitted disease report:
  1. Find other disease_reports within OUTBREAK_RADIUS_KM of this report's
     location, reported within the last OUTBREAK_TIME_WINDOW_DAYS days.
  2. Among those, count how many share at least one overlapping symptom
     with the new report ("symptom similarity").
  3. If the number of similar nearby recent cases (including this one)
     reaches OUTBREAK_MIN_CASES, flag/extend an outbreak cluster.
  4. Mortality in the cluster raises the outbreak's own severity but is not
     required to trigger detection.

This is intentionally a simple, explainable heuristic — not a
research-grade spatio-temporal epidemiological model (e.g. no
scan-statistics / Kulldorff SaTScan-style modeling), per hackathon scope.
"""
from datetime import datetime, timedelta

from app.core.config import settings
from app.gis.service import find_within_radius


def find_nearby_similar_reports(db, report: dict) -> list:
    since = datetime.utcnow() - timedelta(days=settings.OUTBREAK_TIME_WINDOW_DAYS)
    all_reports = list(db.disease_reports.find({}))
    nearby = find_within_radius(
        all_reports, report["location"], settings.NEARBY_CASE_RADIUS_KM,
        exclude_id=report.get("_id"),
    )
    symptoms = set(report.get("symptoms", []))
    similar = []
    for r in nearby:
        r_time = r.get("created_at")
        if r_time and r_time < since:
            continue
        if symptoms & set(r.get("symptoms", [])):
            similar.append(r)
    return similar


def evaluate_outbreak(db, report: dict) -> dict | None:
    """Run after a disease report is created. Returns the outbreak record
    (new or updated) if the cluster threshold is met, else None."""
    similar = find_nearby_similar_reports(db, report)
    cluster_reports = similar + [report]

    if len(cluster_reports) < settings.OUTBREAK_MIN_CASES:
        return None

    lon, lat = report["location"]["coordinates"]
    species = report.get("species")
    symptom_union = set()
    total_mortality = 0
    report_ids = []
    for r in cluster_reports:
        symptom_union |= set(r.get("symptoms", []))
        total_mortality += r.get("mortality_count", 0) or 0
        report_ids.append(r.get("_id"))

    existing = db.outbreaks.find_one({
        "species": species,
        "status": {"$in": ["ACTIVE", "MONITORING"]},
    })

    severity = "CRITICAL" if total_mortality > 3 or len(cluster_reports) >= settings.OUTBREAK_MIN_CASES + 3 else "HIGH"

    outbreak_doc = {
        "species": species,
        "center": {"type": "Point", "coordinates": [lon, lat]},
        "radius_km": settings.OUTBREAK_RADIUS_KM,
        "case_count": len(cluster_reports),
        "report_ids": list({str(i) for i in report_ids}),
        "symptoms": sorted(symptom_union),
        "total_mortality": total_mortality,
        "severity": severity,
        "status": "ACTIVE",
        "detected_at": existing["detected_at"] if existing else datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    if existing:
        db.outbreaks.update_one({"_id": existing["_id"]}, {"$set": outbreak_doc})
        outbreak_doc["_id"] = existing["_id"]
    else:
        result = db.outbreaks.insert_one(outbreak_doc)
        outbreak_doc["_id"] = result.inserted_id

    return outbreak_doc
