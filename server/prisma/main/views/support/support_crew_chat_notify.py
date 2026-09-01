"""
Internal endpoint: support server notifies a crew member of a new support chat message.

Called by the support server with ``X-Support-Internal-Key``. Queues in-app
notification and Expo push when the crew member has push enabled.
"""
import logging

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from main.models import User
from main.tasks import create_notification, send_push_notification
from main.views.support.support_permission_access import SupportPermissionAccess

logger = logging.getLogger(__name__)

MESSAGE_PREVIEW_LIMIT = 120


class SupportCrewChatNotifyView(APIView):
    """POST notify crew of a new support chat message."""

    permission_classes = [SupportPermissionAccess]

    def post(self, request, *args, **kwargs):
        crew_user_id = request.data.get("crew_user_id")
        thread_id = request.data.get("thread_id")
        body = (request.data.get("body") or "").strip()
        sender_name = (request.data.get("sender_name") or "Support").strip()

        if not crew_user_id or not thread_id or not body:
            return Response(
                {"error": "crew_user_id, thread_id, and body are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = User.objects.get(id=crew_user_id)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        preview = (
            body
            if len(body) <= MESSAGE_PREVIEW_LIMIT
            else f"{body[: MESSAGE_PREVIEW_LIMIT - 3]}..."
        )
        title = "New message from support"
        message = f"{sender_name}: {preview}"

        create_notification.delay(
            user.id,
            title,
            "crew_chat",
            "info",
            message,
        )

        push_sent = False
        if user.allow_push_notifications and user.notification_token:
            send_push_notification.delay(
                user.id,
                title,
                message,
                {
                    "type": "crew_chat",
                    "thread_id": str(thread_id),
                    "title": title,
                    "body": message,
                },
            )
            push_sent = True

        logger.info(
            "Crew chat notify queued for user=%s thread=%s push=%s",
            crew_user_id,
            thread_id,
            push_sent,
        )

        return Response({"data": {"notified": True, "push_queued": push_sent}})
