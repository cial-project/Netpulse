from django.contrib import admin
from django.urls import path, include
from api.views import api_root # Import the root view

urlpatterns = [
    path('', api_root, name='api-root'), # Root path
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
    path('devices/', include('devices.urls')),
]