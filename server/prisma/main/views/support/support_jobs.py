"""Support-driven crew reassignment for jobs (single appointments and bulk orders).

**Auth:** :class:`SupportPermissionAccess` — the support server proxies requests with the shared
``X-Support-Internal-Key`` header. Mobile clients never hit these endpoints directly.

**Endpoints (under** ``/api/v1/support/jobs/`` **):**

* ``GET get_available_detailers`` — replacements that are free for a job's full duration. Excludes
  the currently assigned crew. For bulk references (no ``-N`` suffix) we aggregate across all
  child jobs and return detailers with enough free capacity to cover the whole window.
* ``POST reassign`` — swap the entire crew for a job (or for every job in a bulk reference).
  Atomic; validates the new team is mutually free; sends standard assignment notifications to the
  new crew only; writes a :class:`JobReassignmentAudit` row; publishes ``job_reassigned``.
* ``GET get_reassignment_history`` — chronological audit list for a booking reference.

**Eligibility:** jobs in ``in_progress``, ``completed`` or ``cancelled`` cannot be reassigned —
matches the same guard that ``support_bookings`` already uses on the client side.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, time
from typing import List, Tuple

from django.db import transaction
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from main.models import Availability, Detailer, Job, JobReassignmentAudit
from main.tasks import (
    create_notification,
    publish_job_acceptance,
    publish_job_reassigned,
    send_booking_confirmation_email,
    send_push_notification,
)
from main.util.media_helper import get_full_media_url
from main.utils.detailer_matcher import find_detailers_for_location
from main.views.support.support_permission_access import SupportPermissionAccess

logger = logging.getLogger(__name__)

BLOCKED_JOB_STATUSES = ('in_progress', 'completed', 'cancelled')
TRAVEL_BUFFER_MINUTES = 30


def _detailer_image_url(detailer: Detailer):
    user = detailer.user
    if user and user.image:
        try:
            return get_full_media_url(user.image.url)
        except Exception:
            return None
    return None


def _serialize_detailer(detailer: Detailer) -> dict:
    user = detailer.user
    return {
        'id': str(detailer.id),
        'name': user.get_full_name() if user else 'Detailer',
        'phone': (user.phone if user else '') or '',
        'email': (user.email if user else '') or '',
        'rating': float(detailer.rating or 0),
        'image': _detailer_image_url(detailer),
    }


def _minutes(t: time) -> int:
    return t.hour * 60 + t.minute


def _is_bulk_sub(ref: str) -> bool:
    return bool(ref) and '-' in ref and ref.split('-')[-1].isdigit()


def _job_window_minutes(job: Job) -> Tuple[int, int]:
    """End-inclusive (start_min, end_min) for the job, with travel buffer for non-bulk jobs."""
    start_min = _minutes(job.appointment_time)
    duration = int(getattr(job.service_type, 'duration', 60) or 60)
    buffer_after = 0 if _is_bulk_sub(job.booking_reference) else TRAVEL_BUFFER_MINUTES
    end_min = start_min + duration + buffer_after
    return start_min, end_min


def _detailer_has_conflict(detailer: Detailer, appointment_date, start_min: int, end_min: int) -> bool:
    """True if detailer has any other accepted/in_progress/pending job overlapping [start, end)."""
    other_jobs = Job.objects.filter(
        primary_detailer=detailer,
        appointment_date__date=appointment_date,
        status__in=['pending', 'accepted', 'in_progress'],
    ).select_related('service_type')
    for other in other_jobs:
        o_start, o_end = _job_window_minutes(other)
        if start_min < o_end and end_min > o_start:
            return True
    unavail = Availability.objects.filter(detailer=detailer, date=appointment_date)
    for u in unavail:
        u_start = _minutes(u.start_time)
        u_end = _minutes(u.end_time)
        if start_min < u_end and end_min > u_start:
            return True
    return False


def _bulk_jobs_for_reference(booking_reference: str) -> List[Job]:
    base = booking_reference.rstrip('-')
    return list(
        Job.objects.filter(booking_reference__startswith=f"{base}-")
        .select_related('primary_detailer', 'service_type')
        .prefetch_related('detailers__user')
        .order_by('appointment_date', 'appointment_time', 'booking_reference')
    )


def _format_appointment_email_strings(job: Job):
    appointment_dt = job.appointment_date
    appt_time = job.appointment_time
    formatted_date = appointment_dt.strftime('%b. %d, %Y, %I %p').replace(' 0', ' ').lower()
    formatted_time = appt_time.strftime('%I %p').replace(' 0', ' ').lower()
    return formatted_date, formatted_time

# The method is used to send the booking confirmation email and push notification to the new assignee
def _notify_new_assignee(job: Job, detailer: Detailer):
    """Mirror the assign-time notifications sent from BookingView._create_booking."""
    user = detailer.user
    if not user:
        return
    formatted_date, formatted_time = _format_appointment_email_strings(job)
    if user.allow_email_notifications and user.email:
        send_booking_confirmation_email.delay(
            user.email,
            job.booking_reference,
            formatted_date,
            formatted_time,
            job.address,
            job.service_type.name,
            job.owner_note,
            f"{(job.total_amount or 0):.2f}",
        )
    create_notification.delay(
        user.id,
        'New Appointment',
        'assigned',
        'success',
        'You have been assigned an appointment.',
    )
    if user.allow_push_notifications and user.notification_token:
        send_push_notification.delay(
            user.id,
            'New Appointment',
            f"You have been assigned an appointment: {job.appointment_time.strftime('%H:%M')} at {job.post_code}",
            'booking_created',
        )


def _detailer_payload_from(detailer: Detailer) -> dict:
    user = detailer.user
    return {
        'id': str(detailer.id),
        'name': user.get_full_name() if user else '',
        'phone': (user.phone if user else '') or '',
        'rating': float(detailer.rating or 0),
        'image': _detailer_image_url(detailer),
    }


def _candidates_for_single_job(job: Job) -> List[dict]:
    """Detailers free for the job's date and slot, excluding the current crew."""
    excluded = {d.id for d in job.detailers.all()}
    if job.primary_detailer_id:
        excluded.add(job.primary_detailer_id)
    available, _ = find_detailers_for_location(
        country=job.country or '',
        city=job.city or '',
        latitude=job.latitude,
        longitude=job.longitude,
        is_available=True,
    )
    candidates = []
    appointment_date = job.appointment_date.date() if hasattr(job.appointment_date, 'date') else job.appointment_date
    start_min, end_min = _job_window_minutes(job)
    for detailer in available:
        if detailer.id in excluded:
            continue
        if _detailer_has_conflict(detailer, appointment_date, start_min, end_min):
            continue
        candidates.append(_serialize_detailer(detailer))
    candidates.sort(key=lambda d: (-d['rating'], d['name']))
    return candidates


def _bulk_envelope_minutes(jobs: List[Job]) -> Tuple[int, int, int]:
    """Returns (envelope_start_min, envelope_end_min, total_slot_minutes) across all bulk jobs."""
    starts = []
    ends = []
    total = 0
    for j in jobs:
        s, e = _job_window_minutes(j)
        starts.append(s)
        ends.append(e)
        total += int(getattr(j.service_type, 'duration', 60) or 60)
    if not starts:
        return 0, 0, 0
    return min(starts), max(ends), total


def _candidates_for_bulk(jobs: List[Job]) -> List[dict]:
    """Detailers with no overlapping job/unavailability inside the bulk envelope, excluding current crew."""
    if not jobs:
        return []
    head = jobs[0]
    excluded = set()
    for j in jobs:
        if j.primary_detailer_id:
            excluded.add(j.primary_detailer_id)
        for d in j.detailers.all():
            excluded.add(d.id)
    available, _ = find_detailers_for_location(
        country=head.country or '',
        city=head.city or '',
        latitude=head.latitude,
        longitude=head.longitude,
        is_available=True,
    )
    appointment_date = head.appointment_date.date() if hasattr(head.appointment_date, 'date') else head.appointment_date
    env_start, env_end, _total = _bulk_envelope_minutes(jobs)
    candidates = []
    for detailer in available:
        if detailer.id in excluded:
            continue
        if _detailer_has_conflict(detailer, appointment_date, env_start, env_end):
            continue
        candidates.append(_serialize_detailer(detailer))
    candidates.sort(key=lambda d: (-d['rating'], d['name']))
    return candidates


def _validate_new_team_for_single(
    job: Job,
    new_detailers: List[Detailer],
    required: int,
) -> Tuple[bool, str]:
    if len(new_detailers) != required:
        label = 'two detailers' if required == 2 else 'one detailer'
        return False, f"Express jobs require exactly {label}." if required == 2 else f"Standard jobs require {label}."
    appointment_date = job.appointment_date.date() if hasattr(job.appointment_date, 'date') else job.appointment_date
    start_min, end_min = _job_window_minutes(job)
    for detailer in new_detailers:
        if not detailer.is_active or not detailer.is_available:
            return False, f"{detailer.user.get_full_name() if detailer.user else 'Detailer'} is not available."
        if _detailer_has_conflict(detailer, appointment_date, start_min, end_min):
            return False, f"{detailer.user.get_full_name() if detailer.user else 'Detailer'} is no longer free for this slot."
    return True, ''


def _validate_new_team_for_bulk(
    jobs: List[Job],
    new_detailers: List[Detailer],
) -> Tuple[bool, str]:
    if len(new_detailers) < 1:
        return False, 'Pick at least one replacement detailer.'
    appointment_date = jobs[0].appointment_date.date() if hasattr(jobs[0].appointment_date, 'date') else jobs[0].appointment_date
    env_start, env_end, _ = _bulk_envelope_minutes(jobs)
    for detailer in new_detailers:
        if not detailer.is_active or not detailer.is_available:
            return False, f"{detailer.user.get_full_name() if detailer.user else 'Detailer'} is not available."
        if _detailer_has_conflict(detailer, appointment_date, env_start, env_end):
            return False, f"{detailer.user.get_full_name() if detailer.user else 'Detailer'} is busy during the bulk window."
    by_index = [list(new_detailers) for _ in jobs]
    used_per_detailer: dict = {d.id: [] for d in new_detailers}
    for idx, job in enumerate(jobs):
        s, e = _job_window_minutes(job)
        chosen = None
        for detailer in by_index[idx]:
            overlap = False
            for prev_s, prev_e in used_per_detailer[detailer.id]:
                if s < prev_e and e > prev_s:
                    overlap = True
                    break
            if not overlap:
                chosen = detailer
                break
        if not chosen:
            return False, 'Selected team cannot cover all bulk vehicles without overlap. Pick more detailers or different ones.'
        used_per_detailer[chosen.id].append((s, e))
    return True, ''


def _assign_team_to_bulk(jobs: List[Job], new_detailers: List[Detailer]):
    """Distribute bulk jobs across new team in time order, never giving a detailer overlapping work."""
    used_per_detailer: dict = {d.id: [] for d in new_detailers}
    for job in jobs:
        s, e = _job_window_minutes(job)
        chosen = None
        for detailer in new_detailers:
            overlap = False
            for prev_s, prev_e in used_per_detailer[detailer.id]:
                if s < prev_e and e > prev_s:
                    overlap = True
                    break
            if not overlap:
                chosen = detailer
                break
        if chosen is None:
            chosen = new_detailers[0]
        used_per_detailer[chosen.id].append((s, e))
        job.primary_detailer = chosen
        job.save(update_fields=['primary_detailer'])
        job.detailers.set([chosen])


def _parse_uuid_list(raw) -> Tuple[List[uuid.UUID], str]:
    if not isinstance(raw, list) or not raw:
        return [], 'new_detailer_ids is required.'
    out = []
    for item in raw:
        try:
            out.append(uuid.UUID(str(item)))
        except (ValueError, TypeError):
            return [], f"Invalid detailer id: {item}"
    return out, ''


class SupportJobsView(APIView):
    """Read-only candidate queries (GET) and reassignment mutations (POST) for support staff."""

    authentication_classes = ()
    permission_classes = [SupportPermissionAccess]

    get_action_handler = {
        'get_available_detailers': '_get_available_detailers',
        'get_reassignment_history': '_get_reassignment_history',
    }
    post_action_handler = {
        'reassign': '_post_reassign',
    }

    def get(self, request, *args, **kwargs):
        action = kwargs.get('action')
        if action not in self.get_action_handler:
            return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)
        return getattr(self, self.get_action_handler[action])(request)

    def post(self, request, *args, **kwargs):
        action = kwargs.get('action')
        if action not in self.post_action_handler:
            return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)
        return getattr(self, self.post_action_handler[action])(request)

    def _get_available_detailers(self, request):
        booking_reference = (request.query_params.get('booking_reference') or '').strip()
        is_bulk = (request.query_params.get('bulk') or '').strip().lower() == 'true'
        if not booking_reference:
            return Response({'error': 'booking_reference is required'}, status=status.HTTP_400_BAD_REQUEST)

        if is_bulk:
            jobs = _bulk_jobs_for_reference(booking_reference)
            if not jobs:
                return Response({'error': 'No jobs found for this bulk reference'}, status=status.HTTP_404_NOT_FOUND)
            blocked = [j for j in jobs if j.status in BLOCKED_JOB_STATUSES]
            if blocked:
                return Response(
                    {'error': 'One or more jobs in this bulk are already in progress, completed, or cancelled.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            current = []
            for j in jobs:
                if j.primary_detailer_id:
                    current.append(str(j.primary_detailer_id))
            current = list(dict.fromkeys(current))
            candidates = _candidates_for_bulk(jobs)
            return Response(
                {
                    'data': {
                        'booking_reference': booking_reference,
                        'is_bulk': True,
                        'is_express': False,
                        'job_count': len(jobs),
                        'required_count': max(1, len(current)),
                        'current_detailer_ids': current,
                        'candidates': candidates,
                    }
                },
                status=status.HTTP_200_OK,
            )

        try:
            job = (
                Job.objects.select_related('service_type', 'primary_detailer__user')
                .prefetch_related('detailers__user')
                .get(booking_reference=booking_reference)
            )
        except Job.DoesNotExist:
            return Response({'error': 'Job not found'}, status=status.HTTP_404_NOT_FOUND)

        if job.status in BLOCKED_JOB_STATUSES:
            return Response(
                {'error': f"Job is {job.status} and cannot be reassigned."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        is_express = job.detailers.count() >= 2
        required = 2 if is_express else 1
        current = [str(d.id) for d in job.detailers.all()]
        if not current and job.primary_detailer_id:
            current = [str(job.primary_detailer_id)]
        candidates = _candidates_for_single_job(job)
        return Response(
            {
                'data': {
                    'booking_reference': booking_reference,
                    'is_bulk': False,
                    'is_express': is_express,
                    'job_count': 1,
                    'required_count': required,
                    'current_detailer_ids': current,
                    'candidates': candidates,
                }
            },
            status=status.HTTP_200_OK,
        )

    def _post_reassign(self, request):
        data = request.data if hasattr(request.data, 'get') else {}
        booking_reference = (data.get('booking_reference') or '').strip()
        is_bulk = bool(data.get('is_bulk'))
        new_ids_raw = data.get('new_detailer_ids') or []
        reason_code = (data.get('reason_code') or 'other').strip().lower()
        valid_reasons = {choice[0] for choice in JobReassignmentAudit.REASON_CHOICES}
        if reason_code not in valid_reasons:
            reason_code = 'other'
        reason_notes = (data.get('reason_notes') or '').strip()
        support_user_id = (data.get('support_user_id') or '').strip()
        support_user_email = (data.get('support_user_email') or '').strip()

        if not booking_reference:
            return Response({'error': 'booking_reference is required'}, status=status.HTTP_400_BAD_REQUEST)

        new_ids, err = _parse_uuid_list(new_ids_raw)
        if err:
            return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)

        if is_bulk:
            return self._reassign_bulk(
                booking_reference, new_ids, reason_code, reason_notes,
                support_user_id, support_user_email,
            )
        return self._reassign_single(
            booking_reference, new_ids, reason_code, reason_notes,
            support_user_id, support_user_email,
        )

    def _reassign_single(self, booking_reference, new_ids, reason_code, reason_notes,
                         support_user_id, support_user_email):
        try:
            with transaction.atomic():
                job = (
                    Job.objects.select_for_update()
                    .select_related('service_type', 'primary_detailer__user')
                    .prefetch_related('detailers__user')
                    .get(booking_reference=booking_reference)
                )

                if job.status in BLOCKED_JOB_STATUSES:
                    return Response(
                        {'error': f"Job is {job.status} and cannot be reassigned."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                old_detailer_ids = [str(d.id) for d in job.detailers.all()]
                if not old_detailer_ids and job.primary_detailer_id:
                    old_detailer_ids = [str(job.primary_detailer_id)]
                is_express = len(old_detailer_ids) >= 2 if old_detailer_ids else False
                required = 2 if is_express else 1

                if any(str(uid) in old_detailer_ids for uid in new_ids):
                    return Response(
                        {'error': 'Replacement crew cannot include detailers already on this job.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                new_detailers = list(
                    Detailer.objects.select_related('user').filter(id__in=new_ids)
                )
                if len(new_detailers) != len(new_ids):
                    return Response({'error': 'One or more selected detailers not found.'}, status=status.HTTP_400_BAD_REQUEST)
                ordered = []
                ids_seen = set()
                by_id = {d.id: d for d in new_detailers}
                for uid in new_ids:
                    if uid in by_id and uid not in ids_seen:
                        ordered.append(by_id[uid])
                        ids_seen.add(uid)
                new_detailers = ordered

                ok, err = _validate_new_team_for_single(job, new_detailers, required)
                if not ok:
                    return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)

                previous_status = job.status
                job.primary_detailer = new_detailers[0]
                job.save(update_fields=['primary_detailer'])
                job.detailers.set(new_detailers)

                assigned_payload = [_detailer_payload_from(d) for d in new_detailers]

                JobReassignmentAudit.objects.create(
                    booking_reference=booking_reference,
                    is_bulk=False,
                    is_express=is_express,
                    job_count=1,
                    old_detailer_ids=old_detailer_ids,
                    new_detailer_ids=[str(d.id) for d in new_detailers],
                    reason_code=reason_code,
                    reason_notes=reason_notes,
                    support_user_id=support_user_id,
                    support_user_email=support_user_email,
                    previous_status=previous_status,
                )
        except Job.DoesNotExist:
            return Response({'error': 'Job not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as exc:
            logger.exception('Single reassignment failed for %s', booking_reference)
            return Response({'error': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        for detailer in new_detailers:
            try:
                _notify_new_assignee(job, detailer)
            except Exception as exc:
                logger.warning('Notify new assignee failed for %s: %s', detailer.id, exc)

        try:
            publish_job_acceptance.delay(job.booking_reference, assigned_payload)
        except Exception as exc:
            logger.warning('publish_job_acceptance after reassignment failed: %s', exc)
        try:
            publish_job_reassigned.delay(job.booking_reference, old_detailer_ids, assigned_payload, False)
        except Exception as exc:
            logger.warning('publish_job_reassigned failed: %s', exc)

        return Response(
            {
                'data': {
                    'booking_reference': booking_reference,
                    'is_bulk': False,
                    'is_express': is_express,
                    'old_detailer_ids': old_detailer_ids,
                    'assigned_detailers': assigned_payload,
                }
            },
            status=status.HTTP_200_OK,
        )

    def _reassign_bulk(self, booking_reference, new_ids, reason_code, reason_notes,
                       support_user_id, support_user_email):
        try:
            with transaction.atomic():
                jobs = list(
                    Job.objects.select_for_update()
                    .filter(booking_reference__startswith=f"{booking_reference.rstrip('-')}-")
                    .select_related('service_type', 'primary_detailer__user')
                    .prefetch_related('detailers__user')
                    .order_by('appointment_date', 'appointment_time', 'booking_reference')
                )
                if not jobs:
                    return Response({'error': 'No jobs found for this bulk reference'}, status=status.HTTP_404_NOT_FOUND)
                blocked = [j for j in jobs if j.status in BLOCKED_JOB_STATUSES]
                if blocked:
                    return Response(
                        {'error': 'One or more jobs in this bulk are already in progress, completed, or cancelled.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                old_detailer_ids = []
                for j in jobs:
                    if j.primary_detailer_id:
                        old_detailer_ids.append(str(j.primary_detailer_id))
                    for d in j.detailers.all():
                        old_detailer_ids.append(str(d.id))
                old_detailer_ids = list(dict.fromkeys(old_detailer_ids))

                if any(str(uid) in old_detailer_ids for uid in new_ids):
                    return Response(
                        {'error': 'Replacement team cannot include detailers already assigned to this bulk order.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                new_detailers_qs = list(
                    Detailer.objects.select_related('user').filter(id__in=new_ids)
                )
                if len(new_detailers_qs) != len(new_ids):
                    return Response({'error': 'One or more selected detailers not found.'}, status=status.HTTP_400_BAD_REQUEST)
                by_id = {d.id: d for d in new_detailers_qs}
                ordered_team = []
                seen = set()
                for uid in new_ids:
                    if uid in by_id and uid not in seen:
                        ordered_team.append(by_id[uid])
                        seen.add(uid)
                new_team = ordered_team

                ok, err = _validate_new_team_for_bulk(jobs, new_team)
                if not ok:
                    return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)

                previous_status = jobs[0].status
                _assign_team_to_bulk(jobs, new_team)

                assigned_payload = [_detailer_payload_from(d) for d in new_team]

                JobReassignmentAudit.objects.create(
                    booking_reference=booking_reference,
                    is_bulk=True,
                    is_express=False,
                    job_count=len(jobs),
                    old_detailer_ids=old_detailer_ids,
                    new_detailer_ids=[str(d.id) for d in new_team],
                    reason_code=reason_code,
                    reason_notes=reason_notes,
                    support_user_id=support_user_id,
                    support_user_email=support_user_email,
                    previous_status=previous_status,
                )
        except Exception as exc:
            logger.exception('Bulk reassignment failed for %s', booking_reference)
            return Response({'error': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        for job in jobs:
            assignee = job.primary_detailer
            if not assignee:
                continue
            try:
                _notify_new_assignee(job, assignee)
            except Exception as exc:
                logger.warning('Bulk notify new assignee failed: %s', exc)
            try:
                publish_job_acceptance.delay(
                    job.booking_reference,
                    [_detailer_payload_from(assignee)],
                )
            except Exception as exc:
                logger.warning('Bulk publish_job_acceptance failed: %s', exc)

        try:
            publish_job_reassigned.delay(booking_reference, old_detailer_ids, assigned_payload, True)
        except Exception as exc:
            logger.warning('Bulk publish_job_reassigned failed: %s', exc)

        return Response(
            {
                'data': {
                    'booking_reference': booking_reference,
                    'is_bulk': True,
                    'is_express': False,
                    'old_detailer_ids': old_detailer_ids,
                    'assigned_detailers': assigned_payload,
                    'job_count': len(jobs),
                }
            },
            status=status.HTTP_200_OK,
        )

    def _get_reassignment_history(self, request):
        booking_reference = (request.query_params.get('booking_reference') or '').strip()
        if not booking_reference:
            return Response({'error': 'booking_reference is required'}, status=status.HTTP_400_BAD_REQUEST)
        rows = JobReassignmentAudit.objects.filter(
            booking_reference=booking_reference
        ).order_by('-created_at')[:50]
        history = [
            {
                'id': str(row.id),
                'booking_reference': row.booking_reference,
                'is_bulk': row.is_bulk,
                'is_express': row.is_express,
                'job_count': row.job_count,
                'old_detailer_ids': row.old_detailer_ids or [],
                'new_detailer_ids': row.new_detailer_ids or [],
                'reason_code': row.reason_code,
                'reason_notes': row.reason_notes,
                'support_user_id': row.support_user_id,
                'support_user_email': row.support_user_email,
                'previous_status': row.previous_status,
                'created_at': row.created_at.isoformat() if row.created_at else '',
            }
            for row in rows
        ]
        return Response({'data': {'history': history}}, status=status.HTTP_200_OK)
