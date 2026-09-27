"""
GIS Engine — geo helper functions.

Uses GeoJSON Point format everywhere: {"type": "Point", "coordinates": [lon, lat]}

For demo-mode (mongomock) compatibility, proximity queries are computed in
Python with the haversine formula rather than relying on MongoDB's native
$geoNear / $near operators. Against a real MongoDB Atlas cluster in
production, farms/disease_reports/outbreaks collections carry real
2dsphere indexes (see app/core/db.py) and this layer can be swapped for a
native $geoNear aggregation for better performance at scale.
"""
import math


def haversine_km(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """Great-circle distance between two points in kilometers."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def geojson_point(lon: float, lat: float) -> dict:
    return {"type": "Point", "coordinates": [lon, lat]}


def point_coords(location: dict):
    """Return (lon, lat) from a GeoJSON point, tolerating missing data."""
    if not location or "coordinates" not in location:
        return None
    lon, lat = location["coordinates"]
    return lon, lat


def find_within_radius(documents: list, location: dict, radius_km: float, exclude_id=None):
    """Given a list of Mongo documents each with a 'location' GeoJSON field,
    return those within radius_km of the given location, sorted nearest-first."""
    coords = point_coords(location)
    if not coords:
        return []
    lon, lat = coords
    results = []
    for doc in documents:
        if exclude_id is not None and doc.get("_id") == exclude_id:
            continue
        dcoords = point_coords(doc.get("location"))
        if not dcoords:
            continue
        dlon, dlat = dcoords
        dist = haversine_km(lon, lat, dlon, dlat)
        if dist <= radius_km:
            doc = dict(doc)
            doc["distance_km"] = round(dist, 2)
            results.append(doc)
    results.sort(key=lambda d: d["distance_km"])
    return results
