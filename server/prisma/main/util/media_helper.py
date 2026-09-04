"""Build absolute media URLs for API responses and Redis stream payloads."""
from django.conf import settings


def get_full_media_url(relative_url):
    """
    Turn a storage-relative media path into a public absolute URL.

    Already-absolute URLs (``http://`` / ``https://``) are returned unchanged.
    When ``BASE_URL`` is unset, returns the relative path as-is.

    Args:
        relative_url: Path or URL from ``FileField.url`` (may be None).

    Returns:
        str | None: Absolute URL under ``{BASE_URL}/...``, or None/relative fallback.
    """
    if not relative_url:
        return None

    if relative_url.startswith('http://') or relative_url.startswith('https://'):
        return relative_url

    base_url = getattr(settings, 'BASE_URL', None)
    if not base_url:
        return relative_url

    if relative_url.startswith('/'):
        relative_url = relative_url[1:]

    return f"{base_url.rstrip('/')}/{relative_url}"
