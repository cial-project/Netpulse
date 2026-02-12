import os
import django
import random

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'netpulse.settings')
django.setup()

from api.models import Port

def populate():
    ports = [
        {
            'name': 'GigabitEthernet0/1',
            'device_name': 'Core-Router-01',
            'ip_address': '192.168.10.1',
            'capacity_mbps': 1000
        },
        {
            'name': 'GigabitEthernet0/2',
            'device_name': 'Core-Router-01',
            'ip_address': '192.168.10.2',
            'capacity_mbps': 1000
        },
        {
            'name': 'TenGigabitEthernet1/1',
            'device_name': 'Distribution-Switch-01',
            'ip_address': '10.0.0.1',
            'capacity_mbps': 10000
        },
        {
            'name': 'FastEthernet0/24',
            'device_name': 'Access-Switch-05',
            'ip_address': '192.168.20.254',
            'capacity_mbps': 100
        },
        {
            'name': 'eth0',
            'device_name': 'Web-Server-Prod',
            'ip_address': '172.16.5.10',
            'capacity_mbps': 1000
        }
    ]

    for p_data in ports:
        port, created = Port.objects.get_or_create(
            name=p_data['name'],
            device_name=p_data['device_name'],
            defaults=p_data
        )
        if created:
            print(f"Created port: {port}")
        else:
            print(f"Port already exists: {port}")

if __name__ == '__main__':
    populate()
