"""Template tags exposing legal document URLs for HTML email and web templates."""
from django import template

from main.utils.legal_urls import privacy_policy_url, terms_of_service_url

register = template.Library()


@register.simple_tag
def legal_privacy_url():
    """
    Return the privacy policy URL for use in templates.

    Returns:
        str: Absolute or relative privacy policy path from :mod:`main.utils.legal_urls`.
    """
    return privacy_policy_url()


@register.simple_tag
def legal_terms_url():
    """
    Return the terms of service URL for use in templates.

    Returns:
        str: Absolute or relative terms path from :mod:`main.utils.legal_urls`.
    """
    return terms_of_service_url()
