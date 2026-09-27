from app.ai.risk_engine import assess_risk, classify_risk_level, guess_disease_category


def test_mild_single_symptom_is_low_risk():
    result = assess_risk(
        symptoms=["lethargy"], severity="mild", duration_days=1,
        affected_count=1, mortality_count=0, vaccination_status="vaccinated",
    )
    assert result["risk_level"] == "LOW"
    assert result["veterinary_referral"] is False


def test_mortality_pushes_to_high_or_critical():
    result = assess_risk(
        symptoms=["fever", "respiratory_difficulty", "sudden_mortality"],
        severity="critical", duration_days=5,
        affected_count=6, mortality_count=3, vaccination_status="unvaccinated",
    )
    assert result["risk_level"] in ("HIGH", "CRITICAL")
    assert result["veterinary_referral"] is True


def test_nearby_and_cluster_cases_increase_score():
    base = assess_risk(
        symptoms=["fever", "diarrhea"], severity="moderate", duration_days=2,
        affected_count=2, mortality_count=0, vaccination_status="unknown",
    )
    boosted = assess_risk(
        symptoms=["fever", "diarrhea"], severity="moderate", duration_days=2,
        affected_count=2, mortality_count=0, vaccination_status="unknown",
        nearby_similar_case_count=5, recent_cluster_case_count=4,
    )
    assert boosted["risk_score"] > base["risk_score"]


def test_score_bounded_between_0_and_1():
    result = assess_risk(
        symptoms=list({"fever", "skin_lesions", "respiratory_difficulty", "sudden_mortality"}),
        severity="critical", duration_days=30, affected_count=50, mortality_count=50,
        vaccination_status="unvaccinated", nearby_similar_case_count=50, recent_cluster_case_count=50,
    )
    assert 0.0 <= result["risk_score"] <= 1.0
    assert result["risk_level"] == "CRITICAL"


def test_classify_risk_level_thresholds():
    assert classify_risk_level(0.1) == "LOW"
    assert classify_risk_level(0.3) == "MODERATE"
    assert classify_risk_level(0.6) == "HIGH"
    assert classify_risk_level(0.9) == "CRITICAL"


def test_disease_category_never_claims_diagnosis():
    label, _ = guess_disease_category({"fever", "skin_lesions"})
    assert "Suspected" in label or "Undetermined" in label
    assert "diagnosis" not in label.lower()


def test_disclaimer_always_present():
    result = assess_risk(symptoms=["fever"], severity="mild", duration_days=1,
                          affected_count=1, mortality_count=0, vaccination_status="unknown")
    assert "does not replace professional veterinary diagnosis" in result["disclaimer"]
