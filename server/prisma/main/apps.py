"""Django app configuration for the detailer ``main`` application."""
from django.apps import AppConfig


class MainConfig(AppConfig):
    """Registers the detailer main app and connects signal handlers on startup."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'main'

    def ready(self):
        """
        Import signal modules when Django loads the app.

        Ensures model save hooks (e.g. side effects on create/update) are registered.
        """
        import main.signals
