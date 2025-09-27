from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import AuthViewSet, UserViewSet, DashboardViewSet, DeviceViewSet, AlertViewSet, MetricViewSet

router = DefaultRouter()
router.register(r'devices', DeviceViewSet, basename='device')
router.register(r'alerts', AlertViewSet, basename='alert')
router.register(r'metrics', MetricViewSet, basename='metric')  # Added basename

urlpatterns = [
    # Authentication endpoints
    path('login/', AuthViewSet.as_view({'post': 'login'}), name='auth-login'),
    path('signup/', AuthViewSet.as_view({'post': 'signup'}), name='auth-signup'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    
    # User endpoints
    path('user/me/', UserViewSet.as_view({'get': 'me'}), name='user-me'),
    
    # Dashboard endpoints
    path('dashboard/kpi/', DashboardViewSet.as_view({'get': 'kpi'}), name='dashboard-kpi'),
    path('dashboard/ai_insights/', DashboardViewSet.as_view({'get': 'ai_insights'}), name='dashboard-ai-insights'),
    path('dashboard/map/', DashboardViewSet.as_view({'get': 'map'}), name='dashboard-map'),
    path('dashboard/stats/', DashboardViewSet.as_view({'get': 'stats'}), name='dashboard-stats'),
    
    # Include router URLs
    path('', include(router.urls)),
]