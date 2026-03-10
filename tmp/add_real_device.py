import os
import django
import sys
from django.utils import timezone

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'netpulse.settings')
sys.path.append(os.path.join(os.getcwd(), 'backend'))

django.setup()

from api.models import Device, Port, Zone

def add_real_device():
    # Add real device if not exists
    real_ip = '192.168.29.155'
    device, created = Device.objects.get_or_create(
        ip_address=real_ip,
        defaults={
            'name': 'Real Management Laptop',
            'device_type': 'server',
            'location': 'Admin Desk',
            'is_important': True,
            'is_active': True,
            'is_online': True,
            'last_seen': timezone.now()
        }
    )
    if created:
        print(f"Created real device: {device.name}")
    else:
        print(f"Real device already exists: {device.name}")

    # Add real port for this device
    port, created = Port.objects.get_or_create(
        name='Main Interface',
        device_name=device.name,
        defaults={
            'ip_address': real_ip,
            'capacity_mbps': 1000,
            'is_active': True,
            'status': 'up',
            'last_checked': timezone.now()
        }
    )
    if created:
        print(f"Created real port: {port.name}")
    else:
        print(f"Real port already exists: {port.name}")

if __name__ == "__main__":
    add_real_device()
