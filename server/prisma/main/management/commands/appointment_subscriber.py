"""
Long-running Redis consumer for client-originated job lifecycle events.

Subscribes to the shared ``job_events`` stream as ``detailer_group`` and updates
local ``Job`` records for cancellations, reschedules, and client reviews. Runs in
Docker as ``python manage.py appointment_subscriber``.
"""
from django.core.management.base import BaseCommand
import json
import time
from datetime import datetime

from django.utils import timezone

from main.tasks import (
    send_appointment_cancellation_email,
    send_appointment_rescheduling_email,
    send_push_notification,
)
from main.models import Job, Notification, Review
from main.utils.redis_streams import (
    STREAM_JOB_EVENTS,
    RedisStreamConsumer,
    ensure_consumer_group,
    get_redis,
)
from main.utils.reschedule_helper import get_detailer_for_reschedule
from main.utils.observability import log_timed, stream_lag_ms

DETAILER_GROUP = "detailer_group"
CONSUMER_NAME = "appointment_subscriber"
MAX_REVIEW_COMMENT_LEN = 1000
MAX_PROCESS_FAILURES = 5
PENDING_ALERT_THRESHOLD = 50


class Command(BaseCommand):
    """
    Consume ``job_events`` Redis stream messages aimed at the detailer service.

    Handles ``booking_cancelled``, ``booking_rescheduled``, and ``review_received``
    published by the client platform; other event types are acked and ignored.
    """

    help = "Read from Redis stream job_events (booking_cancelled, booking_rescheduled, review_received) and process messages."

    def connect_with_retry(self, max_retries=30, delay=10):
        """
        Block until Redis accepts a PING (container startup ordering).

        Args:
            max_retries: Maximum connection attempts before raising.
            delay: Seconds to sleep between retries.

        Returns:
            None

        Raises:
            Exception: Re-raises the last connection error after all retries fail.
        """
        for attempt in range(max_retries):
            try:
                r = get_redis(decode_responses=True)
                r.ping()
                self.stdout.write(self.style.SUCCESS(f"Connected to Redis on attempt {attempt + 1}"))
                return
            except Exception as e:
                if attempt < max_retries - 1:
                    self.stdout.write(
                        self.style.WARNING(f"Redis connection failed: {e}. Retrying in {delay}s... ({attempt + 1}/{max_retries})")
                    )
                    time.sleep(delay)
                else:
                    self.stdout.write(self.style.ERROR(f"Failed to connect after {max_retries} attempts: {e}"))
                    raise

    def handle(self, *args, **kwargs):
        """
        Main consumer loop: replay pending messages, then block-read new stream entries.

        Args:
            *args: Unused positional args from Django.
            **kwargs: Unused command options.

        Returns:
            None
        """
        self.connect_with_retry()
        ensure_consumer_group(STREAM_JOB_EVENTS, DETAILER_GROUP)
        self.stdout.write(self.style.SUCCESS("Subscribed to job_events stream (detailer_group)"))

        stream = RedisStreamConsumer(block_ms=5000)
        idle_loops = 0
        try:
            for msg_id, fields in stream.read_pending(STREAM_JOB_EVENTS, DETAILER_GROUP, CONSUMER_NAME):
                self._finish_message(stream, msg_id, fields)
            while True:
                entries = stream.read_group_blocking(
                    STREAM_JOB_EVENTS, DETAILER_GROUP, CONSUMER_NAME
                )
                if not entries:
                    idle_loops += 1
                    if idle_loops % 12 == 0:
                        pending = stream.pending_count(STREAM_JOB_EVENTS, DETAILER_GROUP)
                        if pending >= PENDING_ALERT_THRESHOLD:
                            self.stdout.write(
                                self.style.ERROR(
                                    f"ALERT: {pending} pending job_events in detailer_group "
                                    "(subscriber may be stuck)"
                                )
                            )
                    continue
                idle_loops = 0
                for msg_id, fields in entries:
                    self._finish_message(stream, msg_id, fields)
        except KeyboardInterrupt:
            self.stdout.write(self.style.SUCCESS("appointment_subscriber stopped"))
        finally:
            stream.close()

    def _finish_message(self, stream, msg_id, fields):
        """Process one entry; ACK only after success or a dead-letter drop."""
        for attempt in range(1, MAX_PROCESS_FAILURES + 1):
            if self._process_message(msg_id, fields):
                stream.ack(STREAM_JOB_EVENTS, DETAILER_GROUP, msg_id)
                return
            self.stdout.write(self.style.WARNING(f"Retry {attempt}/{MAX_PROCESS_FAILURES} for {msg_id}"))
        self.stdout.write(self.style.ERROR(f"Dead-letter ACK for {msg_id} after {MAX_PROCESS_FAILURES} failures"))
        stream.ack(STREAM_JOB_EVENTS, DETAILER_GROUP, msg_id)

    def _process_message(self, msg_id, fields):
        """
        Parse one stream message, update ``Job`` / ``Review``, notify detailers, then ack.

        Args:
            msg_id: Redis stream message id (for ``ack``).
            fields: Dict with ``event`` and JSON ``payload`` from the client service.

        Returns:
            bool: True when the message is done (ACK).
        """
        started = time.monotonic()
        event = fields.get("event")
        raw = fields.get("payload", "{}")
        request_id = fields.get("request_id")
        booking_reference = fields.get("booking_reference") or ""
        ok = False
        try:
            result = self._dispatch_job_event(msg_id, fields, event, raw)
            ok = bool(result)
            return result
        finally:
            if not request_id or not booking_reference:
                try:
                    payload = json.loads(raw) if raw else {}
                    if isinstance(payload, dict):
                        request_id = request_id or payload.get("request_id")
                        booking_reference = booking_reference or payload.get("booking_reference") or ""
                except Exception:
                    pass
            log_timed(
                "appointment_subscriber.process",
                started,
                event=event,
                booking_reference=booking_reference,
                request_id=request_id,
                consumer_lag_ms=stream_lag_ms(msg_id),
                ok=ok,
            )

    def _dispatch_job_event(self, msg_id, fields, event, raw):
        """Apply one detailer-facing job_events payload. Returns True to ACK."""
        # Redis: only handle detailer-facing events; ack and drop the rest
        if event not in ("booking_cancelled", "booking_rescheduled", "review_received"):
            return True
        try:
            data = json.loads(raw)
            if isinstance(data, dict):
                booking_reference = data.get("booking_reference", data)
                new_appointment_date = data.get("new_appointment_date", "")
                new_appointment_time = data.get("new_appointment_time", "")
                total_amount = data.get("total_amount", 0)
                try:
                    rating = int(data.get("rating", 0))
                except (TypeError, ValueError):
                    rating = 0
                cr = data.get("comment")
                if cr is None or not str(cr).strip():
                    review_comment = None
                else:
                    review_comment = str(cr).strip()[:MAX_REVIEW_COMMENT_LEN]
            else:
                booking_reference = str(data).strip().strip('"').strip("'")
                new_appointment_date = new_appointment_time = ""
                total_amount = rating = 0
                review_comment = None
        except Exception:
            booking_reference = str(raw).strip().strip('"').strip("'")
            new_appointment_date = new_appointment_time = ""
            total_amount = rating = 0
            review_comment = None

        self.stdout.write(
            f"Received {event}: {booking_reference}"
            + (f" (rating={rating})" if event == "review_received" else "")
        )

        try:
            job = Job.objects.select_related("primary_detailer", "service_type").prefetch_related("detailers").get(booking_reference=booking_reference)
            primary = getattr(job, "primary_detailer", None)

            if event == "booking_cancelled":
                # Job status: any → cancelled (client-initiated cancel)
                job.status = "cancelled"
                job.save()
                # Notify all assigned detailers (express = 2, standard = 1); fallback to primary if no M2M
                detailers_to_notify = list(job.detailers.all())
                if not detailers_to_notify and primary:
                    detailers_to_notify = [primary]
                if not detailers_to_notify:
                    self.stdout.write(self.style.WARNING(f"Job {booking_reference} has no detailers to notify, skipping"))
                    return True
                for detailer in detailers_to_notify:
                    if not detailer or not getattr(detailer, "user", None):
                        continue
                    if detailer.user.allow_email_notifications:
                        send_appointment_cancellation_email(
                            booking_reference,
                            detailer.user.email,
                            job.appointment_date,
                            job.appointment_time,
                        )
                    if detailer.user.allow_push_notifications and detailer.user.notification_token:
                        send_push_notification(
                            detailer.user.id,
                            "Appointment Cancelled",
                            "Your appointment has been cancelled",
                            "booking_cancelled",
                        )
                    self.create_notification(
                        detailer.user,
                        "Appointment Cancelled",
                        "booking_cancelled",
                        "error",
                        "Your appointment has been cancelled",
                    )

            elif event == "booking_rescheduled":
                detailer, target_date, appointment_time, err = get_detailer_for_reschedule(
                    job, new_appointment_date, new_appointment_time
                )
                if err or not detailer:
                    self.stdout.write(
                        self.style.WARNING(f"Reschedule {booking_reference}: {err or 'no detailer'}; job unchanged")
                    )
                    return True
                old_primary = primary
                # Job status/assignment: reschedule → accepted with new primary and slot
                job.primary_detailer = detailer
                job.appointment_date = timezone.make_aware(
                    datetime.combine(target_date, appointment_time),
                    timezone.get_current_timezone(),
                )
                job.appointment_time = appointment_time
                job.total_amount = total_amount
                job.status = "accepted"
                job.save()
                job.detailers.set([detailer])
                if detailer.user.allow_email_notifications:
                    send_appointment_rescheduling_email(
                        booking_reference,
                        detailer.user.email,
                        target_date.isoformat(),
                        appointment_time.strftime("%H:%M"),
                        total_amount,
                    )
                if detailer.user.allow_push_notifications and detailer.user.notification_token:
                    send_push_notification(
                        detailer.user.id,
                        "Appointment Rescheduled",
                        "Your appointment has been rescheduled",
                        "booking_rescheduled",
                    )
                self.create_notification(
                    detailer.user,
                    "Appointment Rescheduled",
                    "booking_rescheduled",
                    "warning",
                    "Your appointment has been rescheduled",
                )
                if old_primary and old_primary.pk != detailer.pk:
                    self.create_notification(
                        old_primary.user,
                        "Appointment Reassigned",
                        "booking_rescheduled",
                        "warning",
                        "Your appointment was rescheduled and reassigned to another detailer.",
                    )

            elif event == "review_received":
                if not primary:
                    self.stdout.write(self.style.WARNING(f"Job {booking_reference} has no primary_detailer, skipping"))
                    return True
                Review.objects.update_or_create(
                    job=job,
                    defaults={
                        "detailer": primary,
                        "rating": rating,
                        "comment": review_comment,
                    },
                )
                self.stdout.write(self.style.SUCCESS(f"Review saved for job {booking_reference} (rating={rating})"))
                notification_message = f"You have received a {rating} star review"
                if review_comment:
                    snippet = review_comment[:120] + ("…" if len(review_comment) > 120 else "")
                    notification_message = f'{notification_message}. "{snippet}"'
                self.create_notification(
                    primary.user,
                    "Review Received",
                    "review_received",
                    "success",
                    notification_message,
                )
                if primary.user.allow_push_notifications and primary.user.notification_token:
                    send_push_notification(
                        primary.user.id,
                        "Review Received",
                        notification_message,
                        "review_received",
                    )
                primary.update_rating_from_reviews()
                primary.check_for_deactivation()
                self.stdout.write(self.style.SUCCESS(f"Detailer {primary.id} updated; notification sent."))

            return True
        except Job.DoesNotExist:
            self.stdout.write(self.style.ERROR(f"Job not found: {booking_reference} (review will not appear on detailer)"))
            return True
        except Exception as e:
            import traceback
            self.stdout.write(self.style.ERROR(f"Error processing message: {str(e)}"))
            self.stdout.write(traceback.format_exc())
            return False

    def create_notification(self, user, title, type, status, message):
        """
        Persist an in-app ``Notification`` for the given detailer user.

        Args:
            user: ``User`` to attach the notification to.
            title: Short notification title.
            type: ``Notification.type`` choice (e.g. ``booking_cancelled``).
            status: ``Notification.status`` choice (success, warning, error, info).
            message: Body text shown in the app.

        Returns:
            bool: True if created, False on failure.
        """
        try:
            Notification.objects.create(user=user, title=title, type=type, status=status, message=message)
            self.stdout.write(f"Notification created for user {user.id}")
            return True
        except Exception as e:
            self.stderr.write(f"Failed to create notification: {e}")
            return False
