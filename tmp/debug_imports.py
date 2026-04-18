import os
import sys

# Add backend to path
sys.path.append(os.path.abspath('d:/netpulse/backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'netpulse.settings')

import django
django.setup()

from devices.views import *
print("Imported devices.views")
