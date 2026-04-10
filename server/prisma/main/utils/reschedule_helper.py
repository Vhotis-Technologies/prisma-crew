"""
Helper for reschedule: find a detailer (current primary or another) who is free
for the new slot, so the job can be updated in place or reassigned.
"""
from datetime import datetime, time
from typing import Optional, Tuple

from django.utils import timezone

from main.models import Detailer, Job
from main.utils.detailer_matcher import find_detailers_for_location


TRAVEL_BUFFER_MINUTES = 30


def _parse_date_and_time(new_date, new_time):
    """Parse new_appointment_date and new_appointment_time to date and time.
    new_date can be str 'YYYY-MM-DD' or date; new_time can be str 'HH:MM' or 'HH:MM:SS' or time.
    """
    if hasattr(new_date, "year"):
        target_date = new_date
    else:
        s = str(new_date).strip()[:10]
        try:
            target_date = datetime.strptime(s, "%Y-%m-%d").date()
        except (ValueError, TypeError):
            return None, None
    if hasattr(new_time, "hour"):
        appointment_time = new_time
    else:
        s = str(new_time).strip()
        appointment_time = None
        for fmt in ("%H:%M:%S", "%H:%M"):
            try:
                if len(s) >= 5:
                    appointment_time = datetime.strptime(s.split(".")[0], fmt).time()
                    break
            except ValueError:
                continue
        if appointment_time is None:
            return target_date, None
    return target_date, appointment_time


def _detailer_free_for_slot(detailer, target_date, slot_start_time, slot_end_time, exclude_job_id, travel_buffer=30):
    """Return True if detailer has no conflicting job on target_date for the slot (excluding exclude_job_id)."""
    from main.models import Job
    conflicting = Job.objects.filter(
        primary_detailer=detailer,
        appointment_date__date=target_date,
        status__in=["pending", "accepted", "in_progress"],
    ).exclude(id=exclude_job_id).select_related("service_type")
    for j in conflicting:
        job_start = j.appointment_time
        job_duration = getattr(j.service_type, "duration", None) or 60
        job_end_minutes = job_start.hour * 60 + job_start.minute + job_duration
        job_end = time(job_end_minutes // 60, job_end_minutes % 60)
        job_end_with_buffer_minutes = job_end.hour * 60 + job_end.minute + travel_buffer
        job_end_with_buffer = time(
            job_end_with_buffer_minutes // 60,
            job_end_with_buffer_minutes % 60,
        )
        if slot_start_time < job_end_with_buffer and slot_end_time > job_start:
            return False
    return True


def get_detailer_for_reschedule(
    job: Job,
    new_appointment_date,
    new_appointment_time,
) -> Tuple[Optional[Detailer], Optional[object], Optional[object], Optional[str]]:
    """
    Find a detailer who is free for the new slot. Prefer the current primary if still free;
    otherwise return another detailer in the same location who is free.

    Returns:
        (detailer, target_date, appointment_time, None) on success;
        (None, None, None, error_message) on failure.
    """
    target_date, appointment_time = _parse_date_and_time(new_appointment_date, new_appointment_time)
    if target_date is None or appointment_time is None:
        return None, None, None, "Invalid date or time"

    now = timezone.now()
    if target_date < now.date():
        return None, None, None, "Cannot reschedule to a date in the past"
    if target_date == now.date():
        slot_dt = timezone.make_aware(
            datetime.combine(target_date, appointment_time),
            timezone.get_current_timezone(),
        )
        if slot_dt <= now:
            return None, None, None, "Cannot reschedule to a time in the past"

    service_duration = getattr(job.service_type, "duration", None) or 60
    end_minutes = appointment_time.hour * 60 + appointment_time.minute + service_duration
    appointment_end_time = time(end_minutes // 60, end_minutes % 60)

    city = (getattr(job, "city", None) or "").strip() or "Dublin"
    country = (getattr(job, "country", None) or "").strip() or "Ireland"
    lat = getattr(job, "latitude", None)
    lng = getattr(job, "longitude", None)

    detailers_qs, _ = find_detailers_for_location(
        country=country,
        city=city,
        latitude=lat,
        longitude=lng,
        is_available=True,
    )
    if not detailers_qs.exists():
        return None, None, None, "No detailers found for location"

    primary = getattr(job, "primary_detailer", None)
    if primary and detailers_qs.filter(pk=primary.pk).exists():
        candidate_list = [primary] + [d for d in detailers_qs if d.pk != primary.pk]
    else:
        candidate_list = list(detailers_qs)

    for detailer in candidate_list:
        if _detailer_free_for_slot(
            detailer,
            target_date,
            appointment_time,
            appointment_end_time,
            job.id,
            travel_buffer=TRAVEL_BUFFER_MINUTES,
        ):
            return detailer, target_date, appointment_time, None
    return None, None, None, "No detailer free for the new slot"
