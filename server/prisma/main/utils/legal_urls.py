"""Legal document URLs for email footers and public web pages (detailer / crew deployment)."""
from django.conf import settings


def frontend_base_url() -> str:
    """
    Base URL for the detailer web app (no trailing slash).

    Returns:
        str: ``FRONTEND_BASE_URL`` from settings, or ``""`` when unset.
    """
    return (getattr(settings, "FRONTEND_BASE_URL", None) or "").rstrip("/")


def privacy_policy_url() -> str:
    """
    Absolute or site-relative URL to the privacy policy page.

    Returns:
        str: ``{base}/legal/privacy/`` when base is set, else ``/legal/privacy/``.
    """
    base = frontend_base_url()
    return f"{base}/legal/privacy/" if base else "/legal/privacy/"


def terms_of_service_url() -> str:
    """
    Absolute or site-relative URL to the terms of service page.

    Returns:
        str: ``{base}/legal/terms/`` when base is set, else ``/legal/terms/``.
    """
    base = frontend_base_url()
    return f"{base}/legal/terms/" if base else "/legal/terms/"


def email_legal_context(**extra) -> dict:
    """
    Build template context for legal footer links in transactional emails.

    Merges privacy/terms URLs and ``current_year`` with any caller-supplied keys.
    ``year`` in ``extra`` overrides the default calendar year for the footer.

    Args:
        **extra: Additional context keys merged after the legal defaults.

    Returns:
        dict: Context suitable for ``render_to_string`` / Celery email tasks.
    """
    from datetime import datetime

    year = extra.pop("year", None)
    ctx = {
        "privacy_policy_url": privacy_policy_url(),
        "terms_of_service_url": terms_of_service_url(),
        "current_year": str(year if year is not None else datetime.now().year),
    }
    ctx.update(extra)
    return ctx
