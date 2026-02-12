
import os
import django
import sys

# Add project root to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'netpulse.settings')
django.setup()

from django.contrib.auth import get_user_model

def reset_admin():
    User = get_user_model()
    try:
        u, created = User.objects.get_or_create(username='admin', defaults={'email': 'admin@example.com'})
        u.set_password('adminpassword')
        u.is_superuser = True
        u.is_staff = True
        u.role = 'admin'
        u.save()
        print(f"Admin user reset. Created: {created}. Password set to 'adminpassword'")
    except Exception as e:
        print(f"Error resetting admin: {e}")

if __name__ == "__main__":
    reset_admin()
