from django.urls import path
from . import views

urlpatterns = [
   path("status/", views.device_status, name="device_status"),
]