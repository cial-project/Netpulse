"""
Celery tasks for device polling, metrics storage, alert generation, and WebSocket broadcasting.

Beat Schedule (configured in settings.py):
  - poll_all_devices    → every 10 seconds
  - probe_all_isps      → every 60 seconds
  - cleanup_old_metrics → daily
"""
from celery import shared_task
from django.utils import timezone
from django.core.cache import cache
from .models import Device, Metric, Alert, AlertThreshold, Port, ISP
from devices.snmp_service import poll_device
from .serializers import MetricSerializer, AlertSerializer
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import logging

logger = logging.getLogger('netpulse.poller')


# ---------------------------------------------------------------------------
# Default thresholds (used when AlertThreshold table is empty or unconfigured)
# ---------------------------------------------------------------------------
DEFAULT_THRESHOLDS = {
    'cpu_usage':    {'warning': 70, 'critical': 85},
    'memory_usage': {'warning': 70, 'critical': 85},
    'temperature':  {'warning': 35, 'critical': 45},
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

    for metric, levels in DEFAULT_THRESHOLDS.items():
        if metric not in thresholds:
            thresholds[metric] = levels
        else:
            for severity, value in levels.items():
                thresholds[metric].setdefault(severity, value)

    return thresholds


# ---------------------------------------------------------------------------
# Scheduled entry-point (every 10 s via Celery Beat)
# ---------------------------------------------------------------------------
POLL_LOCK_KEY   = 'poll_all_devices_lock'
POLL_LOCK_TTL   = 30  # seconds — longer than beat interval to prevent overlap

@shared_task(name='api.tasks.poll_all_devices')
def poll_all_devices():
    """Scheduled task to queue polling for all active devices.
    
    Uses a cache lock to prevent overlapping poll cycles — if a previous
    cycle is still running, this invocation is silently skipped.
    """
    # Acquire lock (atomic add returns True only for first caller)
    if not cache.add(POLL_LOCK_KEY, 'locked', POLL_LOCK_TTL):
        logger.info('poll_all_devices: previous cycle still running, skipping')
        return 'Skipped — previous cycle still running'

    try:
        devices = Device.objects.filter(is_active=True).values_list('id', flat=True)
        ports   = Port.objects.filter(is_active=True).values_list('id', flat=True)

        for device_id in devices:
            poll_single_device.delay(device_id)

        for port_id in ports:
            update_port_metrics.delay(port_id)

        logger.info('Queued polling for %d devices and %d ports', len(devices), len(ports))
        return f"Queued {len(devices)} devices and {len(ports)} ports"
    finally:
        cache.delete(POLL_LOCK_KEY)


# ---------------------------------------------------------------------------
# ISP Probe Tasks
# ---------------------------------------------------------------------------
@shared_task(name='api.tasks.probe_all_isps')
def probe_all_isps():
    """Scheduled task to probe all active ISPs."""
    isp_ids = ISP.objects.filter(is_active=True).values_list('id', flat=True)
    for isp_id in isp_ids:
        probe_single_isp.delay(isp_id)
    logger.info('Queued probe for %d ISPs', len(isp_ids))
    return f"Queued {len(isp_ids)} ISPs"


@shared_task(name='api.tasks.probe_single_isp', bind=True, max_retries=2, default_retry_delay=15)
def probe_single_isp(self, isp_id):
    """Worker: probe a single ISP and store results in DB."""
    try:
        isp = ISP.objects.get(id=isp_id)
    except ISP.DoesNotExist:
        logger.warning('probe_single_isp: ISP %s not found', isp_id)
        return f"ISP {isp_id} not found"

    try:
        from devices.isp_service import probe_isp
        res = probe_isp(isp.host)
        isp.last_checked    = timezone.now()
        isp.latency_ms      = res.get('latency_ms')
        isp.packet_loss     = res.get('packet_loss', 0)
        isp.upstream_mbps   = res.get('upstream_mbps', 0)
        isp.downstream_mbps = res.get('downstream_mbps', 0)
        isp.is_flapping     = isp.packet_loss is not None and isp.packet_loss > 5
        isp.is_active       = True
        isp.save()
        
        # 2. Store History (Latency as network_in, Loss as network_out)
        metric = Metric.objects.create(
            isp=isp,
            network_in=isp.latency_ms or 0.0,
            network_out=isp.packet_loss or 0.0,
            cpu_usage=0.0,
            memory_usage=0.0
        )

        # 3. Broadcast real-time update
        _broadcast_isp_update(isp)

        logger.debug('Probed ISP %s: latency=%sms, loss=%s%%', isp.name, isp.latency_ms, isp.packet_loss)
        return f"Probed {isp.name}"
    except Exception as e:
        logger.exception('ISP probe failed for %s: %s', isp_id, e)
        try:
            self.retry(exc=e)
        except self.MaxRetriesExceededError:
            pass
        return f"Error probing ISP {isp_id}: {e}"


# ---------------------------------------------------------------------------
# Port Metrics Task
# ---------------------------------------------------------------------------
@shared_task(name='api.tasks.update_port_metrics')
def update_port_metrics(port_id):
    """Worker: simulate/collect port traffic metrics and store them."""
    try:
        port = Port.objects.get(id=port_id)
    except Port.DoesNotExist:
        return f"Port {port_id} not found"

    try:
        from devices.port_service import simulate_port_traffic
        data = simulate_port_traffic(port.capacity_mbps)

        port.bps_in         = data['bps_in']
        port.bps_out        = data['bps_out']
        port.utilization_in  = data['utilization_in']
        port.utilization_out = data['utilization_out']
        port.status         = data['status']
        port.last_checked   = timezone.now()
        port.save()

        _broadcast_port_update(port)
        return f"Updated port {port.name}"
    except Exception as e:
        logger.error('Error updating port %s: %s', port_id, e)
        return str(e)


def _broadcast_port_update(port):
    """Push port update via WebSocket."""
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
                        'utilization_in':  port.utilization_in,
                        'utilization_out': port.utilization_out,
                        'bps_in':          port.bps_in,
                        'bps_out':         port.bps_out,
                        'status':          port.status,
                    }
                }
            )
    except Exception:
        pass  # Silent: WS layer may not be present in all environments


# ---------------------------------------------------------------------------
# Per-device worker
# ---------------------------------------------------------------------------
@shared_task(name='api.tasks.poll_single_device', bind=True, max_retries=2,
             default_retry_delay=10)
def poll_single_device(self, device_id):
    """Worker task: poll a single device via SNMP, store metric, generate alerts."""
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
            getattr(device, 'snmp_port', 161),
            custom_oids=getattr(device, 'custom_oids', ''),
        )

        device.is_online = result.get('reachable', False)

        if device.is_online:
            device.last_seen   = timezone.now()
            device.sys_name    = result.get('sys_name', device.sys_name)
            device.uptime_days = result.get('uptime_days', device.uptime_days or 0)
            device.cpu_load    = result.get('cpu_usage', device.cpu_load)
            device.memory_load = result.get('memory_usage', device.memory_load)
            if result.get('temperature') is not None:
                device.temperature = result['temperature']

            # Bandwidth delta calculation using cache
            from django.core.cache import cache
            cache_key     = f"device_{device.id}_network_bytes"
            previous_data = cache.get(cache_key)

            bytes_in  = result.get('bytes_in', 0)
            bytes_out = result.get('bytes_out', 0)
            now_ts    = timezone.now().timestamp()
            network_in_mbps  = result.get('network_in', 0.0)
            network_out_mbps = result.get('network_out', 0.0)

            if bytes_in > 0 or bytes_out > 0:
                if previous_data:
                    delta_t = now_ts - previous_data.get('time', now_ts - 10)
                    if delta_t > 0:
                        network_in_mbps  = max(0.0, ((bytes_in  - previous_data.get('bytes_in',  0)) * 8) / (delta_t * 1_000_000))
                        network_out_mbps = max(0.0, ((bytes_out - previous_data.get('bytes_out', 0)) * 8) / (delta_t * 1_000_000))
                cache.set(cache_key, {'bytes_in': bytes_in, 'bytes_out': bytes_out, 'time': now_ts}, timeout=86400)
                result['network_in']  = network_in_mbps
                result['network_out'] = network_out_mbps

            metric_instance = Metric.objects.create(
                device=device,
                cpu_usage    = result.get('cpu_usage', 0),
                memory_usage = result.get('memory_usage', 0),
                network_in   = network_in_mbps,
                network_out  = network_out_mbps,
                temperature  = result.get('temperature'),
            )

            _broadcast_metric(metric_instance)
            _check_threshold_alerts(device, result)

            if not was_online:
                _auto_resolve_offline_alerts(device)

        else:
            _create_offline_alert(device, was_online)

        device.save()
        logger.debug('Polled %s: online=%s', device.name, device.is_online)
        return f"Polled {device.name}: online={device.is_online}"

    except Exception as e:
        logger.exception('Error polling device %s: %s', device_id, e)
        try:
            self.retry(exc=e)
        except self.MaxRetriesExceededError:
            logger.error('Max retries exceeded for device %s', device_id)
        return f"Error polling device {device_id}: {e}"


# ---------------------------------------------------------------------------
# Alert Generation Engine
# ---------------------------------------------------------------------------
def _check_threshold_alerts(device, result):
    """Evaluate poll results against thresholds and fire alerts if needed."""
    thresholds = _get_thresholds()
    checks = [
        ('cpu_usage',    result.get('cpu_usage', 0),  'High CPU usage'),
        ('memory_usage', result.get('memory_usage', 0), 'High memory usage'),
        ('temperature',  result.get('temperature'),   'High temperature'),
    ]

    for metric_name, value, label in checks:
        if value is None:
            continue
        metric_thresholds = thresholds.get(metric_name, {})
        for severity in ('critical', 'warning'):
            threshold = metric_thresholds.get(severity)
            if threshold is None:
                continue
            if value > threshold:
                title = f"{label} on {device.name}"
                if not Alert.objects.filter(device=device, title=title, status='open').exists():
                    alert = Alert.objects.create(
                        device=device,
                        title=title,
                        status='open',
                        description=(
                            f"{metric_name.replace('_', ' ').title()} is at "
                            f"{value:.1f}{'%' if 'usage' in metric_name else '°C'} "
                            f"(threshold: {threshold}{'%' if 'usage' in metric_name else '°C'})"
                        ),
                        severity=severity,
                    )
                    logger.info('ALERT [%s]: %s — %s = %.1f', severity.upper(), device.name, metric_name, value)
                    _broadcast_alert(alert)
                break  # only fire one severity per metric


def _create_offline_alert(device, was_online):
    """Fire an alert when a device goes offline (once per outage)."""
    title = f"Device {device.name} is offline"
    if not Alert.objects.filter(device=device, title=title, status='open').exists():
        alert = Alert.objects.create(
            device=device,
            title=title,
            status='open',
            description=(
                f"Device at {device.ip_address} is not responding. "
                f"{'Was previously online.' if was_online else 'Not reachable on initial check.'}"
            ),
            severity='critical',
        )
        logger.warning('ALERT [CRITICAL]: %s (%s) went offline', device.name, device.ip_address)
        _broadcast_alert(alert)


def _auto_resolve_offline_alerts(device):
    """Auto-resolve offline alerts when a device comes back online."""
    resolved_count = Alert.objects.filter(
        device=device,
        title__icontains='offline',
        status__in=['open', 'in-progress'],
    ).update(status='resolved', resolved_at=timezone.now())
    if resolved_count:
        logger.info('Auto-resolved %d offline alert(s) for %s', resolved_count, device.name)


# ---------------------------------------------------------------------------
# WebSocket Broadcasting (private helpers)
# ---------------------------------------------------------------------------
def _broadcast_metric(metric):
    try:
        channel_layer = get_channel_layer()
        if channel_layer is None:
            return
        async_to_sync(channel_layer.group_send)(
            'dashboard_updates',
            {
                'type': 'dashboard_update',
                'data': {
                    'type':        'metric_update',
                    'device_id':   metric.device_id,
                    'device_name': metric.device.name,
                    'metrics':     MetricSerializer(metric).data,
                }
            }
        )
    except Exception:
        logger.exception('Failed to broadcast metric update')


def _broadcast_alert(alert):
    try:
        channel_layer = get_channel_layer()
        if channel_layer is None:
            return
        async_to_sync(channel_layer.group_send)(
            'dashboard_updates',
            {
                'type': 'dashboard_update',
                'data': {
                    'type':  'alert_triggered',
                    'alert': AlertSerializer(alert).data,
                }
            }
        )
    except Exception:
        logger.exception('Failed to broadcast alert')


def _broadcast_isp_update(isp):
    """Push ISP update via WebSocket."""
    try:
        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                'dashboard_updates',
                {
                    'type': 'dashboard_update',
                    'data': {
                        'type': 'isp_update',
                        'isp_id': isp.id,
                        'name': isp.name,
                        'latency_ms': isp.latency_ms,
                        'packet_loss': isp.packet_loss,
                        'upstream_mbps': isp.upstream_mbps,
                        'downstream_mbps': isp.downstream_mbps,
                        'is_flapping': isp.is_flapping,
                    }
                }
            )
    except Exception:
        pass


# Public aliases kept for any lingering references
broadcast_metric = _broadcast_metric
broadcast_alert  = _broadcast_alert


# ---------------------------------------------------------------------------
# Metric Cleanup (daily scheduled task)
# ---------------------------------------------------------------------------
@shared_task(name='api.tasks.cleanup_old_metrics')
def cleanup_old_metrics(days=30):
    """Remove metrics older than N days to prevent database bloat."""
    cutoff = timezone.now() - timezone.timedelta(days=days)
    deleted_count, _ = Metric.objects.filter(timestamp__lt=cutoff).delete()
    logger.info('Cleaned up %d metrics older than %d days', deleted_count, days)
    return f"Deleted {deleted_count} old metrics"
