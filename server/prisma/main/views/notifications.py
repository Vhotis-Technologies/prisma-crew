"""
In-app notifications and Expo push token storage for detailers.

**Auth:** ``IsAuthenticated`` — all actions scoped to ``request.user``.

**GET actions:** ``get_notifications``.

**PATCH actions:** ``mark_notification_as_read``, ``mark_all_notifications_as_read``,
``save_notification_token``.

**DELETE actions:** ``delete_notification``.
"""
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from main.models import Notification


class NotificationsView(APIView):
    """
    Action-routed notification inbox for the detailer mobile app.
    """

    permission_classes = [IsAuthenticated]

    action_handlers = {
        'get_notifications': '_get_notifications',
        'mark_notification_as_read': '_mark_notification_as_read',
        'mark_all_notifications_as_read': '_mark_all_notifications_as_read',
        'delete_notification': '_delete_notification',
        'save_notification_token': '_save_notification_token',
    }

    def get(self, request, *args, **kwargs):
        """
        Route GET ``action`` to the matching handler.

        Returns:
            Handler ``Response`` or 400 for unknown actions.
        """
        action = kwargs.get('action')
        if action not in self.action_handlers:
            return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)
        handler = getattr(self, self.action_handlers[action])
        return handler(request)

    def patch(self, request, *args, **kwargs):
        """
        Route PATCH ``action`` (mark read, save token).

        Returns:
            Handler ``Response`` or 400 for unknown actions.
        """
        action = kwargs.get('action')
        if action not in self.action_handlers:
            return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)
        handler = getattr(self, self.action_handlers[action])
        return handler(request)

    def delete(self, request, *args, **kwargs):
        """
        Route DELETE ``action`` (delete one notification).

        Returns:
            Handler ``Response`` or 400 for unknown actions.
        """
        action = kwargs.get('action')
        if action not in self.action_handlers:
            return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)
        handler = getattr(self, self.action_handlers[action])
        return handler(request)

    def _get_notifications(self, request):
        """
        List all notifications for the authenticated user.

        Args:
            request: Authenticated DRF request.

        Returns:
            JSON array of notification objects (id, title, message, type, status, timestamp, is_read).
        """
        try:
            notifications = Notification.objects.filter(user=request.user)
            notifications_data = []

            for notification in notifications:
                notifications_data.append({
                    'id': notification.id,
                    'title': notification.title,
                    'message': notification.message,
                    'type': notification.type,
                    'status': notification.status,
                    'timestamp': notification.timestamp,
                    'is_read': notification.is_read,
                })
            return Response(notifications_data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _mark_notification_as_read(self, request):
        """
        Mark a single notification as read.

        Args:
            request: Body ``id`` — notification primary key.

        Returns:
            ``{'success': True}`` or 500 on error.
        """
        try:
            notification_id = request.data.get('id')
            notification = Notification.objects.get(id=notification_id, user=request.user)
            notification.is_read = True
            notification.save()
            return Response({'success': True}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _mark_all_notifications_as_read(self, request):
        """
        Bulk-mark notifications as read for ids owned by the user.

        Args:
            request: Body ``ids`` — list of notification ids (optional; empty = no-op success).

        Returns:
            ``{'success': True}`` or 500 on error.
        """
        try:
            notification_ids = request.data.get('ids', [])

            if not notification_ids:
                return Response({'success': True}, status=status.HTTP_200_OK)

            Notification.objects.filter(
                id__in=notification_ids,
                user=request.user,
                is_read=False
            ).update(is_read=True)

            return Response({'success': True}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _delete_notification(self, request):
        """
        Delete one notification belonging to the authenticated user.

        Args:
            request: Body ``id`` — notification primary key.

        Returns:
            ``{'success': True}`` or 500 on error.
        """
        try:
            notification = Notification.objects.get(id=request.data['id'], user=request.user)
            notification.delete()
            return Response({'success': True}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _save_notification_token(self, request):
        """
        Persist Expo push token on the user record.

        Args:
            request: Body ``token`` — device push token string.

        Returns:
            ``{'success': True}`` or 500 on error.
        """
        try:
            token = request.data.get('token')
            request.user.notification_token = token
            request.user.save()
            return Response({'success': True}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
