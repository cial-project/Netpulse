from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('api.urls')),  # Your existing auth routes
    path('api/', include('api.urls')),       # ADD THIS: Makes /api/devices/ work
    path('devices/', include('devices.urls')),  # Your existing devices routes
]