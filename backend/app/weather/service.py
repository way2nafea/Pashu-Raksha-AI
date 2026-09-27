"""
Real weather intelligence via Open-Meteo (https://open-meteo.com) — free,
no API key required, so no secret needs to be documented in .env.example.

HONESTY CONTRACT: this module never fabricates weather. Every failure mode
(no coordinates, network unreachable, timeout, non-200 response, malformed
payload) returns {"available": False, "reason": "..."} instead of raising
or inventing plausible-looking numbers. Callers must check "available"
before using the data and must render a clear "weather unavailable" state
rather than silently omitting it or fabricating.
"""
from datetime import datetime, timezone

import httpx

from app.core.config import settings

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
REQUEST_TIMEOUT_SECONDS = 6.0
GOOGLE_WEATHER_CURRENT_URL = "https://weather.googleapis.com/v1/currentConditions:lookup"
GOOGLE_WEATHER_DAILY_URL = "https://weather.googleapis.com/v1/forecast/days:lookup"
GOOGLE_AIR_QUALITY_URL = "https://airquality.googleapis.com/v1/currentConditions:lookup"

# WMO weather codes (Open-Meteo uses the standard WMO code table) mapped to
# short human labels for the handful of conditions most relevant to a
# farmer/vet reading this at a glance. Unmapped codes fall back to the
# numeric code itself rather than a guessed label.
WMO_LABELS = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Depositing rime fog",
    51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
    61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
    71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow",
    80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
    95: "Thunderstorm",
}


def _parse(data: dict) -> dict:
    current = data.get("current", {}) or {}
    daily = data.get("daily", {}) or {}
    days = daily.get("time", []) or []

    forecast = []
    for i in range(min(3, len(days))):
        forecast.append({
            "date": days[i],
            "temp_max_c": (daily.get("temperature_2m_max") or [None] * len(days))[i],
            "temp_min_c": (daily.get("temperature_2m_min") or [None] * len(days))[i],
            "precipitation_sum_mm": (daily.get("precipitation_sum") or [None] * len(days))[i],
        })

    weather_code = current.get("weather_code")
    return {
        "available": True,
        "source": "Open-Meteo (api.open-meteo.com)",
        "fetched_at_utc": datetime.now(timezone.utc).isoformat(),
        "current": {
            "temperature_c": current.get("temperature_2m"),
            "humidity_pct": current.get("relative_humidity_2m"),
            "precipitation_mm": current.get("precipitation"),
            "weather_code": weather_code,
            "condition": WMO_LABELS.get(weather_code, f"Code {weather_code}" if weather_code is not None else "Unknown"),
        },
        "forecast_3day": forecast,
    }


def get_weather(latitude: float | None, longitude: float | None) -> dict:
    if latitude is None or longitude is None:
        return {"available": False, "reason": "No coordinates provided for this location."}
    try:
        if settings.GOOGLE_MAPS_API_KEY.strip():
            return _get_google_weather(latitude, longitude)
        return _get_open_meteo_weather(latitude, longitude)
    except httpx.TimeoutException:
        return {"available": False, "reason": "Weather service timed out."}
    except httpx.HTTPStatusError as e:
        return {"available": False, "reason": f"Weather service returned HTTP {e.response.status_code}."}
    except httpx.RequestError as e:
        return {"available": False, "reason": f"Weather service unreachable: {e}"}
    except (ValueError, KeyError, TypeError) as e:
        return {"available": False, "reason": f"Weather service returned an unexpected response: {e}"}


def _get_open_meteo_weather(latitude: float, longitude: float) -> dict:
    try:
        response = httpx.get(
            OPEN_METEO_URL,
            params={
                "latitude": latitude,
                "longitude": longitude,
                "current": "temperature_2m,relative_humidity_2m,precipitation,weather_code",
                "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum",
                "forecast_days": 3,
                "timezone": "auto",
            },
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        return _parse(response.json())
    except Exception:
        raise


def _google_params(api_key: str, latitude: float, longitude: float) -> dict:
    return {
        "key": api_key,
        "location.latitude": latitude,
        "location.longitude": longitude,
    }


def _degrees(value: dict | None) -> float | None:
    return value.get("degrees") if value else None


def _google_day(day: dict) -> dict:
    daytime = day.get("daytimeForecast", {})
    condition = daytime.get("weatherCondition", {}).get("description", {}).get("text", "Unknown")
    date = day.get("displayDate", {})
    date_text = "-".join(str(date.get(key, "")) for key in ("year", "month", "day"))
    return {
        "date": date_text,
        "temp_max_c": _degrees(day.get("maxTemperature")),
        "temp_min_c": _degrees(day.get("minTemperature")),
        "feels_like_max_c": _degrees(day.get("feelsLikeMaxTemperature")),
        "heat_index_c": _degrees(day.get("maxHeatIndex")),
        "humidity_pct": daytime.get("relativeHumidity"),
        "uv_index": daytime.get("uvIndex"),
        "precipitation_probability_pct": daytime.get("precipitation", {}).get("probability", {}).get("percent"),
        "precipitation_sum_mm": daytime.get("precipitation", {}).get("qpf", {}).get("quantity"),
        "thunderstorm_probability_pct": daytime.get("thunderstormProbability"),
        "condition": condition,
    }


def _get_google_weather(latitude: float, longitude: float) -> dict:
    key = settings.GOOGLE_MAPS_API_KEY.strip()
    params = _google_params(key, latitude, longitude)
    current_response = httpx.get(GOOGLE_WEATHER_CURRENT_URL, params={**params, "unitsSystem": "METRIC"}, timeout=REQUEST_TIMEOUT_SECONDS)
    current_response.raise_for_status()
    current = current_response.json()

    daily_response = httpx.get(GOOGLE_WEATHER_DAILY_URL, params={**params, "days": 3, "pageSize": 3}, timeout=REQUEST_TIMEOUT_SECONDS)
    daily_response.raise_for_status()
    daily = daily_response.json()

    air_response = httpx.post(
        GOOGLE_AIR_QUALITY_URL,
        params={"key": key},
        json={
            "universalAqi": True,
            "location": {"latitude": latitude, "longitude": longitude},
            "extraComputations": ["HEALTH_RECOMMENDATIONS", "DOMINANT_POLLUTANT_CONCENTRATION", "POLLUTANT_CONCENTRATION"],
            "languageCode": "en",
        },
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    air_response.raise_for_status()
    air = air_response.json()

    weather = current.get("weatherCondition", {})
    precipitation = current.get("precipitation", {})
    wind = current.get("wind", {})
    return {
        "available": True,
        "source": "Google Maps Platform Weather API + Air Quality API",
        "fetched_at_utc": datetime.now(timezone.utc).isoformat(),
        "current": {
            "temperature_c": _degrees(current.get("temperature")),
            "feels_like_c": _degrees(current.get("feelsLikeTemperature")),
            "dew_point_c": _degrees(current.get("dewPoint")),
            "heat_index_c": _degrees(current.get("heatIndex")),
            "humidity_pct": current.get("relativeHumidity"),
            "uv_index": current.get("uvIndex"),
            "precipitation_mm": precipitation.get("qpf", {}).get("quantity"),
            "precipitation_probability_pct": precipitation.get("probability", {}).get("percent"),
            "thunderstorm_probability_pct": current.get("thunderstormProbability"),
            "pressure_millibars": current.get("airPressure", {}).get("meanSeaLevelMillibars"),
            "wind_speed_kmh": wind.get("speed", {}).get("value"),
            "wind_gust_kmh": wind.get("gust", {}).get("value"),
            "wind_direction": wind.get("direction", {}).get("cardinal"),
            "visibility_km": current.get("visibility", {}).get("distance"),
            "cloud_cover_pct": current.get("cloudCover"),
            "weather_code": weather.get("type"),
            "condition": weather.get("description", {}).get("text", "Unknown"),
            "icon_url": weather.get("iconBaseUri"),
        },
        "forecast_3day": [_google_day(day) for day in daily.get("forecastDays", [])[:3]],
        "air_quality": _parse_air_quality(air),
        "animal_health": _animal_health_context(current, air),
    }


def _parse_air_quality(data: dict) -> dict:
    indexes = data.get("indexes", [])
    primary = next((item for item in indexes if item.get("code") == "uaqi"), indexes[0] if indexes else {})
    pollutants = {}
    for pollutant in data.get("pollutants", []):
        concentration = pollutant.get("concentration", {})
        pollutants[pollutant.get("code", "unknown")] = {
            "name": pollutant.get("fullName", pollutant.get("displayName")),
            "value": concentration.get("value"),
            "units": concentration.get("units"),
            "effects": pollutant.get("additionalInfo", {}).get("effects"),
        }
    return {
        "aqi": primary.get("aqi"),
        "category": primary.get("category"),
        "dominant_pollutant": primary.get("dominantPollutant"),
        "pollutants": pollutants,
        "health_recommendations": data.get("healthRecommendations", {}),
    }


def _animal_health_context(current: dict, air: dict) -> dict:
    temperature = _degrees(current.get("heatIndex")) or _degrees(current.get("temperature"))
    humidity = current.get("relativeHumidity")
    aqi = next((item.get("aqi") for item in air.get("indexes", []) if item.get("code") == "uaqi"), None)
    risks = []
    if temperature is not None and temperature >= 35:
        risks.append("heat stress risk: provide shade, water, and reduce handling")
    if humidity is not None and humidity >= 80:
        risks.append("high humidity: improve ventilation and monitor respiratory signs")
    if aqi is not None and aqi >= 100:
        risks.append("poor air quality: reduce dust/smoke exposure and monitor breathing")
    return {"risk_level": "ELEVATED" if risks else "NORMAL", "alerts": risks}


def weather_disease_risk_note(weather: dict) -> dict:
    """A small, transparent, illustrative heuristic connecting current
    weather to disease-risk context — same "not a diagnostic reference"
    spirit as app/ai/risk_engine.py's CATEGORY_RULES. Returns a zero bonus
    with a clear note when weather is unavailable, rather than guessing."""
    if not weather.get("available"):
        return {"risk_bonus_points": 0, "note": "Weather unavailable — not factored into this assessment."}

    current = weather["current"]
    humidity = current.get("humidity_pct")
    precip = current.get("precipitation_mm")
    bonus = 0
    notes = []
    if humidity is not None and humidity >= 75:
        bonus += 4
        notes.append("high humidity can favor respiratory and vector-borne disease spread")
    if precip is not None and precip > 0:
        bonus += 3
        notes.append("recent/current precipitation can increase enteric disease risk and vector breeding sites")
    animal_health = weather.get("animal_health", {})
    if animal_health.get("alerts"):
        bonus += min(6, len(animal_health["alerts"]) * 3)
        notes.extend(animal_health["alerts"])

    return {
        "risk_bonus_points": bonus,
        "note": "; ".join(notes) if notes else "Current weather shows no elevated disease-risk signal.",
    }
