import os
import django
import sys

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'netpulse.settings')
sys.path.append(os.path.join(os.getcwd(), 'backend'))

django.setup()

from api.models import Device, Zone

def setup_critical_infra():
    print("Marking critical infrastructure devices...")
    
    # 1. Mark Core Router as important
    core = Device.objects.filter(name__icontains='Core').first()
    if core:
        core.is_important = True
        core.save()
        print(f"Marked {core.name} as important.")

    # 2. Mark Firewall as important
    fw = Device.objects.filter(name__icontains='Firewall').first()
    if fw:
        fw.is_important = True
        fw.save()
        print(f"Marked {fw.name} as important.")

    # 3. Ensure zones have keys that match the frontend IDs
    # Existing zones: Data Center 1 (dc1), Data Center 2 (dc2), Disaster Recovery (dr)
    # We added 'dr2' in the UI, let's create it in DB if it doesn't exist
    dr2, created = Zone.objects.get_or_create(
        key='dr2', 
        defaults={'name': 'Disaster Recovery 2', 'description': 'Secondary DR Site'}
    )
    if created:
        print("Created DR2 zone.")

    # Assign a device to DR2 so it shows an IP
    dr2_dev = Device.objects.filter(zone__isnull=True).exclude(is_important=True).first()
    if dr2_dev:
        dr2_dev.zone = dr2
        dr2_dev.is_important = True
        dr2_dev.save()
        print(f"Assigned {dr2_dev.name} to DR2 and marked important.")

if __name__ == "__main__":
    setup_critical_infra()
