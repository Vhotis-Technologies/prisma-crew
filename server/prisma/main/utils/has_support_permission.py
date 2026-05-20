"""Internal support API authentication via shared secret header."""
import secrets

from django.conf import settings


def has_support_permission(request):
    """
    Authorize internal support API calls (no DEBUG staff bypass).

    Compares ``X-Support-Internal-Key`` to ``SUPPORT_INTERNAL_API_KEY`` using
    constant-time comparison. Returns False when the setting is unset.

    Args:
        request: Django/DRF request with headers.

    Returns:
        bool: True when the header matches the configured key.
    """
    expected = (getattr(settings, "SUPPORT_INTERNAL_API_KEY", None) or "").strip()
    if not expected:
        return False
    got = (request.headers.get("X-Support-Internal-Key") or "").strip()
    return secrets.compare_digest(got, expected)
