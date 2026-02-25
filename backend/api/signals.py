import json
import logging
from django.db.models.signals import post_save
from django.dispatch import receiver
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from .models import Alert

logger = logging.getLogger('poller')

@receiver(post_save, sender=Alert)
def alert_post_save(sender, instance, created, **kwargs):
    """Broadcast newly created alerts to the dashboard_updates group."""
    try:
        if not created:
            return

        from .serializers import AlertSerializer
        payload = {
            'type': 'alert_triggered',
            'alert': AlertSerializer(instance).data
        }

        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                'dashboard_updates',
                {
                    'type': 'dashboard_update',
                    'data': payload
                }
            )
    except Exception as e:
        logger.exception('Failed to broadcast alert via signal: %s', e)
