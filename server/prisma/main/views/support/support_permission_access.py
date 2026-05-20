"""
DRF permission for **detailer** routes under ``/api/v1/support/...``.

**Auth:** ``SupportPermissionAccess`` — callers must present ``X-Support-Internal-Key``
matching ``SUPPORT_INTERNAL_API_KEY`` (or satisfy DEBUG staff rules via
:func:`main.utils.has_support_permission.has_support_permission`). Detailer JWTs are
not accepted on these views.

**Actions:** This module defines the permission only; apply
:class:`SupportPermissionAccess` to crew, job, and payout support views.
"""
from rest_framework.permissions import BasePermission
from main.utils.has_support_permission import has_support_permission


class SupportPermissionAccess(BasePermission):
    """DRF permission that gates all detailer ``/support/`` API views."""

    message = 'Support permission access denied.'

    def has_permission(self, request, view):
        """Return True when the request carries a valid internal support API key."""
        return has_support_permission(request)
