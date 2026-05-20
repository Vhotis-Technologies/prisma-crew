"""
Public HTML legal documents for email links and browsers.

**Auth:** None (Django ``View``, not DRF).

**GET:** Latest ``PrivacyPolicy`` or ``TermsAndConditions`` rendered via ``legal/document.html``.
"""
from django.http import Http404
from django.shortcuts import render
from django.views import View

from main.models import PrivacyPolicy, TermsAndConditions


class LegalPrivacyView(View):
    """Serve the latest privacy policy as an HTML page."""

    def get(self, request):
        """
        Load newest privacy policy row and render the legal template.

        Args:
            request: Django HTTP request.

        Returns:
            Rendered HTML response, or 404 if no policy exists.
        """
        try:
            doc = PrivacyPolicy.objects.latest("last_updated")
        except PrivacyPolicy.DoesNotExist:
            raise Http404("Privacy policy not found")
        return render(
            request,
            "legal/document.html",
            {
                "title": "Privacy Policy",
                "content": doc.content,
                "version": doc.version,
                "last_updated": doc.last_updated,
            },
        )


class LegalTermsView(View):
    """Serve the latest terms of service as an HTML page."""

    def get(self, request):
        """
        Load newest terms row and render the legal template.

        Args:
            request: Django HTTP request.

        Returns:
            Rendered HTML response, or 404 if no terms document exists.
        """
        try:
            doc = TermsAndConditions.objects.latest("last_updated")
        except TermsAndConditions.DoesNotExist:
            raise Http404("Terms of service not found")
        return render(
            request,
            "legal/document.html",
            {
                "title": "Terms of Service",
                "content": doc.content,
                "version": doc.version,
                "last_updated": doc.last_updated,
            },
        )
