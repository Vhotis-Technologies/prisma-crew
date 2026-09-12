"""
Shared helper for finding detailers by location.

Requires client location to be within 35 km of Spire of Dublin.
Once inside the service area, ALL active/verified detailers are eligible.
Redis GEO handles nearest-first ranking at booking time.
"""
from typing import Optional, Tuple

from django.db.models import QuerySet

from main.models import Detailer
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
    Once inside the service area, returns ALL active/verified detailers.
    City matching is no longer used - Spire distance is the only gate.

    Args:
        country: Client country (used for filtering detailers)
        city: Client city (logged but not used for filtering)
        latitude: Client latitude (REQUIRED for service area check)
        longitude: Client longitude (REQUIRED for service area check)
        is_available: Filter by is_available (True for booking, None for availability)

    Returns:
        Tuple of (detailers QuerySet, method_used, service_area_info) where:
        - method_used is 'spire_zone' when detailers found, None otherwise
        - service_area_info is dict with zone, distance_km, surcharge_eur (or error if out of area)
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

    # Client is within Spire service area - return all active/verified detailers
    # Redis GEO will rank them by proximity at booking time
    detailers = Detailer.objects.filter(
        is_active=True,
        is_verified=True,
    )
    
    # Optionally filter by country if provided (market-level filter)
    if country:
        detailers = detailers.filter(country__iexact=country.strip())
    
    # Apply availability filter if specified
    if is_available is not None:
        detailers = detailers.filter(is_available=is_available)
    
    if detailers.exists():
        return detailers, "spire_zone", service_area_info

    return Detailer.objects.none(), None, service_area_info
