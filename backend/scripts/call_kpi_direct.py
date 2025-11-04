from django.contrib.auth import get_user_model
from api.views import DashboardViewSet
from types import SimpleNamespace

User = get_user_model()
user = User.objects.filter(is_superuser=True).first()
if not user:
    print('No superuser found; create one to test')
else:
    viewset = DashboardViewSet()
    request = SimpleNamespace(user=user)
    # Call the method directly
    response = viewset.kpi(request)
    print('STATUS', response.status_code)
    print(response.data)
