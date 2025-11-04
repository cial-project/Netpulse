from django.test import RequestFactory
from django.contrib.auth import get_user_model
from api.views import DashboardViewSet

User = get_user_model()
rf = RequestFactory()
user = User.objects.filter(is_superuser=True).first()
if not user:
    print('No superuser found; create one to test')
else:
    request = rf.get('/api/dashboard/kpi/')
    request.user = user
    view = DashboardViewSet.as_view({'get': 'kpi'})
    response = view(request)
    print('STATUS', response.status_code)
    try:
        print(response.data)
    except Exception as e:
        print('Failed to read response data', e)
