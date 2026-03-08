import os
import django
import sys
from django.utils import timezone
import random

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'netpulse.settings')
sys.path.append(os.path.join(os.getcwd(), 'backend'))

django.setup()

from api.models import Device, Metric, Zone

def generate_live_data():
    devices = Device.objects.filter(is_active=True)
    if not devices.exists():
        print("No active devices found.")
        return

    print(f"Generating live data for {devices.count()} devices...")
    for d in devices:
        # Generate some random metrics
        cpu = random.uniform(5, 45)
        mem = random.uniform(20, 60)
        net_in = random.uniform(10, 500)
        net_out = random.uniform(10, 400)
        temp = random.uniform(20, 35)
        
        Metric.objects.create(
            device=d,
            cpu_usage=cpu,
            memory_usage=mem,
            network_in=net_in,
            network_out=net_out,
            temperature=temp,
            timestamp=timezone.now()
        )
        
        # Update device cache
        d.cpu_load = cpu
        d.memory_load = mem
        d.temperature = temp
        d.is_online = True
        d.last_seen = timezone.now()
        d.save()
        
        print(f"Updated {d.name}")

    # Update Zones too
    for z in Zone.objects.all():
        z.temperature = random.uniform(22, 28)
        z.humidity = random.uniform(40, 55)
        z.save()
        print(f"Updated Zone {z.name}")

if __name__ == "__main__":
    generate_live_data()
