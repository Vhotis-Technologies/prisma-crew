"""
DRF permission for **detailer** routes under ``/api/v1/support/...``.

Mirrors the client project: only callers presenting ``X-Support-Internal-Key``
(or allowed DEBUG staff) may access crew/support views. The support Django app
proxies mobile traffic to this API using the same key configured on all services.
"""
from rest_framework.permissions import BasePermission
from main.utils.has_support_permission import has_support_permission


class SupportPermissionAccess(BasePermission):
    """
    Grants access when ``has_support_permission(request)`` is true (shared secret or DEBUG staff).
    """

    message = 'Support permission access denied.'

    def has_permission(self, request, view):
        return has_support_permission(request)
