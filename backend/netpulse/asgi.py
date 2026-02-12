"""
ASGI config for netpulse project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/asgi/
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'netpulse.settings')

# Initialize Django ASGI application early to ensure the AppRegistry
# is populated before we import code that may import ORM models.
django_asgi_app = get_asgi_application()

# Now we can import channels routing and consumers
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from django.urls import re_path
from api.consumers import DashboardConsumer

application = ProtocolTypeRouter({
	'http': django_asgi_app,
	'websocket': AuthMiddlewareStack(
		URLRouter([
			re_path(r'ws/dashboard/?$', DashboardConsumer.as_asgi()),
		])
	),
})
