"""
Celery tasks for the detailer service.

Covers transactional email (Microsoft Graph), Redis stream events to the client app,
in-app notifications, WebSocket status updates, Expo push, and scheduled reminders.
"""
from django.core.mail import send_mail
from celery import shared_task
from django.conf import settings
from django.template.loader import render_to_string
from main.util.graph_mail import send_mail as graph_send_mail
from asgiref.sync import async_to_sync
from exponent_server_sdk import PushClient, PushMessage
import json
from uuid import UUID
from datetime import date, datetime, time
from decimal import Decimal
from main.utils.observability import new_request_id
from main.utils.redis_streams import stream_add, STREAM_JOB_EVENTS
import logging

_obs = logging.getLogger("main.observability")


def _stream_job_event(event, payload, request_id=None):
    """XADD a job_events entry with booking_reference and request_id on the stream."""
    body = dict(payload or {})
    rid = request_id or body.get("request_id") or new_request_id()
    body["request_id"] = rid
    ref = body.get("booking_reference") or ""
    msg_id = stream_add(
        STREAM_JOB_EVENTS,
        {
            "event": event,
            "payload": _json_dumps_safe(body),
            "booking_reference": str(ref),
            "request_id": rid,
        },
    )
    _obs.info(
        "redis_publish event=%s booking_reference=%s request_id=%s msg_id=%s",
        event,
        ref,
        rid,
        msg_id,
    )
    return msg_id


def _json_dumps_safe(obj):
    """
    JSON-encode structures that may contain non-JSON-native types.

    Handles UUID, date/datetime/time, and Decimal (from DRF serializer ``.data``).

    Args:
        obj: Serializable dict/list structure.

    Returns:
        str: JSON string safe for Redis stream payloads.
    """
    class Encoder(json.JSONEncoder):
        def default(self, o):
            """Serialize UUID, datetime, and Decimal for Redis stream JSON payloads."""
            if isinstance(o, UUID):
                return str(o)
            if isinstance(o, (datetime, date, time)):
                return o.isoformat()
            if isinstance(o, Decimal):
                return float(o)
            return super().default(o)
    return json.dumps(obj, cls=Encoder)


@shared_task
def send_welcome_email(user_email):
    """
    Send the post-registration welcome email to a new detailer.

    Args:
        user_email: Recipient address.

    Returns:
        str: Success or failure message for the Celery result backend.
    """
    subject = "Welcome to Prisma Car Care - Let's Get Started! 🎉"
    html_message = render_to_string('welcome_email.html')
    try:
        graph_send_mail(subject, html_message, user_email)
        return f"Welcome email sent successfully to {user_email}"
    except Exception as e:
        return f"Failed to send welcome email: {str(e)}"


@shared_task
def send_booking_confirmation_email(detailer_email, booking_reference, appointment_date, appointment_time, address, service_type_name, owner_note, total_amount):
    """
    Notify the assigned detailer of a new booking via email.

    Args:
        detailer_email: Recipient address.
        booking_reference: Client booking reference.
        appointment_date: Display date for the template.
        appointment_time: Display time for the template.
        address: Service location string.
        service_type_name: Human-readable service name.
        owner_note: Optional client note.
        total_amount: Formatted price string for the template.

    Returns:
        str: Success or failure message for the Celery result backend.
    """
    subject = "Booking Confirmation"
    html_message = render_to_string('booking_confirmation.html', {
        'booking_reference': booking_reference,
        'appointment_date': appointment_date,
        'appointment_time': appointment_time, 
        'address': address,
        'service_type_name': service_type_name,
        'owner_note': owner_note,
        'total_amount': total_amount})
    try:
        graph_send_mail(subject, html_message, detailer_email)
        return f"Booking confirmation email sent successfully to {detailer_email}"
    except Exception as e:
        return f"Failed to send booking confirmation email: {str(e)}"


@shared_task
def publish_job_acceptance(booking_reference, detailer_email_or_list, detailer_name=None, detailer_phone=None, detailer_rating=0.0, request_id=None):
    """
    Publish a job-assigned event to Redis for the client app.

    Called when a job is created on the detailer (no separate accept step).
    Supports two call styles:
    - New (single booking): ``publish_job_acceptance(booking_reference, detailers_list)``
      where ``detailers_list`` is ``[{"id", "name", "phone", "rating", "image"}, ...]``.
    - Legacy (bulk): second arg is email string with ``detailer_name``, ``detailer_phone``,
      ``detailer_rating`` for a single detailer payload without id/image.

    Args:
        booking_reference: Client booking reference.
        detailer_email_or_list: Legacy email string or list/dict of detailer payloads.
        detailer_name: Legacy bulk flow display name.
        detailer_phone: Legacy bulk flow phone.
        detailer_rating: Legacy bulk flow rating (float).

    Returns:
        str: Stream publish result or error message.
    """
    try:
        # Legacy bulk flow: second arg is email (string), then name, phone, rating
        if isinstance(detailer_email_or_list, str) and detailer_name is not None:
            detailers_payload = [{
                'id': None,
                'name': (detailer_name or '').strip(),
                'phone': (detailer_phone or '').strip(),
                'rating': float(detailer_rating or 0),
                'image': None,
            }]
        else:
            detailers_list = detailer_email_or_list
            if not detailers_list:
                return "No detailers to publish"
            if isinstance(detailers_list, dict):
                detailers_list = [detailers_list]
            detailers_payload = []
            for d in detailers_list:
                if isinstance(d, dict):
                    detailers_payload.append({
                        'id': d.get('id'),
                        'name': (d.get('name') or '').strip(),
                        'phone': (d.get('phone') or '').strip(),
                        'rating': float(d.get('rating', 0) or 0),
                        'image': d.get('image'),
                    })
        message_data = {
            'booking_reference': booking_reference,
            'detailers': detailers_payload,
        }
        # Back-compat: single detailer also exposed as top-level ``detailer`` key
        if len(detailers_payload) == 1:
            message_data['detailer'] = detailers_payload[0]
        msg_id = _stream_job_event("job_acceptance", message_data, request_id=request_id)
        return f"Job assigned event published to stream: {msg_id}"
    except Exception as e:
        return f"Failed to publish job assigned event to redis: {str(e)}"


@shared_task
def publish_job_reassigned(booking_reference, old_detailer_ids, new_detailers_payload, is_bulk=False):
    """
    Publish ``job_reassigned`` to Redis so the client app can swap assigned detailers.

    The client consumer applies ``new_detailers_payload`` via
    ``assign_detailers_to_booking`` without sending a customer-facing email or push.

    Args:
        booking_reference: Client booking reference.
        old_detailer_ids: UUIDs (or str) of detailers being removed.
        new_detailers_payload: List of detailer dicts (id, name, phone, rating, image).
        is_bulk: When True, flags bulk reassignment semantics on the client.

    Returns:
        str: Stream publish result or error message.
    """
    try:
        message_data = {
            'booking_reference': booking_reference,
            'old_detailer_ids': [str(d) for d in (old_detailer_ids or []) if d],
            'detailers': [
                {
                    'id': d.get('id'),
                    'name': (d.get('name') or '').strip(),
                    'phone': (d.get('phone') or '').strip(),
                    'rating': float(d.get('rating', 0) or 0),
                    'image': d.get('image'),
                }
                for d in (new_detailers_payload or [])
                if isinstance(d, dict)
            ],
            'is_bulk': bool(is_bulk),
        }
        msg_id = _stream_job_event("job_reassigned", message_data)
        return f"Job reassigned event published to stream: {msg_id}"
    except Exception as e:
        return f"Failed to publish job reassigned event: {str(e)}"


@shared_task
def publish_job_started(booking_reference, skip_client_notification=False):
    """
    Publish ``job_started`` to Redis with current before images from the detailer Job.

    Args:
        booking_reference: Client booking reference.
        skip_client_notification: When True (e.g. republish after uploading before photos),
            the client consumer should only sync ``BookedAppointmentImage`` rows and must not
            send a second "appointment started" push/notification.

    Returns:
        str: Stream publish result or error message.
    """
    try:
        from main.models import Job
        from main.util.media_helper import get_full_media_url
        
        try:
            job = Job.objects.get(booking_reference=booking_reference)
            
            before_images = []
            for img in job.images.filter(image_type='before'):
                if not img.image:
                    continue
                image_url = get_full_media_url(img.image.url)
                if not image_url or not str(image_url).strip():
                    continue
                before_images.append({
                    'image_url': str(image_url).strip(),
                    'uploaded_at': img.uploaded_at.isoformat(),
                    'segment': img.segment
                })
            
            message_data = {
                'booking_reference': booking_reference,
                'before_images': before_images,
            }
            if skip_client_notification:
                message_data['skip_client_notification'] = True
            
        except Job.DoesNotExist:
            # Backwards compatible: client still receives booking_reference only
            message_data = {
                'booking_reference': booking_reference,
                'before_images': [],
            }
            if skip_client_notification:
                message_data['skip_client_notification'] = True
        msg_id = _stream_job_event("job_started", message_data)
        return f"Job started published to stream: {msg_id}"
    except Exception as e:
        return f"Failed to publish job started to redis: {str(e)}"


@shared_task
def publish_job_completed(booking_reference, skip_client_notification=False):
    """
    Publish ``job_completed`` to Redis with after images and optional fleet maintenance.

    Args:
        booking_reference: Client booking reference.
        skip_client_notification: When True, client syncs images only—no completion push,
            fleet merge, or booking status change.

    Returns:
        str: Stream publish result or error message.
    """
    try:
        from main.models import Job
        from main.util.media_helper import get_full_media_url
        
        try:
            job = Job.objects.get(booking_reference=booking_reference)
            
            after_images = []
            for img in job.images.filter(image_type='after'):
                if not img.image:
                    continue
                image_url = get_full_media_url(img.image.url)
                if not image_url or not str(image_url).strip():
                    continue
                after_images.append({
                    'image_url': str(image_url).strip(),
                    'uploaded_at': img.uploaded_at.isoformat(),
                    'segment': img.segment
                })
            
            fleet_maintenance_data = None
            if not skip_client_notification and hasattr(job, 'fleet_maintenance') and job.fleet_maintenance:
                from main.serializer import JobFleetMaintenanceSerializer
                fleet_maintenance_data = JobFleetMaintenanceSerializer(job.fleet_maintenance).data
            
            message_data = {
                'booking_reference': booking_reference,
                'after_images': after_images,
                'fleet_maintenance': fleet_maintenance_data
            }
            if skip_client_notification:
                message_data['skip_client_notification'] = True
            
        except Job.DoesNotExist:
            message_data = {
                'booking_reference': booking_reference,
                'after_images': [],
                'fleet_maintenance': None
            }
            if skip_client_notification:
                message_data['skip_client_notification'] = True
        msg_id = _stream_job_event("job_completed", message_data)
        return f"Job completed published to stream: {msg_id}"
    except Exception as e:
        return f"Failed to publish job completed to redis: {str(e)}"


@shared_task
def send_appointment_cancellation_email(booking_reference, detailer_email, appointment_date, appointment_time):
    """
    Email the detailer that an appointment was cancelled.

    Args:
        booking_reference: Client booking reference.
        detailer_email: Recipient address.
        appointment_date: Original appointment date for the template.
        appointment_time: Original appointment time for the template.

    Returns:
        str: Success or failure message for the Celery result backend.
    """
    try:
        subject = "Appointment Cancellation"
        html_message = render_to_string('appointment_cancellation.html', {
            'booking_reference': booking_reference,
            'appointment_date': appointment_date,
            'appointment_time': appointment_time,
        })
        graph_send_mail(subject, html_message, detailer_email)
        return f"Appointment cancellation email sent successfully to {detailer_email}"
    except Exception as e:
        return f"Failed to send appointment cancellation email: {str(e)}"


@shared_task
def send_appointment_rescheduling_email(booking_reference, detailer_email, new_appointment_date, new_appointment_time, total_amount):
    """
    Email the detailer that an appointment was rescheduled.

    Args:
        booking_reference: Client booking reference.
        detailer_email: Recipient address.
        new_appointment_date: Updated date for the template.
        new_appointment_time: Updated time for the template.
        total_amount: Updated price string for the template.

    Returns:
        str: Success or failure message for the Celery result backend.
    """
    try:
        subject = "Appointment Rescheduling"
        html_message = render_to_string('appointment_rescheduling.html', {
            'booking_reference': booking_reference,
            'new_appointment_date': new_appointment_date,
            'new_appointment_time': new_appointment_time,
            'total_amount': total_amount,
        })
        graph_send_mail(subject, html_message, detailer_email)
        return f"Appointment rescheduling email sent successfully to {detailer_email}"
    except Exception as e:
        return f"Failed to send appointment rescheduling email: {str(e)}"


@shared_task
def send_websocket_notification(user_id, booking_reference, status, message):
    """
    Push a booking status update to the detailer's WebSocket group.

    Args:
        user_id: Detailer user id (channel group ``detailer_{user_id}``).
        booking_reference: Booking reference shown in the app.
        status: Status string for the client UI.
        message: Human-readable status message.

    Returns:
        bool: True on success, False on failure (exceptions are swallowed).
    """
    try:
        from channels.layers import get_channel_layer
        channel_layer = get_channel_layer()
        
        async_to_sync(channel_layer.group_send)(
            f"detailer_{user_id}",
            {
                'type': 'status_update',
                'booking_reference': booking_reference,
                'status': status,
                'message': message
            }
        )
    except Exception:
        return False
    return True


@shared_task
def create_notification(user_id, title, type, status, message):
    """
    Persist an in-app notification row for a detailer user.

    Args:
        user_id: Target :class:`main.models.User` primary key.
        title: Notification title.
        type: Notification category/type string.
        status: Status string stored on the model.
        message: Body text.

    Returns:
        bool: True when created, False when user missing or on error.
    """
    try:
        from main.models import Notification, User
        user = User.objects.get(id=user_id)
        Notification.objects.create(
            user=user,
            title=title,
            type=type,
            status=status,
            message=message
        )
        return True
    except Exception:
        return False


def _normalize_push_data(type_or_data, title, message):
    """
    Normalize Expo push ``data`` payload—all values must be strings.

    Args:
        type_or_data: Either a type string or a pre-built dict of stringifiable values.
        title: Default title when building from a type string.
        message: Default body when building from a type string.

    Returns:
        dict: String keys and string values for ``PushMessage.data``.
    """
    if isinstance(type_or_data, dict):
        return {str(k): "" if v is None else str(v) for k, v in type_or_data.items()}
    data = {"type": str(type_or_data)}
    data.setdefault("title", str(title))
    data.setdefault("body", str(message))
    return data


@shared_task
def send_push_notification(user_id, title, message, type):
    """
    Send an Expo push notification to a detailer user.

    Skips users without a token or with push disabled. Validates the Expo response
    when ``validate_response`` is available on the ticket.

    Args:
        user_id: Target user primary key.
        title: Push notification title.
        message: Push notification body.
        type: Type string or dict passed through :func:`_normalize_push_data`.

    Returns:
        str: Human-readable result for the Celery result backend.
    """
    try:
        from main.models import User
        user = User.objects.get(id=user_id)

        if not user.notification_token:
            return f"Push notification not sent: User {user_id} has no notification token"
        
        if not user.allow_push_notifications:
            return f"Push notification not sent: User {user_id} has disabled push notifications"
        
        push_data = _normalize_push_data(type, title, message)
        push_client = PushClient()
        response = push_client.publish(
            PushMessage(
                to=user.notification_token,
                title=title,
                body=message,
                data=push_data,
            )
        )

        if response is not None:
            validate = getattr(response, "validate_response", None)
            if callable(validate):
                validate()

        if response and hasattr(response, "data") and response.data:
            return f"Push notification sent successfully to user {user_id}"
        return f"Push notification failed for user {user_id}: Invalid response"
        
    except Exception as e:
        return f"Failed to send push notification to user {user_id}: {str(e)}"


@shared_task
def send_password_reset_email(user_email, user_name, reset_token):
    """
    Send a password reset link email with a one-hour expiry notice.

    Args:
        user_email: Recipient address.
        user_name: Display name for the template.
        reset_token: Opaque token appended to the web reset URL.

    Returns:
        str: Success or failure message for the Celery result backend.
    """
    subject = "Reset Your Prisma Car Care Password"
    
    base_url = getattr(settings, 'BASE_URL', 'https://yourdomain.com')
    web_reset_url = f"{base_url}/api/v1/auth/web-reset-password/?token={reset_token}"
    
    html_message = render_to_string('password_reset_email.html', {
        'user_name': user_name,
        'web_reset_url': web_reset_url,
        'expires_in': '1 hour'
    })
    
    try:
        graph_send_mail(subject, html_message, user_email)
        return f"Password reset email sent successfully to {user_email}"
    except Exception as e:
        return f"Failed to send password reset email: {str(e)}"


@shared_task
def check_daily_schedule():
    """
    Send a morning push summarizing today's accepted/in-progress jobs per detailer.

    Queries jobs for the current date grouped by ``primary_detailer`` and enqueues
    :func:`send_push_notification` for each detailer with at least one job.

    Returns:
        None: Side effects only (async push tasks).
    """
    from django.db import close_old_connections
    from main.models import Job
    from django.utils import timezone
    
    close_old_connections()
    
    today = timezone.now().date()
    
    detailers_with_jobs = Job.objects.filter(
        appointment_date__date=today,
        status__in=['accepted', 'in_progress'],
        primary_detailer__isnull=False
    ).values('primary_detailer').distinct()
    
    for detailer_data in detailers_with_jobs:
        detailer_id = detailer_data['primary_detailer']
        today_jobs = Job.objects.filter(
            primary_detailer_id=detailer_id,
            appointment_date__date=today,
            status__in=['accepted', 'in_progress']
        ).order_by('appointment_time')
        
        if today_jobs.exists():
            job_count = today_jobs.count()
            first_job = today_jobs.first()
            
            title = f"Daily Schedule - {job_count} Job{'s' if job_count > 1 else ''} Today"
            message = f"You have {job_count} job{'s' if job_count > 1 else ''} scheduled today. First appointment: {first_job.appointment_time.strftime('%H:%M')} - {first_job.service_type.name}"
            
            send_push_notification.delay(
                first_job.primary_detailer.user.id,
                title,
                message,
                "reminder"
            )


@shared_task
def check_upcoming_jobs():
    """
    Check for jobs starting soon and send reminders (25–35 minutes from now).

    **Disabled:** returns immediately without scheduling pushes. Re-enable by adding
    ``check-upcoming-jobs`` back to ``CELERY_BEAT_SCHEDULE`` in settings.

    Returns:
        str: Static message indicating the task is disabled.
    """
    return "check_upcoming_jobs is disabled"


@shared_task
def send_job_closing_notification(job_id):
    """
    Send a 15-minute-before-end reminder push for an in-progress job.

    Args:
        job_id: :class:`main.models.Job` primary key.

    Returns:
        str: Result message (skipped when job not in progress or not found).
    """
    try:
        from main.models import Job
        
        job = Job.objects.get(id=job_id)
        
        if job.status != 'in_progress':
            return f"Job {job.booking_reference} is no longer in progress"
        
        if job.primary_detailer:
            send_push_notification.delay(
                job.primary_detailer.user.id,
                "Job Closing Soon! 🚗",
                f"Your appointment with {job.client_name} ends in 15 minutes please remember to complete the job",
                "reminder"
            )
        return f"Closing notification sent for job {job.booking_reference}"
        
    except Job.DoesNotExist:
        return f"Job with ID {job_id} not found"
    except Exception as e:
        return f"Failed to send closing notification: {str(e)}"
