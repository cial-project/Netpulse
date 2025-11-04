import json
import logging
import requests
from django.conf import settings
from .models import Audit

logger = logging.getLogger(__name__)


def forward_to_siem(event_type: str, payload: dict, user=None, ip_address=None):
    """Send an event to configured SIEM endpoint (if any) and record an Audit entry.

    This is intentionally simple: a POST to SIEM_WEBHOOK_URL with a small JSON payload.
    """
    siem_url = getattr(settings, 'SIEM_WEBHOOK_URL', None)

    # Create audit entry locally
    try:
        Audit.objects.create(
            event_type=event_type,
            user=user,
            ip_address=ip_address,
            details=json.dumps(payload)
        )
    except Exception:
        logger.exception('Failed to write Audit record for SIEM event')

    if not siem_url:
        logger.debug('No SIEM_WEBHOOK_URL configured; skipping forward')
        return False

    headers = {'Content-Type': 'application/json'}
    try:
        resp = requests.post(siem_url, json={'type': event_type, 'payload': payload}, headers=headers, timeout=5)
        resp.raise_for_status()
        logger.debug('Forwarded event to SIEM: %s', siem_url)
        return True
    except Exception:
        logger.exception('Failed to forward event to SIEM at %s', siem_url)
        return False
