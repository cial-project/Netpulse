from django.test import Client
from django.contrib.auth import get_user_model
User = get_user_model()

c = Client()
u = User.objects.filter(is_superuser=True).first()
if u:
    c.force_login(u)
resp = c.get('/api/dashboard/kpi/')
print('STATUS', resp.status_code)
try:
    print(resp.json())
except Exception as e:
    print('Failed to parse JSON:', e)
