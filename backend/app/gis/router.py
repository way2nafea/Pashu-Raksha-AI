from fastapi import APIRouter, Depends
from app.core.db import get_db
from app.core.security import get_current_user
from app.core.utils import serialize_many

router = APIRouter(prefix="/gis", tags=["GIS"])


@router.get("/map-data")
def map_data(district: str = None, species: str = None, risk_level: str = None,
             user: dict = Depends(get_current_user)):
    """Combined GeoJSON-friendly payload for the Leaflet map: farms, cases, outbreaks."""
    db = get_db()

    case_query = {}
    if district:
        case_query["district"] = district
    if species:
        case_query["species"] = species
    if risk_level:
        case_query["risk_level"] = risk_level

    cases = list(db.cases.find(case_query))
    farms = list(db.farms.find({"district": district} if district else {}))
    outbreaks = list(db.outbreaks.find({"status": "ACTIVE"}))

    return {
        "farms": serialize_many(farms),
        "cases": serialize_many(cases),
        "outbreaks": serialize_many(outbreaks),
    }


@router.get("/outbreaks")
def list_outbreaks(user: dict = Depends(get_current_user)):
    db = get_db()
    return serialize_many(list(db.outbreaks.find({}).sort("detected_at", -1)))
