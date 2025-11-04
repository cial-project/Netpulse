from django.apps import AppConfig

class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'
    def ready(self):
        # Import signal handlers to ensure they are registered
        try:
            import api.signals  # noqa: F401
        except Exception:
            # Do not prevent app startup if signals fail to import
            pass