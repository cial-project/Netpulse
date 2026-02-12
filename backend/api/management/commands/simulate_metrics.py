import time
import random
import json
from django.core.management.base import BaseCommand
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from api.models import Device, ISP, Port, Zone, Alert, Metric

class Command(BaseCommand):
    help = 'Simulates real-time network metrics and broadcasts updates via WebSockets'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Starting network simulation...'))
        channel_layer = get_channel_layer()

        while True:
            try:
                # 1. Simulate Device Metrics (CPU, Memory, Temp)
                devices = Device.objects.filter(is_active=True)
                device_updates = []
                for device in devices:
                    # Randomize with some logic (servers higher load, switches lower)
                    base_load = 40 if device.device_type == 'server' else 20
                    device.cpu_load = min(100, max(0, base_load + random.uniform(-10, 15)))
                    device.memory_load = min(100, max(0, base_load + 10 + random.uniform(-5, 5)))
                    device.temperature = min(80, max(20, 35 + random.uniform(-2, 5)))
                    
                    # Create Metric history record (optional, maybe keep it light to avoid DB bloat)
                    # Metric.objects.create(device=device, cpu_usage=device.cpu_load, memory_usage=device.memory_load, temperature=device.temperature, network_in=0, network_out=0)
                    
                    device.save(update_fields=['cpu_load', 'memory_load', 'temperature'])
                    
                    device_updates.append({
                        'id': device.id,
                        'name': device.name,
                        'cpu_load': round(device.cpu_load, 1),
                        'memory_load': round(device.memory_load, 1),
                        'temperature': round(device.temperature, 1),
                        'is_online': device.is_online
                    })

                # 2. Simulate ISP Metrics
                isps = ISP.objects.filter(is_active=True)
                isp_updates = []
                for isp in isps:
                    # Random fluctuation around plan limits (mostly good)
                    # Occasional "flapping" or "packet loss" spike
                    latency_base = 15
                    if isp.name == 'BSNL': latency_base = 25
                    
                    isp.latency_ms = max(5, latency_base + random.uniform(-5, 20))
                    isp.packet_loss = 0.0
                    if random.random() > 0.95: # 5% chance of packet loss
                         isp.packet_loss = random.uniform(0.1, 2.0)
                    
                    # Bandwidth utilization (random % of plan)
                    util_dl = random.uniform(0.1, 0.8) * isp.plan_download_mbps
                    util_ul = random.uniform(0.05, 0.3) * isp.plan_upload_mbps
                    
                    isp.downstream_mbps = round(util_dl, 2)
                    isp.upstream_mbps = round(util_ul, 2)
                    
                    # Flapping simulation
                    if random.random() > 0.98:
                        isp.is_flapping = not isp.is_flapping
                    
                    isp.save(update_fields=['latency_ms', 'packet_loss', 'downstream_mbps', 'upstream_mbps', 'is_flapping'])
                    
                    isp_updates.append({
                        'id': isp.id,
                        'name': isp.name,
                        'latency_ms': round(isp.latency_ms, 1),
                        'packet_loss': round(isp.packet_loss, 2),
                        'downstream_mbps': isp.downstream_mbps,
                        'upstream_mbps': isp.upstream_mbps,
                        'is_flapping': isp.is_flapping,
                        'provider_image': isp.provider_image
                    })

                # 3. Simulate Port Metrics
                ports = Port.objects.filter(is_active=True)
                port_updates = []
                for port in ports:
                    # Random utilization
                    util = random.uniform(0, 90)
                    if 'Core' in port.device_name:
                         util = random.uniform(40, 80) # Core ports busier
                    
                    port.utilization_in = round(util, 1)
                    port.utilization_out = round(util * random.uniform(0.5, 1.2), 1)
                    
                    # Calculate bps based on capacity (default 1Gbps)
                    capacity = 1000 * 1000 * 1000
                    port.bps_in = int((port.utilization_in / 100) * capacity)
                    port.bps_out = int((port.utilization_out / 100) * capacity)
                    
                    port.latency_ms = random.uniform(1, 10)
                    port.packet_drops = 0.0
                    if random.random() > 0.90:
                         port.packet_drops = random.uniform(0.1, 0.5)
                         
                    port.save(update_fields=['utilization_in', 'utilization_out', 'bps_in', 'bps_out', 'latency_ms', 'packet_drops'])
                    
                    port_updates.append({
                        'id': port.id,
                        'name': port.name,
                        'utilization_in': port.utilization_in,
                        'utilization_out': port.utilization_out,
                        'bps_in': port.bps_in,
                        'bps_out': port.bps_out,
                        'latency_ms': round(port.latency_ms, 1),
                        'packet_drops': round(port.packet_drops, 2)
                    })
                    
                # 4. Simulate Environmental (Zones)
                zones = Zone.objects.all()
                zone_updates = []
                for zone in zones:
                     # DC default temp 22C
                     base_temp = 22.0
                     if zone.key == 'DR': base_temp = 24.0
                     
                     zone.temperature = round(base_temp + random.uniform(-1, 2), 1)
                     zone.humidity = round(40 + random.uniform(-5, 10), 1)
                     zone.save(update_fields=['temperature', 'humidity'])
                     
                     zone_updates.append({
                         'id': zone.id,
                         'name': zone.name,
                         'temperature': zone.temperature,
                         'humidity': zone.humidity
                     })

                # Broadcast to WebSocket
                payload = {
                    'type': 'realtime_update',
                    'devices': device_updates,
                    'isps': isp_updates,
                    'ports': port_updates,
                    'zones': zone_updates,
                    'timestamp': time.time()
                }
                
                async_to_sync(channel_layer.group_send)(
                    "dashboard_updates",
                    {
                        "type": "dashboard_update",
                        "data": payload
                    }
                )
                
                self.stdout.write('.', ending='')
                self.stdout.flush()
                time.sleep(2) # Update every 2 seconds

            except KeyboardInterrupt:
                self.stdout.write(self.style.SUCCESS('\nSimulation stopped'))
                break
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'\nError: {e}'))
                time.sleep(5)
