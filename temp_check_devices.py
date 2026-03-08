import os
import django
import sys

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'netpulse.settings')
# Set the current working directory as the base for the project
sys.path.append(os.path.join(os.getcwd(), 'backend'))

django.setup()

from api.models import Device, Zone, Metric

print("--- Zones ---")
for z in Zone.objects.all():
    print(f"Zone: {z.name} (Key: {z.key})")

print("\n--- Devices ---")
for d in Device.objects.all():
    print(f"Device: {d.name} | IP: {d.ip_address} | Type: {d.device_type} | Zone: {d.zone.name if d.zone else 'None'}")

print("\n--- Recent Metrics (Last 5) ---")
for m in Metric.objects.order_by('-timestamp')[:5]:
    print(f"Metric: {m.device.name} | CPU: {m.cpu_usage}% | Mem: {m.memory_usage}% | Time: {m.timestamp}")
