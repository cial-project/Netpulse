import time
from django.core.management.base import BaseCommand
from django.utils import timezone
from api.models import Device, Metric, Alert
from devices.snmp_service import poll_device

class Command(BaseCommand):
    help = 'Poll all network devices via SNMP and update metrics'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--interval',
            type=int,
            default=300,  # 5 minutes default
            help='Polling interval in seconds',
        )
    
    def handle(self, *args, **options):
        interval = options['interval']
        
        self.stdout.write(
            self.style.SUCCESS(f'Starting device polling every {interval} seconds...')
        )
        
        while True:
            try:
                self.poll_all_devices()
                self.stdout.write(
                    self.style.SUCCESS(f'Polling completed at {timezone.now()}')
                )
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'Polling error: {e}')
                )
            
            time.sleep(interval)
    
    def poll_all_devices(self):
        """Poll all active devices and update metrics"""
        devices = Device.objects.filter(is_active=True)
        
        for device in devices:
            try:
                self.stdout.write(f'Polling {device.name} ({device.ip_address})...')
                
                # Poll device
                result = poll_device(
                    device.ip_address, 
                    device.device_type, 
                    device.snmp_community
                )
                
                # Update device status
                was_online = device.is_online
                device.is_online = result.get('reachable', False)
                
                if device.is_online:
                    device.last_seen = timezone.now()
                    device.sys_name = result.get('sys_name', 'Unknown')
                    device.uptime_days = result.get('uptime_days', 0)
                    
                    # Store metrics
                    Metric.objects.create(
                        device=device,
                        cpu_usage=result.get('cpu_usage', 0),
                        memory_usage=result.get('memory_usage', 0),
                        network_in=result.get('network_in', 0),
                        network_out=result.get('network_out', 0),
                        temperature=result.get('temperature', None),
                    )
                    
                    # Check for alert conditions
                    self.check_alert_conditions(device, result)
                    
                else:
                    # Device is down - create alert if it was previously online
                    if was_online:
                        Alert.objects.create(
                            device=device,
                            title=f"Device {device.name} is down",
                            description=f"Device {device.ip_address} is not responding to SNMP",
                            severity='critical',
                            status='open'
                        )
                
                device.save()
                self.stdout.write(
                    self.style.SUCCESS(f'  Status: {"Online" if device.is_online else "Offline"}')
                )
                
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'  Error polling {device.name}: {e}')
                )
                # Mark device as offline on error
                device.is_online = False
                device.save()
    
    def check_alert_conditions(self, device, metrics):
        """Check if metrics exceed thresholds and create alerts"""
        thresholds = {
            'cpu_usage': 80,    # 80% CPU threshold
            'memory_usage': 85,  # 85% memory threshold
        }
        
        for metric, threshold in thresholds.items():
            value = metrics.get(metric, 0)
            if value > threshold:
                # Check if alert already exists
                existing_alert = Alert.objects.filter(
                    device=device,
                    title__contains=metric,
                    status='open'
                ).first()
                
                if not existing_alert:
                    Alert.objects.create(
                        device=device,
                        title=f"High {metric.replace('_', ' ')} on {device.name}",
                        description=f"{metric.replace('_', ' ')} is at {value}% (threshold: {threshold}%)",
                        severity='warning' if value < 95 else 'critical',
                        status='open'
                    )

                