"""
Redis GEO helpers for detailer location.
Uses the same Redis connection as redis_streams (detailers:geo key shared with client server).
"""
from typing import List, Optional, Tuple

from main.utils.redis_streams import get_redis

REDIS_KEY_DETAILERS_GEO = "detailers:geo"


def update_detailer_location(detailer_id: int, longitude: float, latitude: float) -> None:
    """
    Add or update a detailer's position in Redis GEO set.
    Redis GEOADD order is (longitude, latitude).
    """
    r = get_redis(decode_responses=True)
    try:
        r.geoadd(REDIS_KEY_DETAILERS_GEO, (longitude, latitude, str(detailer_id)))
    finally:
        r.close()


def get_detailer_location(detailer_id: int) -> Optional[Tuple[float, float]]:
    """
    Get a detailer's (latitude, longitude) from Redis GEO set.
    Returns None if not found.
    """
    r = get_redis(decode_responses=True)
    try:
        pos = r.geopos(REDIS_KEY_DETAILERS_GEO, str(detailer_id))
        if not pos or pos[0] is None:
            return None
        lon, lat = pos[0]
        return (float(lat), float(lon))
    finally:
        r.close()


def get_nearest_detailer_ids(
    longitude: float,
    latitude: float,
    radius_km: float = 30.0,
    count: int = 10,
) -> List[int]:
    """
    Get detailer ids ordered by distance (nearest first) within radius_km.
    Returns list of detailer ids (integers). Empty if none in range or Redis error.
    """
    r = get_redis(decode_responses=True)
    try:
        # GEORADIUS key lon lat radius km WITHDIST ASC COUNT count
        results = r.georadius(
            REDIS_KEY_DETAILERS_GEO,
            longitude,
            latitude,
            radius_km,
            unit="km",
            withdist=True,
            sort="ASC",
            count=count,
        )
        if not results:
            return []
        # results: list of (member, dist) with decode_responses=True
        ids = []
        for member, _ in results:
            try:
                ids.append(int(member))
            except (ValueError, TypeError):
                continue
        return ids
    except Exception:
        return []
    finally:
        r.close()
