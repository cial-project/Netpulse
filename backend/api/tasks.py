from celery import shared_task
from django.utils import timezone
from .models import Device, Metric, Alert
from devices.snmp_service import poll_device
from .serializers import MetricSerializer, AlertSerializer
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import logging

logger = logging.getLogger(__name__)

@shared_task
def poll_all_devices():
    """Scheduled task to poll all active devices."""
    devices = Device.objects.filter(is_active=True)
    for device in devices:
        poll_single_device.delay(device.id)

@shared_task
def poll_single_device(device_id):
    """Worker task to poll a single device and broadcast results."""
    try:
        device = Device.objects.get(id=device_id)
        
        result = poll_device(
            device.ip_address,
            device.device_type,
            device.snmp_community,
            getattr(device, 'port', 161),
            custom_oids=getattr(device, 'custom_oids', '')
        )

        device.is_online = result.get('reachable', False)
        if device.is_online:
            device.last_seen = timezone.now()
            device.sys_name = result.get('sys_name', device.sys_name)
            device.uptime_days = result.get('uptime_days', device.uptime_days or 0)

            metric_instance = Metric.objects.create(
                device=device,
                cpu_usage=result.get('cpu_usage', 0),
                memory_usage=result.get('memory_usage', 0),
                network_in=result.get('network_in', 0),
                network_out=result.get('network_out', 0),
                temperature=result.get('temperature', None),
            )

            broadcast_metric(metric_instance)
            check_threshold_alerts(device, result)

        device.save()
        return f"Polled {device.name}: {device.is_online}"

    except Device.DoesNotExist:
        return f"Device {device_id} not found"
    except Exception as e:
        logger.exception(f"Error polling device {device_id}: {e}")
        return f"Error polling device {device_id}: {e}"

def broadcast_metric(metric):
    try:
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            'dashboard_updates',
            {
                'type': 'dashboard_update',
                'data': {
                    'type': 'metric_update',
                    'metrics': [MetricSerializer(metric).data]
                }
            }
        )
    except Exception:
        logger.exception('Failed to broadcast metric update')

def broadcast_alert(alert):
    try:
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            'dashboard_updates',
            {
                'type': 'dashboard_update',
                'data': {
                    'type': 'alert_triggered',
                    'alert': AlertSerializer(alert).data
                }
            }
        )
    except Exception:
        logger.exception('Failed to broadcast alert')

def check_threshold_alerts(device, result):
    thresholds = {
        'cpu_usage': 80,
        'memory_usage': 85,
    }

    for metric_name, threshold in thresholds.items():
        value = result.get(metric_name, 0)
        if value and value > threshold:
            alert, created = Alert.objects.get_or_create(
                device=device,
                title=f"High {metric_name.replace('_', ' ')} on {device.name}",
                status='open',
                defaults={
                    'description': f"{metric_name.replace('_', ' ')} is at {value}% (threshold: {threshold}%)",
                    'severity': 'warning' if value < 95 else 'critical',
                }
            )
            if created:
                broadcast_alert(alert)
