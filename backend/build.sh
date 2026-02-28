#!/usr/bin/env bash
# exit on error
set -o errexit

pip install -r requirements.txt
python manage.py collectstatic --no-input
python manage.py migrate

# Create superuser if environment variables are set
if [[ -n "$DJANGO_SUPERUSER_USERNAME" && -n "$DJANGO_SUPERUSER_EMAIL" && -n "$DJANGO_SUPERUSER_PASSWORD" ]]; then
    echo "Ensuring superuser exists..."
    python -c "
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'netpulse.settings')
django.setup()
from django.contrib.auth import get_user_model
User = get_user_model()
un = os.environ.get('DJANGO_SUPERUSER_USERNAME')
em = os.environ.get('DJANGO_SUPERUSER_EMAIL')
pw = os.environ.get('DJANGO_SUPERUSER_PASSWORD')
if not User.objects.filter(username=un).exists():
    user = User.objects.create_superuser(un, em, pw)
    user.role = 'admin'
    user.save(update_fields=['role'])
    print(f'Superuser {un} created with admin role.')
else:
    user = User.objects.get(username=un)
    changed = False
    if getattr(user, 'role', None) != 'admin':
        user.role = 'admin'
        changed = True
    if not user.is_staff:
        user.is_staff = True
        changed = True
    if not user.is_superuser:
        user.is_superuser = True
        changed = True
    if changed:
        user.save()
        print(f'Superuser {un} updated to admin role.')
    else:
        print(f'Superuser {un} already has admin role.')
"
fi
