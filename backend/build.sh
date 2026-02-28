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
    User.objects.create_superuser(un, em, pw)
    print(f'Superuser {un} created successfully.')
else:
    print(f'Superuser {un} already exists.')
"
fi
