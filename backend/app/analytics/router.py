from collections import Counter, defaultdict
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends

from app.core.db import get_db
from app.core.security import require_roles

router = APIRouter(prefix="/dashboard", tags=["Government Dashboard"])


@router.get("/overview")
def overview(user: dict = Depends(require_roles("DISTRICT_ADMIN", "STATE_ADMIN", "SUPER_ADMIN"))):
    db = get_db()
    farms = list(db.farms.find({}))
    animals = list(db.animals.find({}))
    cases = list(db.cases.find({}))
    outbreaks = list(db.outbreaks.find({}))
    vaccinations = list(db.vaccinations.find({}))
    reports = list(db.disease_reports.find({}))

    risk_counts = Counter(c.get("risk_level") for c in cases)
    status_counts = Counter(c.get("status") for c in cases)
    species_counts = Counter(c.get("species") for c in cases)
    district_counts = Counter(c.get("district") for c in cases if c.get("district"))
    total_mortality = sum(r.get("mortality_count", 0) or 0 for r in reports)

    # Real ML vs. rule-based-fallback coverage across all cases — makes the
    # honesty contract from docs/ml-disease-prediction.md visible to
    # government users too, not just the Vet UI.
    engine_counts = Counter(
        (c.get("disease_prediction") or {}).get("engine", "RULE_BASED_FALLBACK") for c in cases
    )

    vaccinated_animal_ids = {v["animal_id"] for v in vaccinations}
    vaccination_coverage_pct = round(100 * len(vaccinated_animal_ids) / len(animals), 1) if animals else 0.0

    # Trend: cases per day for the last 30 days
    since = datetime.utcnow() - timedelta(days=30)
    trend = defaultdict(int)
    for c in cases:
        created = c.get("created_at")
        if created and created >= since:
            trend[created.strftime("%Y-%m-%d")] += 1
    trend_series = [{"date": d, "count": n} for d, n in sorted(trend.items())]

    return {
        "totals": {
            "farms": len(farms),
            "animals": len(animals),
            "active_cases": len([c for c in cases if c.get("status") not in ("RESOLVED",)]),
            "suspected_cases": len([c for c in cases if c.get("status") in ("AI_TRIAGE", "REPORTED")]),
            "high_risk_cases": risk_counts.get("HIGH", 0),
            "critical_cases": risk_counts.get("CRITICAL", 0),
            "resolved_cases": status_counts.get("RESOLVED", 0),
            "total_mortality": total_mortality,
            "active_outbreaks": len([o for o in outbreaks if o.get("status") == "ACTIVE"]),
            "vaccination_records": len(vaccinations),
            "vaccination_coverage_pct": vaccination_coverage_pct,
        },
        "risk_distribution": dict(risk_counts),
        "status_distribution": dict(status_counts),
        "species_distribution": dict(species_counts),
        "district_distribution": dict(district_counts),
        "case_trend_30d": trend_series,
        "disease_prediction_engine_distribution": dict(engine_counts),
    }


@router.get("/laboratory")
def lab_overview(user: dict = Depends(require_roles("DISTRICT_ADMIN", "STATE_ADMIN", "SUPER_ADMIN"))):
    db = get_db()
    samples = list(db.samples.find({}))
    status_counts = Counter(s.get("status") for s in samples)
    return {"total_samples": len(samples), "status_distribution": dict(status_counts)}


@router.get("/veterinary-response")
def vet_response(user: dict = Depends(require_roles("DISTRICT_ADMIN", "STATE_ADMIN", "SUPER_ADMIN"))):
    db = get_db()
    visits = list(db.field_visits.find({}))
    treatments = list(db.treatments.find({}))
    cases = list(db.cases.find({}))
    assigned = len([c for c in cases if c.get("assigned_vet_id")])
    fw_assigned = len([c for c in cases if c.get("assigned_field_worker_id")])
    return {
        "total_field_visits": len(visits),
        "total_treatments": len(treatments),
        "assigned_cases": assigned,
        "unassigned_cases": len(cases) - assigned,
        "field_worker_assigned_cases": fw_assigned,
        "field_worker_unassigned_cases": len(cases) - fw_assigned,
    }
