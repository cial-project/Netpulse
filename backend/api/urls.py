from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AuthViewSet, UserViewSet, DashboardViewSet, DeviceViewSet, AlertViewSet, MetricViewSet


router = DefaultRouter()
router.register(r'', AuthViewSet, basename='auth')  # Expose AuthViewSet at root
router.register(r'user', UserViewSet, basename='user')
router.register(r'dashboard', DashboardViewSet, basename='dashboard')
router.register(r'devices', DeviceViewSet)
router.register(r'alerts', AlertViewSet)
router.register(r'metrics', MetricViewSet)

urlpatterns = [
    path('', include(router.urls)),
]