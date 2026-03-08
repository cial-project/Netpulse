import os
import django
import sys
import json

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'netpulse.settings')
sys.path.append(os.path.join(os.getcwd(), 'backend'))

django.setup()

from api.views import DashboardViewSet
from rest_framework.test import APIRequestFactory, force_authenticate
from api.models import User

def check_kpi():
    user = User.objects.filter(role='admin').first()
    if not user:
        user = User.objects.create_superuser('admin', 'admin@example.com', 'admin123')
    
    factory = APIRequestFactory()
    view = DashboardViewSet.as_view({'get': 'kpi'})
    request = factory.get('/api/dashboard/kpi/')
    force_authenticate(request, user=user)
    
    response = view(request)
    print(json.dumps(response.data, indent=2))

if __name__ == "__main__":
    check_kpi()
