"""DRF permissions for detailer internal routes."""
from rest_framework.permissions import BasePermission

from main.utils.has_client_permission import has_client_internal_permission


class ClientInternalPermission(BasePermission):
    """Allow only the client server (shared ``X-Client-Internal-Key``)."""

    message = "Client internal permission denied."

    def has_permission(self, request, view):
        """Allow only requests that present a valid client-server secret."""
        return has_client_internal_permission(request)
