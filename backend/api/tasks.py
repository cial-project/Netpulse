"""
Celery tasks for device polling, metrics storage, alert generation, and WebSocket broadcasting.

Schedule: poll_all_devices runs every 30 seconds via Celery Beat.
Each device is polled individually by poll_single_device workers.
"""
from celery import shared_task
from django.utils import timezone
from django.db.models import Q
from .models import Device, Metric, Alert, AlertThreshold, Port
from devices.snmp_service import poll_device
from .serializers import MetricSerializer, AlertSerializer, PortSerializer
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import logging

logger = logging.getLogger('netpulse.poller')

# ---------------------------------------------------------------------------
# Default thresholds (used when AlertThreshold table is empty or unconfigured)
# ---------------------------------------------------------------------------
DEFAULT_THRESHOLDS = {
    'cpu_usage': {'warning': 85, 'critical': 95},
    'memory_usage': {'warning': 85, 'critical': 95},
    'temperature': {'warning': 35, 'critical': 45},
}


def _get_thresholds():
    """Load thresholds from DB; fall back to defaults."""
    thresholds = {}
    try:
        for t in AlertThreshold.objects.filter(is_active=True):
            if t.metric_name not in thresholds:
                thresholds[t.metric_name] = {}
            thresholds[t.metric_name][t.severity] = t.threshold_value
    except Exception:
        logger.debug('AlertThreshold table not available, using defaults')

    # Merge with defaults
    for metric, levels in DEFAULT_THRESHOLDS.items():
        if metric not in thresholds:
            thresholds[metric] = levels
        else:
            for severity, value in levels.items():
                thresholds[metric].setdefault(severity, value)

    return thresholds


# ---------------------------------------------------------------------------
# Scheduled entry-point (every 30 s via Celery Beat)
# ---------------------------------------------------------------------------
@shared_task(name='api.tasks.poll_all_devices')
def poll_all_devices():
    """Scheduled task to poll all active devices and ports."""
    devices = Device.objects.filter(is_active=True)
    for device in devices:
        poll_single_device.delay(device.id)
    
    ports = Port.objects.filter(is_active=True)
    for port in ports:
        update_port_metrics.delay(port.id)
        
    logger.info('Queued polling for %d devices and %d ports', devices.count(), ports.count())
    return f"Queued {devices.count()} devices and {ports.count()} ports"


@shared_task(name='api.tasks.update_port_metrics')
def update_port_metrics(port_id):
    """Update port metrics focusing on real device if IP matches."""
    try:
        port = Port.objects.get(id=port_id)
        from devices.port_service import simulate_port_traffic
        
        # In a real environment, we'd use SNMP interface MIBs here
        # For this demo, we use the simulation but ensure it's called
        data = simulate_port_traffic(port.capacity_mbps)
        
        port.bps_in = data['bps_in']
        port.bps_out = data['bps_out']
        port.utilization_in = data['utilization_in']
        port.utilization_out = data['utilization_out']
        port.status = data['status']
        port.last_checked = timezone.now()
        port.save()
        
        # Broadcast to dashboard
        broadcast_port_update(port)
        return f"Updated port {port.name}"
    except Exception as e:
        logger.error(f"Error updating port {port_id}: {e}")
        return str(e)

def broadcast_port_update(port):
    """Send port update via WebSocket."""
    try:
        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                'dashboard_updates',
                {
                    'type': 'dashboard_update',
                    'data': {
                        'type': 'port_update',
                        'port_id': port.id,
                        'utilization_in': port.utilization_in,
                        'utilization_out': port.utilization_out,
                        'bps_in': port.bps_in,
                        'bps_out': port.bps_out,
                        'status': port.status
                    }
                }
            )
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Per-device worker
# ---------------------------------------------------------------------------
@shared_task(name='api.tasks.poll_single_device', bind=True, max_retries=2,
             default_retry_delay=10)
def poll_single_device(self, device_id):
    """Worker task to poll a single device and broadcast results."""
    try:
        device = Device.objects.get(id=device_id)
    except Device.DoesNotExist:
        logger.warning('poll_single_device: Device %s not found', device_id)
        return f"Device {device_id} not found"

    was_online = device.is_online

    try:
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
            
            # Update cached device-level metrics
            device.cpu_load = result.get('cpu_usage', device.cpu_load)
            device.memory_load = result.get('memory_usage', device.memory_load)
            if result.get('temperature') is not None:
                device.temperature = result['temperature']

            # Store metric
            metric_instance = Metric.objects.create(
                device=device,
                cpu_usage=result.get('cpu_usage', 0),
                memory_usage=result.get('memory_usage', 0),
                network_in=result.get('network_in', 0),
                network_out=result.get('network_out', 0),
                temperature=result.get('temperature', None),
            )

            # Broadcast metric via WebSocket
            broadcast_metric(metric_instance)

            # Check thresholds and generate alerts
            check_threshold_alerts(device, result)

            # If device came back online, auto-resolve offline alerts
            if not was_online:
                _auto_resolve_offline_alerts(device)

        else:
            # Device is offline
            _create_offline_alert(device, was_online)

        device.save()
        logger.debug('Polled %s: online=%s', device.name, device.is_online)
        return f"Polled {device.name}: online={device.is_online}"

    except Exception as e:
        logger.exception('Error polling device %s (%s): %s', device_id, device.name, e)
        # Retry on transient failures
        try:
            self.retry(exc=e)
        except self.MaxRetriesExceededError:
            logger.error('Max retries exceeded for device %s', device_id)
        return f"Error polling device {device_id}: {e}"


# ---------------------------------------------------------------------------
# Alert Generation Engine
# ---------------------------------------------------------------------------
def check_threshold_alerts(device, result):
    """
    Evaluate all configured thresholds against the poll result.
    Creates alerts for:
      - CPU > threshold
      - Memory > threshold
      - Temperature > threshold
    """
    thresholds = _get_thresholds()

    checks = [
        ('cpu_usage', result.get('cpu_usage', 0), 'High CPU usage'),
        ('memory_usage', result.get('memory_usage', 0), 'High memory usage'),
        ('temperature', result.get('temperature'), 'High temperature'),
    ]

    for metric_name, value, label in checks:
        if value is None:
            continue

        metric_thresholds = thresholds.get(metric_name, {})
        
        # Check critical first, then warning
        for severity in ('critical', 'warning'):
            threshold = metric_thresholds.get(severity)
            if threshold is None:
                continue

            if value > threshold:
                title = f"{label} on {device.name}"
                # Only create if there isn't already an open alert for same device + title
                alert, created = Alert.objects.get_or_create(
                    device=device,
                    title=title,
                    status='open',
                    defaults={
                        'description': (
                            f"{metric_name.replace('_', ' ').title()} is at "
                            f"{value:.1f}{'%' if 'usage' in metric_name else '°C'} "
                            f"(threshold: {threshold}{'%' if 'usage' in metric_name else '°C'})"
                        ),
                        'severity': severity,
                    }
                )
                if created:
                    logger.info(
                        'ALERT [%s]: %s — %s = %.1f (threshold: %.1f)',
                        severity.upper(), device.name, metric_name, value, threshold
                    )
                    broadcast_alert(alert)
                break  # Don't create both critical and warning for same metric


def _create_offline_alert(device, was_online):
    """Create an alert when a device goes offline."""
    title = f"Device {device.name} is offline"
    alert, created = Alert.objects.get_or_create(
        device=device,
        title=title,
        status='open',
        defaults={
            'description': (
                f"Device at {device.ip_address} is not responding. "
                f"{'Was previously online.' if was_online else 'Not reachable on initial check.'}"
            ),
            'severity': 'critical',
        }
    )
    if created:
        logger.warning('ALERT [CRITICAL]: Device %s (%s) went offline', device.name, device.ip_address)
        broadcast_alert(alert)


def _auto_resolve_offline_alerts(device):
    """Auto-resolve offline alerts when a device comes back online."""
    resolved_count = Alert.objects.filter(
        device=device,
        title__icontains='offline',
        status__in=['open', 'in-progress']
    ).update(
        status='resolved',
        resolved_at=timezone.now()
    )
    if resolved_count:
        logger.info('Auto-resolved %d offline alert(s) for %s', resolved_count, device.name)


# ---------------------------------------------------------------------------
# WebSocket Broadcasting
# ---------------------------------------------------------------------------
def broadcast_metric(metric):
    """Broadcast a metric update to all connected WebSocket clients."""
    try:
        channel_layer = get_channel_layer()
        if channel_layer is None:
            return
        async_to_sync(channel_layer.group_send)(
            'dashboard_updates',
            {
                'type': 'dashboard_update',
                'data': {
                    'type': 'metric_update',
                    'device_id': metric.device_id,
                    'device_name': metric.device.name,
                    'metrics': MetricSerializer(metric).data,
                }
            }
        )
    except Exception:
        logger.exception('Failed to broadcast metric update')


def broadcast_alert(alert):
    """Broadcast a new alert to all connected WebSocket clients."""
    try:
        channel_layer = get_channel_layer()
        if channel_layer is None:
            return
        async_to_sync(channel_layer.group_send)(
            'dashboard_updates',
            {
                'type': 'dashboard_update',
                'data': {
                    'type': 'alert_triggered',
                    'alert': AlertSerializer(alert).data,
                }
            }
        )
    except Exception:
        logger.exception('Failed to broadcast alert')


def broadcast_device_status(device):
    """Broadcast device status change."""
    try:
        channel_layer = get_channel_layer()
        if channel_layer is None:
            return
        async_to_sync(channel_layer.group_send)(
            'dashboard_updates',
            {
                'type': 'dashboard_update',
                'data': {
                    'type': 'device_status',
                    'device_id': device.id,
                    'device_name': device.name,
                    'is_online': device.is_online,
                    'timestamp': timezone.now().isoformat(),
                }
            }
        )
    except Exception:
        logger.exception('Failed to broadcast device status')


# ---------------------------------------------------------------------------
# Metric Cleanup (optional scheduled task)
# ---------------------------------------------------------------------------
@shared_task(name='api.tasks.cleanup_old_metrics')
def cleanup_old_metrics(days=30):
    """Remove metrics older than N days to prevent database bloat."""
    cutoff = timezone.now() - timezone.timedelta(days=days)
    deleted_count, _ = Metric.objects.filter(timestamp__lt=cutoff).delete()
    logger.info('Cleaned up %d metrics older than %d days', deleted_count, days)
    return f"Deleted {deleted_count} old metrics"
