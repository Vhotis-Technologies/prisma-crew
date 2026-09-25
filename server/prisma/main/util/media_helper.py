"""Build absolute media URLs for API responses and Redis stream payloads."""
from __future__ import annotations

from urllib.parse import unquote, urlparse, urlunparse

from django.conf import settings


def _strip_url_signature(url: str) -> str:
    """Remove query/fragment (e.g. GCS V4 signatures) from an absolute URL."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return url
    path = unquote(parsed.path or "")
    return urlunparse((parsed.scheme, parsed.netloc, path, "", "", ""))


def get_full_media_url(relative_url):
    """
    Turn a storage-relative media path into a stable absolute URL.

    Already-absolute URLs (``http://`` / ``https://``) are returned with query
    strings stripped so GCS signed links are not published or stored downstream.
    Relative paths prefer ``MEDIA_URL`` (GCS base), then ``BASE_URL``.

    Args:
        relative_url: Path or URL from ``FileField.url`` / ``FileField.name`` (may be None).

    Returns:
        str | None: Absolute URL without signature query params, or None/relative fallback.
    """
    if not relative_url:
        return None

    if relative_url.startswith("http://") or relative_url.startswith("https://"):
        return _strip_url_signature(relative_url)

    path = relative_url[1:] if relative_url.startswith("/") else relative_url

    media_url = (getattr(settings, "MEDIA_URL", None) or "").rstrip("/")
    if media_url.startswith("http://") or media_url.startswith("https://"):
        return f"{media_url}/{path}"

    base_url = getattr(settings, "BASE_URL", None)
    if not base_url:
        return relative_url

    return f"{base_url.rstrip('/')}/{path}"


def stable_media_url_for_file(file_field):
    """
    Build a non-expiring media URL for a Django ``FileField`` / ``ImageField``.

    Prefers ``MEDIA_URL`` + ``file.name`` (unsigned GCS object URL). Falls back to
    ``get_full_media_url(file.url)`` with signatures stripped.

    Args:
        file_field: Storage-backed file field instance (may be empty).

    Returns:
        str | None: Stable absolute URL, or None when no file is attached.
    """
    if not file_field:
        return None

    name = (getattr(file_field, "name", None) or "").strip()
    media_url = (getattr(settings, "MEDIA_URL", None) or "").rstrip("/")
    if name and (media_url.startswith("http://") or media_url.startswith("https://")):
        return f"{media_url}/{name.lstrip('/')}"

    url = getattr(file_field, "url", None)
    return get_full_media_url(url)
