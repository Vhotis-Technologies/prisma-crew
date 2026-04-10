"""
Shared helper for finding detailers by location.

Implements a three-step fallback:
1. Exact city match
2. Normalized city match (e.g. Ballentree Village -> Dublin)
3. Geographic radius search (30km) using lat/lng when provided
"""
from typing import Optional, Tuple

from django.db.models import QuerySet

from main.models import Detailer
from main.utils.city_normalization import normalize_city_for_matching
from main.utils.geo_utils import get_detailers_within_radius

# Default radius in km for geographic fallback (covers city limits)
DEFAULT_RADIUS_KM = 30.0


def find_detailers_for_location(
    country: str,
    city: str,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    is_available: Optional[bool] = None,
    radius_km: float = DEFAULT_RADIUS_KM,
) -> Tuple[QuerySet, Optional[str]]:
    """
    Find detailers for a client's location using a three-step fallback.

    Step 1: Exact city match (country + city)
    Step 2: Normalized city match (e.g. Ballentree Village -> Dublin)
    Step 3: Geographic radius search (30km) if lat/lng provided

    Args:
        country: Client country
        city: Client city (from address)
        latitude: Client latitude (optional, for Step 3)
        longitude: Client longitude (optional, for Step 3)
        is_available: Filter by is_available (True for booking, None for availability)
        radius_km: Radius in km for geographic fallback (default 30)

    Returns:
        Tuple of (detailers QuerySet, method_used) where method_used is
        'exact', 'normalized', 'radius', or None if no detailers found
    """
    if not country or not city:
        return Detailer.objects.none(), None

    country = country.strip()
    city = city.strip()

    # Base filters for all steps
    def apply_filters(qs):
        if is_available is not None:
            return qs.filter(is_available=is_available)
        return qs

    # Step 1: Exact city match
    detailers = Detailer.objects.filter(
        country__iexact=country,
        city__iexact=city,
        is_active=True,
        is_verified=True,
    )
    detailers = apply_filters(detailers)
    if detailers.exists():
        return detailers, "exact"

    # Step 2: Normalized city match
    normalized_city = normalize_city_for_matching(city)
    if normalized_city and normalized_city != city:
        detailers = Detailer.objects.filter(
            country__iexact=country,
            city__iexact=normalized_city,
            is_active=True,
            is_verified=True,
        )
        detailers = apply_filters(detailers)
        if detailers.exists():
            return detailers, "normalized"

    # Step 3: Geographic radius (only if lat/lng provided)
    if latitude is not None and longitude is not None:
        detailers = get_detailers_within_radius(
            lat=latitude,
            lng=longitude,
            radius_km=radius_km,
            country=country,
            is_available=is_available,
        )
        if detailers.exists():
            return detailers, "radius"

    return Detailer.objects.none(), None
