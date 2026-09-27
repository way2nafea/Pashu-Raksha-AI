"""
Central configuration for PASHU-RAKSHAK AI backend.

PERSISTENCE MODE (DEMO_MODE flag):
If MONGODB_URI is not set, the app falls back to mongomock — an in-memory,
API-compatible MongoDB substitute. This is a DEVELOPER CONVENIENCE ONLY
(e.g. running the API without installing MongoDB locally). Data created in
this mode does NOT survive a backend restart and is NOT real persistence.

IMPORTANT: this fallback must never be relied on for an actual evaluation,
demo, or production run. Set MONGODB_URI to a real MongoDB instance
(local `mongod` or MongoDB Atlas) before running the SIH judged demo — see
docs/database.md and .env.example. The app logs a loud warning at startup
whenever it is running without a real MONGODB_URI (see app/main.py).
"""
import os
from datetime import timedelta

from dotenv import load_dotenv


load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))


class Settings:
    APP_NAME: str = "PASHU-RAKSHAK AI"
    API_V1_PREFIX: str = "/api/v1"

    MONGODB_URI: str = os.getenv("MONGODB_URI", "")
    MONGODB_DB: str = os.getenv("MONGODB_DB", "pashurakshak")
    DEMO_MODE: bool = MONGODB_URI.strip() == ""

    JWT_SECRET: str = os.getenv("JWT_SECRET", "dev-secret-change-me-in-production-2f8a9c")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE: timedelta = timedelta(hours=12)

    CORS_ORIGINS: list = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000",
        ).split(",")
        if origin.strip()
    ]
    GOOGLE_MAPS_API_KEY: str = os.getenv("GOOGLE_MAPS_API_KEY", "")
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")

    # Outbreak detection tuning (documented in docs/outbreak-detection.md)
    OUTBREAK_RADIUS_KM: float = float(os.getenv("OUTBREAK_RADIUS_KM", "10"))
    OUTBREAK_TIME_WINDOW_DAYS: int = int(os.getenv("OUTBREAK_TIME_WINDOW_DAYS", "14"))
    OUTBREAK_MIN_CASES: int = int(os.getenv("OUTBREAK_MIN_CASES", "3"))

    NEARBY_CASE_RADIUS_KM: float = float(os.getenv("NEARBY_CASE_RADIUS_KM", "15"))


settings = Settings()
