from django.urls import path
from .views import create_alert, list_alerts

urlpatterns = [
    path("create/", create_alert, name="create_alert"),
    path("list/", list_alerts, name="list_alerts"),
]
