import os
import django
import sys

# Setup Django environment
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'netpulse.settings')
django.setup()

from api.models import Device

def add_device():
    ip = '192.168.1.13'
    name = 'My Laptop'
    device_type = 'server'
    
    # Check if exists
    device = Device.objects.filter(ip_address=ip).first()
    
    if device:
        print(f"Device {name} ({ip}) already exists. Updating...")
        device.name = name
        device.device_type = device_type
        device.is_active = True
        device.save()
    else:
        print(f"Creating device {name} ({ip})...")
        Device.objects.create(
            name=name,
            ip_address=ip,
            device_type=device_type,
            is_active=True,
            snmp_community='public', # Default
            location='Local Network'
        )
    
    print("Device added/updated successfully.")

if __name__ == '__main__':
    add_device()
