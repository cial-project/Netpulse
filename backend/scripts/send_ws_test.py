import os
import sys
import time
import pathlib
import django
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

# Make sure the backend package (where `netpulse` lives) is on sys.path
BASE_DIR = pathlib.Path(__file__).resolve().parents[1]  # backend/
sys.path.insert(0, str(BASE_DIR))

# Ensure Django settings are loaded when running this script directly
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'netpulse.settings')
django.setup()

channel_layer = get_channel_layer()

metric_payload = {
    'type': 'dashboard_update',
    'data': {
        'type': 'metric_update',
        'metrics': {
            'download': 620,  # Mbps
            'upload': 140,    # Mbps
            'temperature': 24.3,
            'humidity': 46,
            'ups_battery': 91
        }
    }
}

device_payload = {
    'type': 'dashboard_update',
    'data': {
        'type': 'device_update',
        'change': 'went_offline',
        'device': {
            'id': 99,
            'name': 'Test-Switch-99',
            'ip': '10.0.99.1',
            'is_online': False,
            'last_seen': time.strftime('%Y-%m-%dT%H:%M:%S')
        },
        'alert': {
            'id': 999,
            'title': 'Test device went offline',
            'severity': 'critical',
            'created_at': time.strftime('%Y-%m-%dT%H:%M:%S')
        }
    }
}


def send(payload):
    print('Sending payload of type:', payload.get('data', {}).get('type'))
    async_to_sync(channel_layer.group_send)('dashboard_updates', payload)
    print('Sent')


if __name__ == '__main__':
    send(metric_payload)
    time.sleep(1)
    send(device_payload)
import time
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

channel_layer = get_channel_layer()

metric_payload = {
    'type': 'dashboard_update',
    'data': {
        'type': 'metric_update',
        'metrics': {
            'download': 620,  # Mbps
            'upload': 140,    # Mbps
            'temperature': 24.3,
            'humidity': 46,
            'ups_battery': 91
        }
    }
}

device_payload = {
    'type': 'dashboard_update',
    'data': {
        'type': 'device_update',
        'change': 'went_offline',
        'device': {
            'id': 99,
            'name': 'Test-Switch-99',
            'ip': '10.0.99.1',
            'is_online': False,
            'last_seen': time.strftime('%Y-%m-%dT%H:%M:%S')
        },
        'alert': {
            'id': 999,
            'title': 'Test device went offline',
            'severity': 'critical',
            'created_at': time.strftime('%Y-%m-%dT%H:%M:%S')
        }
    }
}

print('Sending metric payload...')
async_to_sync(channel_layer.group_send)('dashboard_updates', metric_payload)
print('Metric payload sent')

time.sleep(1)

print('Sending device/alert payload...')
async_to_sync(channel_layer.group_send)('dashboard_updates', device_payload)
print('Device/alert payload sent')
