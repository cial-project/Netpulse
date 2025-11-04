import os
import time
import logging
from django.core.management.base import BaseCommand
from django.utils import timezone
from api.models import Device, Metric, Alert
from devices.snmp_service import poll_device
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync


class Command(BaseCommand):
    help = 'Continuously poll all network devices via SNMP and update metrics'

    def add_arguments(self, parser):
        parser.add_argument(
            '--interval',
            type=int,
            default=None,
            help='Polling interval in seconds (overrides POLL_INTERVAL env var).'
        )

    def handle(self, *args, **options):
        # Determine interval: CLI option > env var > default 30s
        env_interval = os.environ.get('POLL_INTERVAL')
        interval = options.get('interval')
        if interval is None:
            try:
                interval = int(env_interval) if env_interval is not None else 30
            except Exception:
                interval = 30

        logger = logging.getLogger('poller')
        logger.info('Starting device polling loop with interval %s seconds', interval)
        self.stdout.write(self.style.SUCCESS(f'Starting device polling every {interval} seconds...'))

        try:
            while True:
                start = time.time()
                try:
                    self.poll_all_devices()
                    logger.info('Polling completed at %s', timezone.now())
                except Exception:
                    logger.exception('Unhandled exception during polling')

                # Sleep remaining time to respect the interval
                elapsed = time.time() - start
                sleep_for = max(0, interval - elapsed)
                time.sleep(sleep_for)

        except KeyboardInterrupt:
            logger.info('Poller interrupted by user, exiting')
            self.stdout.write(self.style.WARNING('Poller stopped by user'))

    def poll_all_devices(self):
        """Poll all active devices and update metrics"""
        logger = logging.getLogger('poller')
        devices = Device.objects.filter(is_active=True)

        for device in devices:
            try:
                port = getattr(device, 'port', 161)
                logger.info('Polling %s (%s:%s)', device.name, device.ip_address, port)

                # Determine if device has a custom poll interval (for staggering)
                device_interval = getattr(device, 'poll_interval_seconds', None) or None

                # Pass custom OIDs/text to the SNMP poller if available
                custom_oids = getattr(device, 'custom_oids', '') or ''

                result = poll_device(
                    device.ip_address,
                    device.device_type,
                    device.snmp_community,
                    port,
                    custom_oids=custom_oids
                )

                was_online = device.is_online
                device.is_online = result.get('reachable', False)

                if device.is_online:
                    device.last_seen = timezone.now()
                    device.sys_name = result.get('sys_name', device.sys_name)
                    device.uptime_days = result.get('uptime_days', device.uptime_days or 0)

                    Metric.objects.create(
                        device=device,
                        cpu_usage=result.get('cpu_usage', 0),
                        memory_usage=result.get('memory_usage', 0),
                        network_in=result.get('network_in', 0),
                        network_out=result.get('network_out', 0),
                        temperature=result.get('temperature', None),
                    )

                    # Check for alerts based on returned metrics
                    self.check_alert_conditions(device, result)

                    # If device transitioned from offline -> online, notify clients
                    if not was_online and device.is_online:
                        try:
                            Alert.objects.create(
                                device=device,
                                title=f"Device {device.name} is back online",
                                description=f"Device restored connectivity at {timezone.now()}",
                                severity='info',
                                status='open'
                            )
                        except Exception:
                            logger.exception('Failed to create back-online alert for %s', device.name)
                        self.send_ws_update({
                            'type': 'device_update',
                            'change': 'back_online',
                            'device': {
                                'id': device.id,
                                'name': device.name,
                                'ip': device.ip_address,
                                'is_online': device.is_online,
                                'last_seen': device.last_seen.isoformat() if device.last_seen else None,
                            }
                        })

                else:
                    if was_online:
                        alert = None
                        try:
                            alert = Alert.objects.create(
                                device=device,
                                title=f"Device {device.name} is down",
                                description=f"Device {device.ip_address} is not responding to SNMP",
                                severity='critical',
                                status='open'
                            )
                        except Exception:
                            logger.exception('Failed to create down alert for %s', device.name)

                        # Notify connected dashboard clients that device went offline
                        self.send_ws_update({
                            'type': 'device_update',
                            'change': 'went_offline',
                            'device': {
                                'id': device.id,
                                'name': device.name,
                                'ip': device.ip_address,
                                'is_online': device.is_online,
                                'last_seen': device.last_seen.isoformat() if device.last_seen else None,
                            },
                            'alert': {
                                'id': alert.id if alert else None,
                                'title': alert.title if alert else None,
                                'severity': alert.severity if alert else None,
                                'created_at': alert.created_at.isoformat() if alert else None,
                            }
                        })

                device.save()
                logger.info('Status for %s: %s', device.name, 'Online' if device.is_online else 'Offline')

            except Exception:
                logger.exception('Error polling %s', getattr(device, 'name', 'unknown'))
                try:
                    device.is_online = False
                    device.save()
                except Exception:
                    logger.exception('Failed to mark device offline')

    def check_alert_conditions(self, device, metrics):
        thresholds = {
            'cpu_usage': 80,
            'memory_usage': 85,
        }

        for metric, threshold in thresholds.items():
            value = metrics.get(metric, 0)
            if value and value > threshold:
                existing_alert = Alert.objects.filter(
                    device=device,
                    title__contains=metric,
                    status='open'
                ).first()

                if not existing_alert:
                        try:
                            alert = Alert.objects.create(
                                device=device,
                                title=f"High {metric.replace('_', ' ')} on {device.name}",
                                description=f"{metric.replace('_', ' ')} is at {value}% (threshold: {threshold}%)",
                                severity='warning' if value < 95 else 'critical',
                                status='open'
                            )
                        except Exception:
                            logger = logging.getLogger('poller')
                            logger.exception('Failed to create alert for %s %s', device.name, metric)
                        else:
                            # Send a websocket notification about the new alert
                            self.send_ws_update({
                                'type': 'alert_triggered',
                                'alert': {
                                    'id': alert.id,
                                    'device_id': device.id,
                                    'device_name': device.name,
                                    'title': alert.title,
                                    'severity': alert.severity,
                                    'created_at': alert.created_at.isoformat()
                                }
                            })

    def send_ws_update(self, payload):
        """Helper to send a dict payload to the dashboard_updates group via Channels."""
        try:
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                'dashboard_updates',
                {
                    'type': 'dashboard_update',
                    'data': payload
                }
            )
        except Exception:
            logger = logging.getLogger('poller')
            logger.exception('Failed to send websocket update: %s', payload)

