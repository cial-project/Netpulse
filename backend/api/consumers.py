import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import Device, Alert, Metric

class DashboardConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()
        await self.channel_layer.group_add('dashboard_updates', self.channel_name)
        
        # Send initial data
        await self.send_initial_data()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard('dashboard_updates', self.channel_name)

    async def send_initial_data(self):
        """Send current system status when client connects"""
        data = {
            'type': 'initial_data',
            'devices_online': await self.get_online_devices_count(),
            'alerts_critical': await self.get_critical_alerts_count(),
            'latest_metrics': await self.get_latest_metrics(),
        }
        await self.send(text_data=json.dumps(data))

    async def receive(self, text_data):
        """Handle messages from client"""
        pass

    async def dashboard_update(self, event):
        """Send real-time updates to client"""
        await self.send(text_data=json.dumps(event['data']))

    @database_sync_to_async
    def get_online_devices_count(self):
        return Device.objects.filter(is_online=True).count()

    @database_sync_to_async
    def get_critical_alerts_count(self):
        return Alert.objects.filter(severity='critical', status='open').count()

    @database_sync_to_async
    def get_latest_metrics(self):
        latest = Metric.objects.order_by('-timestamp').first()
        return {
            'cpu_usage': latest.cpu_usage if latest else 0,
            'network_in': latest.network_in if latest else 0,
            'timestamp': latest.timestamp.isoformat() if latest else None
        } if latest else {}