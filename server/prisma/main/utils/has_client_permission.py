"""Internal client-server authentication via shared secret header."""
import secrets

from django.conf import settings


def has_client_internal_permission(request) -> bool:
    """
    Return True when the request carries a valid ``X-Client-Internal-Key``.

    Compares the header to ``settings.CLIENT_SERVER_SECRET`` using constant-time
    digest comparison. Returns False when the setting is unset or the header mismatches.

    Args:
        request: Django ``HttpRequest`` with ``request.headers``.

    Returns:
        bool: Whether the caller is the client server.
    """
    expected = (getattr(settings, "CLIENT_SERVER_SECRET", None) or "").strip()
    if not expected:
        return False
    got = (request.headers.get("X-Client-Internal-Key") or "").strip()
    return secrets.compare_digest(got, expected)
