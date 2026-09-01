"""WebSocket URL routing for Django Channels."""
from django.urls import re_path
from main.consumers import CrewSupportChatConsumer

websocket_urlpatterns = [
    re_path(r'ws/support-chat/$', CrewSupportChatConsumer.as_asgi()),
]
