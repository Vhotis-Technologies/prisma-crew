"""
Crew support chat REST API (detailer BFF).

Crew app calls these endpoints with crew JWT.
Detailer validates crew JWT, then proxies to support server with internal API key.
"""
import logging
import requests
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status as http_status
from django.conf import settings

logger = logging.getLogger(__name__)


class CrewSupportChatView(APIView):
    """
    Crew-facing support chat endpoints.
    
    These are the BFF (Backend For Frontend) endpoints that crew app calls.
    All requests are proxied to support server with internal API key.
    """
    
    permission_classes = [IsAuthenticated]
    
    def get(self, request, action, *args, **kwargs):
        if action == 'get_my_thread':
            return self._get_my_thread(request)
        return Response({'error': 'Invalid action'}, status=http_status.HTTP_400_BAD_REQUEST)
    
    def post(self, request, action, *args, **kwargs):
        if action == 'close_thread':
            return self._close_thread(request)
        return Response({'error': 'Invalid action'}, status=http_status.HTTP_400_BAD_REQUEST)
    
    def _support_url(self, path: str) -> str:
        """Build support server URL."""
        base = getattr(settings, 'SUPPORT_API_URL', '').rstrip('/')
        if not base:
            raise ValueError("SUPPORT_API_URL not configured")
        return f"{base}{path}"
    
    def _support_headers(self) -> dict:
        """Build headers for support server requests."""
        key = getattr(settings, 'SUPPORT_INTERNAL_API_KEY', '').strip()
        if not key:
            raise ValueError("SUPPORT_INTERNAL_API_KEY not configured")
        
        return {
            'X-Support-Internal-Key': key,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        }
    
    def _get_my_thread(self, request):
        """
        Get thread + message history for current crew member.
        
        Proxies to: GET /api/v1/crew-chat-bridge/get_thread_for_crew/
        """
        try:
            url = self._support_url('/api/v1/crew-chat-bridge/get_thread_for_crew/')
            headers = self._support_headers()
            
            resp = requests.get(
                url,
                params={'crew_user_id': str(request.user.id)},
                headers=headers,
                timeout=10
            )
            
            # Forward response as-is
            try:
                data = resp.json() if resp.content else {}
            except ValueError:
                data = {'error': 'Invalid JSON from support server'}
            
            return Response(data, status=resp.status_code)
            
        except ValueError as e:
            logger.error(f"Configuration error: {e}")
            return Response(
                {'error': str(e)},
                status=http_status.HTTP_503_SERVICE_UNAVAILABLE
            )
        except requests.RequestException as e:
            logger.error(f"Support server request failed: {e}")
            return Response(
                {'error': 'Support server unavailable', 'detail': str(e)},
                status=http_status.HTTP_502_BAD_GATEWAY
            )
        except Exception as e:
            logger.error(f"Unexpected error: {e}")
            return Response(
                {'error': 'Internal server error'},
                status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def _close_thread(self, request):
        """
        Close chat thread for current crew member.
        
        Proxies to: POST /api/v1/crew-chat-bridge/close_thread/
        """
        try:
            url = self._support_url('/api/v1/crew-chat-bridge/close_thread/')
            headers = self._support_headers()
            
            resp = requests.post(
                url,
                json={'crew_user_id': str(request.user.id)},
                headers=headers,
                timeout=10
            )
            
            # Forward response as-is
            try:
                data = resp.json() if resp.content else {}
            except ValueError:
                data = {'error': 'Invalid JSON from support server'}
            
            return Response(data, status=resp.status_code)
            
        except ValueError as e:
            logger.error(f"Configuration error: {e}")
            return Response(
                {'error': str(e)},
                status=http_status.HTTP_503_SERVICE_UNAVAILABLE
            )
        except requests.RequestException as e:
            logger.error(f"Support server request failed: {e}")
            return Response(
                {'error': 'Support server unavailable', 'detail': str(e)},
                status=http_status.HTTP_502_BAD_GATEWAY
            )
        except Exception as e:
            logger.error(f"Unexpected error: {e}")
            return Response(
                {'error': 'Internal server error'},
                status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
            )
