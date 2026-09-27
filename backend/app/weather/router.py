from fastapi import APIRouter, Depends

from app.core.security import get_current_user
from app.weather.service import get_weather

router = APIRouter(prefix="/weather", tags=["Weather"])


@router.get("")
def weather_for_location(latitude: float, longitude: float, user: dict = Depends(get_current_user)):
    """Real current conditions + 3-day forecast for any coordinates (farm,
    case, or report location). Never fabricates data — returns
    {"available": false, "reason": "..."} on any failure; the frontend must
    render that state explicitly rather than hide it."""
    return get_weather(latitude, longitude)
