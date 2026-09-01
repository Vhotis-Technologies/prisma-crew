"""
Crew-side websocket consumer (proxies to support server via Channels).

Crew connects here with their JWT. This consumer:
1. Validates crew JWT
2. Gets or creates their thread on support server (via REST)
3. Joins the thread's channel group
4. Proxies messages between crew and support server
"""
import json
import logging
import requests
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist

logger = logging.getLogger(__name__)


class CrewSupportChatConsumer(AsyncWebsocketConsumer):
    """
    Crew websocket for support chat.
    
    URL: /ws/support-chat/?token=<crew_jwt>
    
    Crew connects with JWT, consumer proxies to support server's channel layer.
    """
    
    async def connect(self):
        self.user = None
        self.thread_id = None
        self.room_group_name = None
        
        # Extract JWT from query string
        query_string = self.scope.get('query_string', b'').decode()
        token = None
        for param in query_string.split('&'):
            if param.startswith('token='):
                token = param.split('token=', 1)[1]
                break
        
        if not token:
            logger.warning("Crew WS rejected: missing token")
            await self.close(code=4003)
            return
        
        # Verify crew JWT
        try:
            # Lazy import to avoid AppRegistryNotReady error
            from rest_framework_simplejwt.tokens import AccessToken
            
            access_token = AccessToken(token)
            user_id = access_token['user_id']
            self.user = await self.get_crew_user(user_id)
            
            if not self.user:
                logger.warning(f"Crew WS rejected: user {user_id} not found or not crew")
                await self.close(code=4004)
                return
            
        except Exception as e:
            logger.warning(f"Crew WS auth failed: {e}")
            await self.close(code=4003)
            return
        
        # Get or create thread on support server
        self.thread_id = await self.get_or_create_thread()
        if not self.thread_id:
            logger.error(f"Failed to get/create thread for crew {self.user.id}")
            await self.close(code=4005)
            return
        
        # Join room group (same group as support server uses)
        self.room_group_name = f'crew_chat_{self.thread_id}'
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()
        logger.info(f"Crew {self.user.email} joined chat thread {self.thread_id}")
    
    async def disconnect(self, close_code):
        """Leave room group on disconnect."""
        if hasattr(self, 'room_group_name') and self.room_group_name:
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )
            if hasattr(self, 'user') and self.user:
                logger.info(f"Crew {self.user.email} left thread {self.thread_id}")
    
    async def receive(self, text_data):
        """Handle incoming messages from crew."""
        try:
            data = json.loads(text_data)
            message_type = data.get('type', 'message')
            
            if message_type == 'message':
                body = data.get('body', '').strip()
                booking_reference = data.get('booking_reference')
                
                if not body:
                    return
                
                # Save message to support server
                result = await self.save_message_to_support(body, booking_reference)
                if result.get('error') == 'thread_closed':
                    await self.send(text_data=json.dumps({
                        'type': 'thread_status',
                        'status': 'closed',
                        'thread_id': self.thread_id,
                    }))
                    return

                message = result.get('message')
                if not message:
                    logger.error(f"Failed to save message for thread {self.thread_id}")
                    return
                # Support API already broadcasts saved messages to the shared group.
        except json.JSONDecodeError:
            logger.warning(f"Invalid JSON from crew {self.user.email}")
        except Exception as e:
            logger.error(f"Error handling crew message: {e}")
    
    async def chat_message(self, event):
        """
        Receive message from room group and send to WebSocket.
        
        This is called when support staff (or another crew client) sends a message.
        """
        message = event['message']
        await self.send(text_data=json.dumps(message))

    async def thread_status(self, event):
        """Forward thread open/closed status to connected crew clients."""
        await self.send(text_data=json.dumps({
            'type': 'thread_status',
            'status': event['status'],
            'thread_id': event.get('thread_id'),
        }))
    
    @database_sync_to_async
    def get_crew_user(self, user_id):
        """Get crew user by ID."""
        try:
            from main.models import User
            user = User.objects.get(id=user_id, is_detailer=True)
            return user
        except ObjectDoesNotExist:
            return None
    
    @database_sync_to_async
    def get_or_create_thread(self):
        """
        Call support server REST API to get/create thread.
        
        Returns thread_id or None if failed.
        """
        try:
            support_url = settings.SUPPORT_API_URL.rstrip('/')
            if not support_url:
                logger.error("SUPPORT_API_URL not configured")
                return None
            
            internal_key = settings.SUPPORT_INTERNAL_API_KEY.strip()
            if not internal_key:
                logger.error("SUPPORT_INTERNAL_API_KEY not configured")
                return None
            
            url = f"{support_url}/api/v1/crew-chat-bridge/get_or_create_thread/"
            
            resp = requests.post(
                url,
                json={
                    'crew_user_id': str(self.user.id),
                    'crew_name': self.user.get_full_name(),
                    'crew_email': self.user.email,
                },
                headers={
                    'X-Support-Internal-Key': internal_key,
                    'Content-Type': 'application/json',
                },
                timeout=10
            )
            
            if resp.status_code == 200:
                data = resp.json()
                thread_id = data.get('data', {}).get('thread_id')
                if thread_id:
                    return thread_id
            
            logger.error(f"Failed to get/create thread: {resp.status_code} {resp.text}")
            return None
            
        except Exception as e:
            logger.error(f"Exception getting/creating thread: {e}")
            return None
    
    @database_sync_to_async
    def save_message_to_support(self, body, booking_reference=None):
        """
        POST message to support server via REST API.
        
        Returns message in gifted-chat format or None if failed.
        """
        try:
            support_url = settings.SUPPORT_API_URL.rstrip('/')
            internal_key = settings.SUPPORT_INTERNAL_API_KEY.strip()
            
            url = f"{support_url}/api/v1/crew-chat-bridge/send_message/"
            
            resp = requests.post(
                url,
                json={
                    'thread_id': self.thread_id,
                    'body': body,
                    'sender_id': str(self.user.id),
                    'sender_name': self.user.get_full_name(),
                    'booking_reference': booking_reference,
                },
                headers={
                    'X-Support-Internal-Key': internal_key,
                    'Content-Type': 'application/json',
                },
                timeout=10
            )
            
            if resp.status_code == 409:
                return {'error': 'thread_closed'}

            if resp.status_code == 200:
                data = resp.json()
                message = data.get('data', {}).get('message')
                if message:
                    return {'message': message}
            
            logger.error(f"Failed to save message: {resp.status_code} {resp.text}")
            return {'error': 'failed'}
            
        except Exception as e:
            logger.error(f"Exception saving message: {e}")
            return {'error': 'failed'}
