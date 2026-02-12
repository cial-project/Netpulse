import os
import django
import sys

sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'netpulse.settings')
django.setup()

from api.models import Device
from api.tasks import poll_single_device

def run():
    ip = '192.168.1.13'
    device = Device.objects.filter(ip_address=ip).first()
    if device:
        print(f"Polling {device.name} ({device.ip_address})...")
        # Direct call (synchronous) to ensure we see the result now
        try:
            # Note: poll_single_device is a shared_task w/ .delay().
            # Calling relevant function logic directly for immediate feedback would be better,
            # but we can just run the task function itself (it's decorated but usually callable).
            # If celery wraps it, we need to access the underlying function or just call it.
            # However, celery tasks are callable directly in recent versions.
            res = poll_single_device(device.id)
            print(f"Result: {res}")
        except Exception as e:
            print(f"Error: {e}")
    else:
        print("Device not found.")

if __name__ == '__main__':
    run()
