"""
AI Risk Engine — Phase 1: Deterministic Rule-Based Expert System.

This is intentionally NOT a trained ML model. It is a transparent,
explainable scoring system built from veterinary-triage heuristics, as
specified for the hackathon prototype. A future phase can retrain this as
an XGBoost/scikit-learn classifier without changing the API contract
below (see docs/ai-risk-engine.md).

The engine returns a DECISION-SUPPORT assessment. It never claims to
provide a confirmed diagnosis.
"""

# Symptom -> point weight (severity contribution), and rough disease-category
# association used only to suggest a *possible* category, never a diagnosis.
SYMPTOM_WEIGHTS = {
    "fever": 12,
    "reduced_appetite": 6,
    "lethargy": 6,
    "nasal_discharge": 10,
    "coughing": 8,
    "diarrhea": 10,
    "skin_lesions": 14,
    "swelling": 8,
    "respiratory_difficulty": 16,
    "sudden_mortality": 25,
}

# Symptom clusters loosely associated with a *suspected* condition category.
# This is a simplified illustrative mapping for a hackathon prototype, not a
# veterinary diagnostic reference.
CATEGORY_RULES = [
    ("Suspected Foot-and-Mouth-Disease-like syndrome",
     {"fever", "skin_lesions", "reduced_appetite"}),
    ("Suspected Hemorrhagic Septicemia-like syndrome",
     {"fever", "respiratory_difficulty", "sudden_mortality"}),
    ("Suspected respiratory infection",
     {"coughing", "nasal_discharge", "respiratory_difficulty"}),
    ("Suspected enteric / gastrointestinal infection",
     {"diarrhea", "lethargy", "reduced_appetite"}),
    ("Suspected Lumpy Skin Disease-like syndrome",
     {"skin_lesions", "fever", "swelling"}),
]


def _severity_multiplier(severity: str) -> float:
    return {"mild": 0.6, "moderate": 1.0, "severe": 1.4, "critical": 1.8}.get(
        (severity or "moderate").lower(), 1.0
    )


def _duration_multiplier(duration_days: int) -> float:
    if duration_days is None:
        return 1.0
    if duration_days <= 1:
        return 0.8
    if duration_days <= 3:
        return 1.0
    if duration_days <= 7:
        return 1.2
    return 1.4


def classify_risk_level(score: float) -> str:
    if score >= 0.75:
        return "CRITICAL"
    if score >= 0.5:
        return "HIGH"
    if score >= 0.25:
        return "MODERATE"
    return "LOW"


def guess_disease_category(symptoms: set) -> tuple[str, float]:
    best_label, best_overlap = "Undetermined — insufficient symptom pattern", 0
    for label, cluster in CATEGORY_RULES:
        overlap = len(symptoms & cluster)
        if overlap > best_overlap:
            best_overlap, best_label = overlap, label
    confidence = 0.0
    if best_overlap > 0:
        # confidence scales with how much of the reference cluster matched
        biggest_cluster = max(len(c) for _, c in CATEGORY_RULES)
        confidence = round(min(1.0, best_overlap / biggest_cluster + 0.3), 2)
    return best_label, confidence


def assess_risk(
    symptoms: list[str],
    severity: str,
    duration_days: int,
    affected_count: int,
    mortality_count: int,
    vaccination_status: str,
    nearby_similar_case_count: int = 0,
    recent_cluster_case_count: int = 0,
    weather_risk_bonus: float = 0,
) -> dict:
    """
    Core rule-based scoring function. Every contribution below is a
    documented, transparent rule (see docs/ai-risk-engine.md for the
    written spec matching this code).
    """
    symptom_set = set(symptoms or [])

    # 1. Base symptom severity points (each compatible symptom contributes)
    symptom_points = sum(SYMPTOM_WEIGHTS.get(s, 4) for s in symptom_set)

    # 2. Severity & duration multipliers
    points = symptom_points * _severity_multiplier(severity) * _duration_multiplier(duration_days)

    # 3. Mortality contributes strongly
    if mortality_count and mortality_count > 0:
        points += 30 + min(mortality_count, 10) * 5

    # 4. Multiple affected animals contribute
    if affected_count and affected_count > 1:
        points += min(affected_count, 20) * 2

    # 5. Unvaccinated status increases risk
    if (vaccination_status or "unknown").lower() in ("unvaccinated", "unknown"):
        points += 8

    # 6. Nearby similar cases increase risk (fed in by GIS/outbreak layer)
    points += min(nearby_similar_case_count, 10) * 4

    # 7. Recent cluster activity increases risk further
    points += min(recent_cluster_case_count, 10) * 6

    # 8. Weather-context bonus (see app/weather/service.py:weather_disease_risk_note —
    # a small, transparent, illustrative signal; 0 when weather is unavailable)
    points += weather_risk_bonus

    # Normalize to 0.0 - 1.0 against an empirically chosen ceiling (150 pts)
    # so a single severe multi-symptom + mortality + cluster case saturates
    # near 1.0 without every single-symptom mild report reading as HIGH.
    CEILING = 150.0
    risk_score = max(0.0, min(1.0, points / CEILING))
    risk_level = classify_risk_level(risk_score)

    category, category_confidence = guess_disease_category(symptom_set)

    recommended_action = {
        "LOW": "Monitor animal; recheck in 48 hours; no immediate veterinary visit required.",
        "MODERATE": "Schedule a veterinary review within 3-5 days; isolate animal if practical.",
        "HIGH": "Veterinary field visit recommended within 24 hours; isolate affected animals.",
        "CRITICAL": "Immediate veterinary field visit required; isolate herd; notify district animal husbandry office.",
    }[risk_level]

    veterinary_referral = risk_level in ("HIGH", "CRITICAL")

    return {
        "risk_score": round(risk_score, 3),
        "risk_level": risk_level,
        "disease_category": category,
        "confidence": category_confidence,
        "recommended_action": recommended_action,
        "veterinary_referral": veterinary_referral,
        "disclaimer": (
            "AI-assisted preliminary risk assessment. This assessment supports "
            "veterinary triage and does not replace professional veterinary diagnosis."
        ),
        "scoring_breakdown": {
            "symptom_points": round(symptom_points, 1),
            "severity_multiplier": _severity_multiplier(severity),
            "duration_multiplier": _duration_multiplier(duration_days),
            "mortality_bonus": 30 + min(mortality_count, 10) * 5 if mortality_count else 0,
            "affected_count_bonus": min(affected_count or 0, 20) * 2,
            "unvaccinated_bonus": 8 if (vaccination_status or "unknown").lower() in ("unvaccinated", "unknown") else 0,
            "nearby_case_bonus": min(nearby_similar_case_count, 10) * 4,
            "cluster_bonus": min(recent_cluster_case_count, 10) * 6,
            "weather_bonus": weather_risk_bonus,
            "raw_points": round(points, 1),
            "ceiling": CEILING,
        },
    }


def compute_herd_risk(*, total_animals: int, affected_animals: int, active_case_risk_levels: list[str],
                       vaccination_coverage_pct: float, mortality_reported: int,
                       weather_risk_bonus: float = 0) -> dict:
    """
    Herd-level risk aggregation (SIH Round-2 section 17). Every input here
    is a real, already-computed value from the caller (app/farms/router.py
    aggregates them straight from MongoDB) — this function only combines
    them transparently into a level + human-readable reasons. It never
    looks up or invents data of its own, and it reuses the exact same
    LOW/MODERATE/HIGH/CRITICAL thresholds as individual-case risk via
    classify_risk_level() so the two scales stay comparable.
    """
    if total_animals == 0:
        return {
            "herd_risk_level": "INSUFFICIENT_DATA",
            "reasons": ["No animals registered on this farm yet."],
            "points": 0,
        }

    points = 0.0
    reasons = []

    pct_affected = affected_animals / total_animals
    if pct_affected > 0:
        points += pct_affected * 60
        reasons.append(f"{affected_animals}/{total_animals} animals ({round(pct_affected * 100)}%) currently have an active case")

    critical_count = active_case_risk_levels.count("CRITICAL")
    high_count = active_case_risk_levels.count("HIGH")
    if critical_count:
        points += critical_count * 20
        reasons.append(f"{critical_count} active CRITICAL-risk case(s)")
    if high_count:
        points += high_count * 10
        reasons.append(f"{high_count} active HIGH-risk case(s)")

    if vaccination_coverage_pct < 50:
        points += 15
        reasons.append(f"Low vaccination coverage ({vaccination_coverage_pct}%)")
    elif vaccination_coverage_pct < 80:
        points += 6
        reasons.append(f"Moderate vaccination coverage ({vaccination_coverage_pct}%)")

    if mortality_reported and mortality_reported > 0:
        points += min(mortality_reported, 10) * 5
        reasons.append(f"{mortality_reported} mortality reported")

    if weather_risk_bonus:
        points += weather_risk_bonus
        reasons.append("Current weather conditions add disease-risk context")

    level = classify_risk_level(min(1.0, points / 100.0))
    if not reasons:
        reasons.append("No active cases, adequate vaccination coverage, no reported mortality.")

    return {"herd_risk_level": level, "reasons": reasons, "points": round(points, 1)}
