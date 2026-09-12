"""
Shared helper for finding detailers by location.

Requires client location to be within 35 km of Spire of Dublin.
Detailer matching uses city-based matching only (no detailer radius check).
"""
from typing import Optional, Tuple

from django.db.models import QuerySet

from main.models import Detailer
from main.utils.city_normalization import normalize_city_for_matching
from main.utils.geo_utils import classify_service_area


def find_detailers_for_location(
    country: str,
    city: str,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    is_available: Optional[bool] = None,
) -> Tuple[QuerySet, Optional[str], Optional[dict]]:
    """
    Find detailers for a client's location.

    MANDATORY: Client must be within 35 km of the Spire of Dublin.
    Detailer matching uses city-based matching only:
    Step 1: Exact city match (country + city)
    Step 2: Normalized city match (e.g. Ballentree Village -> Dublin)

    Args:
        country: Client country
        city: Client city (from address)
        latitude: Client latitude (REQUIRED for service area check)
        longitude: Client longitude (REQUIRED for service area check)
        is_available: Filter by is_available (True for booking, None for availability)

    Returns:
        Tuple of (detailers QuerySet, method_used, service_area_info) where:
        - method_used is 'exact', 'normalized', or None if no detailers found
        - service_area_info is dict with zone, distance_km, surcharge_eur (or None if out of area)
    """
    # Require lat/lng for service area check
    if latitude is None or longitude is None:
        return Detailer.objects.none(), None, {
            "error": "Location coordinates are required for service area validation"
        }
    
    # Check if client is within service area (≤35km from Spire)
    zone, distance_km, surcharge_eur = classify_service_area(latitude, longitude)
    
    if zone == "out_of_area":
        return Detailer.objects.none(), None, {
            "error": "out_of_range",
            "distance_km": round(distance_km, 2),
            "message": "Prisma Car Care is currently out of range. Contact support for booking."
        }
    
    service_area_info = {
        "zone": zone,
        "distance_km": round(distance_km, 2),
        "surcharge_eur": surcharge_eur
    }

    if not country or not city:
        return Detailer.objects.none(), None, service_area_info
    
    country = country.strip()
    city = city.strip()

    def apply_filters(qs):
        """Apply optional ``is_available`` filter to a detailer queryset."""
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
        return detailers, "exact", service_area_info

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
            return detailers, "normalized", service_area_info

    return Detailer.objects.none(), None, service_area_info
