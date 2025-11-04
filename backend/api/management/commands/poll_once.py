import logging
from django.core.management.base import BaseCommand
from api.models import Device, Metric, Alert
from devices.snmp_service import poll_device
from api.models import ISP
from devices.isp_service import probe_isp
from django.utils import timezone


class Command(BaseCommand):
    help = 'Run a single polling pass for all devices and exit'

    def handle(self, *args, **options):
        logger = logging.getLogger('poller')
        logger.info('Starting single poll run')

        devices = Device.objects.filter(is_active=True)
        for device in devices:
            try:
                logger.info('Polling %s (%s:%s)', device.name, device.ip_address, getattr(device, 'port', 161))
                result = poll_device(
                    device.ip_address,
                    device.device_type,
                    device.snmp_community,
                    getattr(device, 'port', 161),
                )

                was_online = device.is_online
                device.is_online = result.get('reachable', False)

                if device.is_online:
                    device.last_seen = timezone.now()
                    device.sys_name = result.get('sys_name', 'Unknown')
                    device.uptime_days = result.get('uptime_days', 0)

                    Metric.objects.create(
                        device=device,
                        cpu_usage=result.get('cpu_usage', 0),
                        memory_usage=result.get('memory_usage', 0),
                        network_in=result.get('network_in', 0),
                        network_out=result.get('network_out', 0),
                        temperature=result.get('temperature', None),
                    )

                    # simple alert logic reuse
                    thresholds = {'cpu_usage': 80, 'memory_usage': 85}
                    for metric, threshold in thresholds.items():
                        value = result.get(metric, 0)
                        if value > threshold:
                            existing_alert = Alert.objects.filter(device=device, title__contains=metric, status='open').first()
                            if not existing_alert:
                                Alert.objects.create(
                                    device=device,
                                    title=f"High {metric.replace('_', ' ')} on {device.name}",
                                    description=f"{metric.replace('_', ' ')} is at {value}% (threshold: {threshold}%)",
                                    severity='warning' if value < 95 else 'critical',
                                    status='open'
                                )

                else:
                    if was_online:
                        Alert.objects.create(
                            device=device,
                            title=f"Device {device.name} is down",
                            description=f"Device {device.ip_address} is not responding to SNMP",
                            severity='critical',
                            status='open'
                        )

                device.save()
                logger.info('Status for %s: %s', device.name, 'Online' if device.is_online else 'Offline')

            except Exception:
                logger.exception('Error polling %s', device.name)
                try:
                    device.is_online = False
                    device.save()
                except Exception:
                    logger.exception('Failed to mark device %s offline', getattr(device, 'name', 'unknown'))

        logger.info('Single poll run completed')
        self.stdout.write(self.style.SUCCESS('Single poll completed'))

        # Probe ISPs
        isps = ISP.objects.filter(is_active=True)
        for isp in isps:
            try:
                logger.info('Probing ISP %s (%s)', isp.name, isp.host)
                res = probe_isp(isp.host)
                isp.last_checked = timezone.now()
                isp.latency_ms = res.get('latency_ms')
                isp.packet_loss = res.get('packet_loss')
                isp.upstream_mbps = res.get('upstream_mbps')
                isp.downstream_mbps = res.get('downstream_mbps')
                isp.save()
                logger.info('ISP %s probe result: latency=%s packet_loss=%s', isp.name, isp.latency_ms, isp.packet_loss)
            except Exception:
                logger.exception('Error probing ISP %s', isp.name)
