"""Legal document URLs for email footers and public web pages (crew API)."""
from django.conf import settings


def api_base_url() -> str:
    """Public Django API origin (no trailing slash). Uses ``BASE_URL``."""
    return (getattr(settings, "BASE_URL", None) or "").strip().rstrip("/") or (
        "https://crew.prismavalet.com"
    )


def privacy_policy_url() -> str:
    """Django-rendered privacy policy."""
    return f"{api_base_url()}/legal/privacy/"


def terms_of_service_url() -> str:
    """Django-rendered terms of service."""
    return f"{api_base_url()}/legal/terms/"


def email_legal_context(**extra) -> dict:
    """
    Build template context for legal footer links in transactional emails.

    Merges privacy/terms URLs and ``current_year`` with any caller-supplied keys.
    ``year`` in ``extra`` overrides the default calendar year for the footer.
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
