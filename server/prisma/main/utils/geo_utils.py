"""
Geographic utilities for detailer matching.

Uses the Haversine formula (pure Python, math module) to compute distances
between coordinates. No GeoDjango or external dependencies required.
"""
import math
from typing import Optional

# Earth's radius in kilometers
EARTH_RADIUS_KM = 6371.0


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Compute the great-circle distance between two points on Earth using the Haversine formula.

    Args:
        lat1: Latitude of first point (degrees)
        lon1: Longitude of first point (degrees)
        lat2: Latitude of second point (degrees)
        lon2: Longitude of second point (degrees)

    Returns:
        Distance in kilometers
    """
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)

    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.asin(math.sqrt(a))
    return EARTH_RADIUS_KM * c


def get_detailers_within_radius(
    lat: float,
    lng: float,
    radius_km: float = 30.0,
    country: Optional[str] = None,
    is_available: Optional[bool] = None,
):
    """
    Get detailers within a given radius of the client's location.

    Args:
        lat: Client latitude (degrees)
        lng: Client longitude (degrees)
        radius_km: Search radius in kilometers (default 30km)
        country: Optional country filter (case-insensitive)
        is_available: Optional filter for is_available (None = include all)

    Returns:
        QuerySet of Detailer objects within radius
    """
    from main.models import Detailer

    base_qs = Detailer.objects.filter(
        latitude__isnull=False,
        longitude__isnull=False,
        is_active=True,
        is_verified=True,
    )

    if country:
        base_qs = base_qs.filter(country__iexact=country.strip())
    if is_available is not None:
        base_qs = base_qs.filter(is_available=is_available)

    # Filter by haversine distance
    within_radius = []
    for detailer in base_qs:
        dist = haversine_distance_km(lat, lng, detailer.latitude, detailer.longitude)
        if dist <= radius_km:
            within_radius.append(detailer.id)

    return Detailer.objects.filter(id__in=within_radius)
