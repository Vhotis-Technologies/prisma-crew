"""
Job creation from the client app stack (internal Docker network).

**Auth:** ``ClientInternalPermission`` — client server sends ``X-Client-Internal-Key``.

**POST actions:** ``create_booking`` (single), ``create_bulk_booking`` (fleet same-site),
``reschedule_bulk_booking`` (move existing bulk sub-jobs to new window).

**Assignment:** geo-ordered detailers; express service assigns two detailers when free.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from main.permissions import ClientInternalPermission
from main.models import Detailer, ServiceType, Job, Availability
from main.utils.detailer_matcher import find_detailers_for_location
from main.utils.redis_geo import get_nearest_detailer_ids
from main.utils.service_type import (
    AmbiguousServiceType,
    resolve_job_duration,
    resolve_service_type,
    service_type_error_response,
)
from main.serializer import DetailerSerializer, ServiceTypeSerializer
import time as time_mod
from datetime import datetime, time, timedelta
from django.utils import timezone
from django.db import transaction
from main.util.media_helper import get_full_media_url
from main.tasks import send_booking_confirmation_email, send_push_notification, create_notification, publish_job_acceptance
from main.utils.observability import log_timed

class BookingView(APIView):
    """
    Creates ``Job`` rows and notifies detailers; bulk paths mirror ``check_bulk_capacity`` windows.
    """

    authentication_classes = []
    permission_classes = [ClientInternalPermission]

    action_handler = {
        "create_booking": '_create_booking',
        "create_bulk_booking": '_create_bulk_booking',
        "reschedule_bulk_booking": '_reschedule_bulk_booking',
    }   

    def get(self, request, *args, **kwargs):
        """Route GET ``action`` (reserved) to handler."""
        action = kwargs.get('action')
        if action not in self.action_handler:
            return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)
        handler = getattr(self, self.action_handler[action])
        return handler(request)

    def post(self, request, *args, **kwargs):
        """Route POST ``action`` to create/reschedule handlers."""
        action = kwargs.get('action')
        if action not in self.action_handler:
            return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)
        handler = getattr(self, self.action_handler[action])
        return handler(request)

    def _get_detailers_free_for_slot(
        self,
        available_detailers,
        appointment_date,
        appointment_time,
        appointment_end_time,
        service_duration,
        travel_buffer=30,
    ):
        """
        Return a list of detailers from available_detailers who have no conflicting
        job for the given date and time slot (overlap check includes travel buffer).
        """
        candidates = list(available_detailers[:40])
        if not candidates:
            return []
        jobs_by_detailer = {}
        day_jobs = Job.objects.filter(
            primary_detailer_id__in=[d.id for d in candidates],
            appointment_date__date=appointment_date,
            status__in=['pending', 'accepted', 'in_progress'],
        ).select_related('service_type')
        for job in day_jobs:
            jobs_by_detailer.setdefault(job.primary_detailer_id, []).append(job)
        result = []
        for detailer in candidates:
            conflicting_jobs = jobs_by_detailer.get(detailer.id, [])
            has_conflict = False
            for job in conflicting_jobs:
                job_start = job.appointment_time
                job_duration = job.slot_duration_minutes()
                job_end_minutes = job_start.hour * 60 + job_start.minute + job_duration
                job_end = time(job_end_minutes // 60, job_end_minutes % 60)
                job_end_with_buffer_minutes = job_end.hour * 60 + job_end.minute + travel_buffer
                job_end_with_buffer = time(
                    job_end_with_buffer_minutes // 60,
                    job_end_with_buffer_minutes % 60,
                )
                if appointment_time < job_end_with_buffer and appointment_end_time > job_start:
                    has_conflict = True
                    break
            if not has_conflict:
                result.append(detailer)
        return result

    def _create_booking(self, request):
        """
        Create one accepted ``Job`` and assign nearest free detailer(s).

        Args:
            request: Booking payload from client (service_type, slot, address, vehicle, etc.).

        Returns:
            ``success``, ``assigned_detailers``; publishes Redis job acceptance.
        """
        try:

            try:
                data = request.data
                print(f"booking data: {data}")
            except:
                data = {}
            pass

            request_id = data.get("request_id") if isinstance(data, dict) else None
            handler_started = time_mod.monotonic()

            raw_service_name = data.get("service_type") if isinstance(data, dict) else None
            try:
                service_type = resolve_service_type(raw_service_name)
            except (ServiceType.DoesNotExist, AmbiguousServiceType) as exc:
                body, code = service_type_error_response(exc, raw_service_name)
                return Response(body, status=code)

            job_duration = resolve_job_duration(data if isinstance(data, dict) else {}, service_type)
            
            # Clean up the city and country
            data['city'] = data['city'].strip() if data['city'] else None
            data['country'] = data['country'].strip() if data['country'] else None

            # Optional lat/lng for geographic fallback
            latitude = None
            longitude = None
            if data.get('latitude') is not None and data.get('longitude') is not None:
                try:
                    latitude = float(data['latitude'])
                    longitude = float(data['longitude'])
                except (TypeError, ValueError):
                    pass

            # Check if express service is requested
            is_express_service = data.get('is_express_service', False)
            if isinstance(is_express_service, str):
                is_express_service = is_express_service.lower() == 'true'

            # Find available detailers using three-step fallback: exact -> normalized -> 30km radius
            try:
                available_detailers, _ = find_detailers_for_location(
                    country=data['country'],
                    city=data['city'],
                    latitude=latitude,
                    longitude=longitude,
                    is_available=True,
                )
            except Exception as e:
                return Response({
                    "error": f"Error finding detailers: {str(e)}"
                }, status=status.HTTP_400_BAD_REQUEST)

            if not available_detailers.exists():
                return Response({
                    "success": False,
                    "error": f"No available detailers found in {data['city']}, {data['country']}. We are currently working to bring PRISMA closer to you. Please check back another time."
                }, status=status.HTTP_400_BAD_REQUEST)

            # Parse appointment date/time first so we can filter detailers by slot availability
            appointment_date = datetime.strptime(data['booking_date'], '%Y-%m-%d').date()

            try:
                appointment_time = datetime.strptime(data['start_time'], '%H:%M:%S.%f').time()
            except ValueError:
                try:
                    appointment_time = datetime.strptime(data['start_time'], '%H:%M:%S').time()
                except ValueError:
                    return Response({
                        "error": "Invalid start_time format"
                    }, status=status.HTTP_400_BAD_REQUEST)

            try:
                appointment_end_time = datetime.strptime(data['end_time'], '%H:%M:%S.%f').time()
            except ValueError:
                try:
                    appointment_end_time = datetime.strptime(data['end_time'], '%H:%M:%S').time()
                except ValueError:
                    return Response({
                        "error": "Invalid end_time format"
                    }, status=status.HTTP_400_BAD_REQUEST)

            # Reject appointment times that have already passed. get_timeslots normally filters
            # these out for same-day requests, but this guards against races (slot fetched just
            # before close, submitted just after) or a stale/direct request bypassing that check.
            from zoneinfo import ZoneInfo
            appointment_datetime_check = datetime.combine(
                appointment_date, appointment_time, tzinfo=ZoneInfo('Europe/London')
            )
            if appointment_datetime_check <= timezone.now():
                return Response({
                    "success": False,
                    "error": "This appointment time has already passed. Please choose a different time.",
                }, status=status.HTTP_400_BAD_REQUEST)

            # Only consider detailers who are free for this specific slot (no overlapping job)
            detailers_free_for_slot = self._get_detailers_free_for_slot(
                available_detailers=available_detailers,
                appointment_date=appointment_date,
                appointment_time=appointment_time,
                appointment_end_time=appointment_end_time,
                service_duration=job_duration,
            )
            if not detailers_free_for_slot:
                return Response({
                    "success": False,
                    "error": "No detailers available for the specified time"
                }, status=status.HTTP_400_BAD_REQUEST)

            # Order by distance when client lat/lng present; otherwise use order of filtered list
            available_detailer_ids = set(d.id for d in detailers_free_for_slot)
            detailers_to_assign = []
            if latitude is not None and longitude is not None:
                nearest_ids = get_nearest_detailer_ids(
                    longitude, latitude, radius_km=30.0, count=10
                )
                ordered_ids = [did for did in nearest_ids if did in available_detailer_ids]
                if ordered_ids:
                    need = 2 if is_express_service else 1
                    by_id = {d.id: d for d in detailers_free_for_slot}
                    detailers_to_assign = [by_id[i] for i in ordered_ids[:need] if i in by_id]
            if not detailers_to_assign:
                need = 2 if is_express_service else 1
                detailers_to_assign = detailers_free_for_slot[:need]

            primary_detailer = detailers_to_assign[0]

            # Client sends the correct local time (Europe/London timezone)
            from zoneinfo import ZoneInfo
            appointment_datetime = datetime.combine(
                appointment_date,
                appointment_time,
                tzinfo=ZoneInfo('Europe/London')
            )

            # Convert vehicle_year to integer if it's a string
            vehicle_year = data.get('vehicle_year')
            if vehicle_year and isinstance(vehicle_year, str):
                try:
                    vehicle_year = int(vehicle_year)
                except ValueError:
                    vehicle_year = None
            
            # Convert total_amount to decimal
            total_amount = data.get('total_amount', 0)
            if isinstance(total_amount, str):
                try:
                    total_amount = float(total_amount)
                except ValueError:
                    total_amount = 0
            
            # Create the job
            try:
                pass
                job = Job.objects.create(
                    booking_reference=data['booking_reference'],
                    primary_detailer=primary_detailer,
                    service_type=service_type,
                    client_name=data['client_name'],
                    client_phone=data['client_phone'],
                    vehicle_registration=data['vehicle_registration'],
                    vehicle_make=data['vehicle_make'],
                    vehicle_model=data['vehicle_model'],
                    vehicle_color=data['vehicle_color'],
                    vehicle_year=vehicle_year,
                    total_amount=total_amount,
                    valet_type=data['valet_type'],
                    owner_note=data.get('special_instructions', ''),
                    address=data['address'],
                    city=data['city'],
                    post_code=data['postcode'],
                    country=data['country'],
                    latitude=data['latitude'],
                    longitude=data['longitude'],
                    appointment_date=appointment_datetime,
                    appointment_time=appointment_time,
                    duration=job_duration,
                    status='accepted',  # No separate accept step; job is accepted when assigned
                    loyalty_tier=data.get('loyalty_tier', 'bronze'),
                    loyalty_benefits=data.get('loyalty_benefits', [])
                )
                # Assign all detailers to the job (ManyToMany)
                job.detailers.set(detailers_to_assign)
                # Jobs block times via get_timeslots (we subtract existing jobs); no Availability row needed
            except Exception as e:
                pass
                return Response({
                    "error": f"Error creating job: {str(e)}"
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Store addon names from client (list of strings)
            addon_list = data.get('addons') or []
            if isinstance(addon_list, list):
                job.addon_names = [str(x).strip() for x in addon_list if x]
            else:
                job.addon_names = []
            job.save(update_fields=['addon_names'])

            # Format total amount for email display
            formatted_total_amount = f"{job.total_amount:.2f}"
            
            # Format appointment date and time for email display (convert to local timezone)
            local_datetime = timezone.localtime(job.appointment_date)
            formatted_appointment_date = local_datetime.strftime('%b. %d, %Y, %I %p').replace(' 0', ' ').lower()
            formatted_appointment_time = local_datetime.strftime('%I %p').replace(' 0', ' ').lower()
            
            # Send booking confirmation email to all assigned detailers (express = 2, standard = 1)
            for detailer in detailers_to_assign:
                if detailer.user.allow_email_notifications:
                    send_booking_confirmation_email.delay(
                        detailer.user.email,
                        job.booking_reference,
                        formatted_appointment_date,
                        formatted_appointment_time,
                        job.address,
                        job.service_type.name,
                        job.owner_note,
                        formatted_total_amount
                    )

            # Send notifications to all assigned detailers
            for detailer in detailers_to_assign:
                # Check if the detailer has push notifications enabled
                create_notification.delay(
                    detailer.user.id,
                    'New Appointment',
                    'assigned',
                    'success',
                    'You have been assigned an appointment.'
                )

                # Send the user a push notification if they have allowed push notifications and 
                # have a notification token
                if detailer.user.allow_push_notifications and detailer.user.notification_token:
                    send_push_notification.delay(
                        detailer.user.id,
                        'New Appointment',
                        'You have been assigned an appointment: ' + self.format_appointment_date_time(job.appointment_date, job.appointment_time) + ' at ' + job.post_code,
                        'booking_created'
                    )

            # Build assigned_detailers list for client (same shape as bulk) and Redis
            assigned_detailers_payload = []
            for d in detailers_to_assign:
                assigned_detailers_payload.append({
                    "id": str(d.id),
                    "name": d.user.get_full_name() or "",
                    "phone": (d.user.phone or "") or "",
                    "rating": float(d.rating or 0),
                    "image": None,
                })
            # Publish job_acceptance so client app can set detailer(s) and send confirmation
            publish_job_acceptance.delay(
                job.booking_reference,
                assigned_detailers_payload,
                request_id=request_id,
            )
            log_timed(
                "booking.create_booking",
                handler_started,
                booking_reference=job.booking_reference,
                request_id=request_id,
                ok=True,
            )

            # Return success response with assigned_detailers so client can show all detailers
            response_data = {
                "success": True,
                "assigned_detailers": assigned_detailers_payload,
            }
            return Response(response_data, status=status.HTTP_201_CREATED)
            
        except ServiceType.DoesNotExist:
            log_timed(
                "booking.create_booking",
                handler_started,
                booking_reference=data.get("booking_reference") if isinstance(data, dict) else None,
                request_id=request_id,
                ok=False,
                error="service_type_missing",
            )
            return Response({
                "success": False,
                "error": f"Service type '{data.get('service_type', 'Unknown')}' not found"
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            log_timed(
                "booking.create_booking",
                handler_started,
                booking_reference=data.get("booking_reference") if isinstance(data, dict) else None,
                request_id=request_id,
                ok=False,
                error=str(e),
            )
            return Response({
                "success": False,
                "error": str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

    def _create_bulk_booking(self, request):
        """
        Create multiple jobs for a bulk order: assign jobs to detailers by capacity within the given time window.
        - start_time/end_time come from the client (from check_bulk_capacity options). We treat start_time as
          WINDOW start; first job is at start_time + 30 min (drive). So capacity check must return window start.
        - suggested_team_size: 1 = try to use one detailer for all; >=2 = use that many detailers.
        Payload: address, city, country, postcode, latitude, longitude, date, start_time, end_time,
                 service_type (name), number_of_vehicles, total_amount, client_name, client_phone,
                 booking_reference, owner_note, suggested_team_size, window.
        """
        try:
            data = request.data or {}
            request_id = data.get("request_id")
            handler_started = time_mod.monotonic()
            booking_reference = (data.get('booking_reference') or '').strip()
            if not booking_reference:
                return Response({"error": "booking_reference is required"}, status=status.HTTP_400_BAD_REQUEST)
            raw_service_name = data.get("service_type", "")
            try:
                service_type = resolve_service_type(raw_service_name)
            except (ServiceType.DoesNotExist, AmbiguousServiceType) as exc:
                body, code = service_type_error_response(exc, raw_service_name)
                return Response(body, status=code)
            slot_duration = resolve_job_duration(data, service_type)
            number_of_vehicles = int(data.get('number_of_vehicles', 0))
            if number_of_vehicles <= 0:
                return Response({"error": "number_of_vehicles must be positive"}, status=status.HTTP_400_BAD_REQUEST)
            total_amount = data.get('total_amount', 0)
            try:
                total_amount = float(total_amount)
            except (TypeError, ValueError):
                total_amount = 0
            amount_per_job = total_amount / number_of_vehicles if number_of_vehicles else 0
            city = (data.get('city') or '').strip()
            country = (data.get('country') or '').strip()
            if not city or not country:
                return Response({"error": "city and country are required"}, status=status.HTTP_400_BAD_REQUEST)

            latitude = data.get('latitude')
            longitude = data.get('longitude')
            if latitude is not None and longitude is not None:
                try:
                    latitude = float(latitude)
                    longitude = float(longitude)
                except (TypeError, ValueError):
                    latitude = longitude = None
            try:
                target_date = datetime.strptime(data.get('date', ''), '%Y-%m-%d').date()
            except (ValueError, TypeError):
                return Response({"error": "Invalid date. Use YYYY-MM-DD"}, status=status.HTTP_400_BAD_REQUEST)
            start_time_str = data.get('start_time', '07:00')
            end_time_str = data.get('end_time', '19:00')
            for fmt in ('%H:%M:%S', '%H:%M'):
                try:
                    start_time = datetime.strptime(start_time_str.split('.')[0], fmt).time()
                    break
                except ValueError:
                    continue
            else:
                start_time = time(7, 0)
            for fmt in ('%H:%M:%S', '%H:%M'):
                try:
                    end_time = datetime.strptime(end_time_str.split('.')[0], fmt).time()
                    break
                except ValueError:
                    continue
            else:
                end_time = time(19, 0)
            from zoneinfo import ZoneInfo
            travel_interval = 30  # drive before/after appointments (same-location bulk: no travel between jobs)

            # Using the suggested_team_size, we will assign the jobs to the detailers
            try:
                suggested_team_size = max(1, int(data.get('suggested_team_size', 1)))
            except (TypeError, ValueError):
                suggested_team_size = 1

            # Get the window if morning, afternoon, or fullday
            window = (data.get('window') or '').strip().lower()
            valet_type_str = (data.get('valet_type') or '')
            if isinstance(valet_type_str, str):
                valet_type_str = valet_type_str.strip()[:20]
            else:
                valet_type_str = str(valet_type_str)[:20]
            slot_length_minutes = slot_duration
            detailers_qs, _ = find_detailers_for_location(
                country=country,
                city=city,
                latitude=latitude,
                longitude=longitude,
                is_available=True,
            )
            if not detailers_qs.exists():
                return Response({
                    "error": "No available detailers found for this location. We are currently working to bring Prisma Car Care closer to you."
                }, status=status.HTTP_400_BAD_REQUEST)
            detailer_list = list(detailers_qs)
            existing_jobs = Job.objects.filter(
                primary_detailer__in=detailer_list,
                appointment_date__date=target_date,
                status__in=['accepted', 'in_progress', 'pending'],
            ).select_related('primary_detailer', 'service_type')
            detailer_unavailability = Availability.objects.filter(
                detailer__in=detailer_list,
                date=target_date,
            ).select_related("detailer")
            
            # --- Window in minutes from midnight (client sends start_time/end_time from capacity check) ---
            start_minutes = start_time.hour * 60 + start_time.minute
            end_minutes = end_time.hour * 60 + end_time.minute
            # We treat start_time as WINDOW start: first job is 30 min later (drive to first appointment)
            effective_start_minutes = start_minutes + travel_interval
            window_minutes = end_minutes - effective_start_minutes
            if window_minutes < slot_length_minutes:
                return Response({
                    "error": "Time window too short for at least one service. Please choose a longer window."
                }, status=status.HTTP_400_BAD_REQUEST)
            # Debug: so we can verify capacity matches (max slots = window_minutes // slot_length per detailer)
            max_slots_per_detailer = window_minutes // slot_length_minutes
            total_capacity = max_slots_per_detailer * suggested_team_size
            print(
                f"[create_bulk_booking] window: start_time={start_time_str} end_time={end_time_str} "
                f"effective_start_min={effective_start_minutes} end_min={end_minutes} "
                f"window_minutes={window_minutes} slot_len={slot_length_minutes} vehicles={number_of_vehicles} "
                f"team_size={suggested_team_size} max_slots_per_detailer={max_slots_per_detailer} total_capacity={total_capacity}"
            )

            def minutes_since_midnight(t):
                """Convert time to minutes from midnight for interval math."""
                return t.hour * 60 + t.minute

            def free_intervals_for_detailer(detailer_id, range_start_min, range_end_min, jobs_for_detailer, unavails_for_detailer):
                """
                Return list of (start_min, end_min) for contiguous free segments for this detailer
                in [range_start_min, range_end_min). Blocks: unavailability + existing jobs (with travel).
                Same-location bulk sub-jobs don't add travel after.
                """
                blocked = []
                for u in unavails_for_detailer:
                    u_start = minutes_since_midnight(u.start_time)
                    u_end = minutes_since_midnight(u.end_time)
                    overlap_start = max(u_start, range_start_min)
                    overlap_end = min(u_end, range_end_min)
                    if overlap_end > overlap_start:
                        blocked.append((overlap_start, overlap_end))
                for job in jobs_for_detailer:
                    j_start = minutes_since_midnight(job.appointment_time)
                    j_dur = job.slot_duration_minutes()
                    j_block_start = max(0, j_start - travel_interval)
                    is_bulk_sub = (
                        getattr(job, "booking_reference", "")
                        and "-" in job.booking_reference
                        and job.booking_reference.split("-")[-1].isdigit()
                    )
                    j_end = j_start + j_dur + (0 if is_bulk_sub else travel_interval)
                    overlap_start = max(j_block_start, range_start_min)
                    overlap_end = min(j_end, range_end_min)
                    if overlap_end > overlap_start:
                        blocked.append((overlap_start, overlap_end))
                if not blocked:
                    return [(range_start_min, range_end_min)] if range_start_min < range_end_min else []
                blocked.sort(key=lambda x: x[0])
                merged = [blocked[0]]
                for a, b in blocked[1:]:
                    if a <= merged[-1][1]:
                        merged[-1] = (merged[-1][0], max(merged[-1][1], b))
                    else:
                        merged.append((a, b))
                free = []
                cur = range_start_min
                for a, b in merged:
                    if cur < a and cur < range_end_min:
                        free.append((cur, min(a, range_end_min)))
                    cur = max(cur, b)
                if cur < range_end_min:
                    free.append((cur, range_end_min))
                return free

            def subtract_block(intervals, block_start, block_end):
                """Return new list of (s,e) with [block_start, block_end] removed; used to mark time as taken after placing a job."""
                out = []
                for s, e in intervals:
                    if e <= block_start or s >= block_end:
                        out.append((s, e))
                    else:
                        if s < block_start:
                            out.append((s, block_start))
                        if e > block_end:
                            out.append((block_end, e))
                return out

            def earliest_start(intervals, duration):
                """Earliest start minute in intervals that fits a block of length duration. None if no fit."""
                best = None
                for s, e in intervals:
                    if e - s >= duration:
                        if best is None or s < best:
                            best = s
                return best

            def total_slots_in_intervals(intervals, slot_len):
                """Total number of slot_len-minute blocks that fit in the given free intervals (used to rank detailers by capacity)."""
                return sum(max(0, (e - s) // slot_len) for s, e in intervals)

            # Build mutable free intervals per detailer in [effective_start_minutes, end_minutes); updated as we assign jobs
            existing_jobs_list = list(existing_jobs)
            intervals_by_detailer = {}
            for d in detailer_list:
                jobs_d = [j for j in existing_jobs_list if j.primary_detailer_id == d.id]
                unavails_d = detailer_unavailability.filter(detailer_id=d.id)
                intervals_by_detailer[d.id] = free_intervals_for_detailer(
                    d.id, effective_start_minutes, end_minutes, jobs_d, unavails_d
                )

            # --- When client chose team_size=1: try to assign entire workload to ONE detailer if they have a full-window block ---
            required_single_minutes = travel_interval + number_of_vehicles * slot_length_minutes
            single_detailer_assignment = None
            if suggested_team_size == 1:
                if window == 'fullday':
                    # Fullday + team_size=1: only use one detailer if they have one contiguous block spanning [effective_start, end]
                    window_fits_workload = (end_minutes - effective_start_minutes) >= (number_of_vehicles * slot_length_minutes)
                    for d in detailer_list:
                        intervals = intervals_by_detailer[d.id]
                        if not window_fits_workload:
                            continue
                        for s, e in intervals:
                            if s <= effective_start_minutes and e >= end_minutes:
                                first_block_start = effective_start_minutes - travel_interval
                                if single_detailer_assignment is None or first_block_start < single_detailer_assignment[1]:
                                    single_detailer_assignment = (d, first_block_start)
                                break
                else:
                    # Morning/afternoon: use one detailer if they have any contiguous block long enough for all vehicles
                    for d in detailer_list:
                        intervals = intervals_by_detailer[d.id]
                        max_contiguous = max((e - s for s, e in intervals), default=0)
                        if max_contiguous >= required_single_minutes:
                            start_min = earliest_start(intervals, required_single_minutes)
                            if start_min is not None and (single_detailer_assignment is None or start_min < single_detailer_assignment[1]):
                                single_detailer_assignment = (d, start_min)

            # Sort detailers by how many slots they can fit (busiest first); team_pool = detailers we're allowed to assign to
            detailers_by_capacity = sorted(
                detailer_list,
                key=lambda d: total_slots_in_intervals(intervals_by_detailer[d.id], slot_length_minutes),
                reverse=True,
            )
            if suggested_team_size >= 2:
                team_pool = detailers_by_capacity[:suggested_team_size]
            elif suggested_team_size == 1 and window == 'fullday' and single_detailer_assignment is None:
                team_pool = detailers_by_capacity[:1]  # Client chose one detailer; only use first until we expand below
            else:
                team_pool = detailers_by_capacity[:suggested_team_size] if suggested_team_size >= 1 else detailer_list
            print(
                f"[create_bulk_booking] single_detailer_assignment={single_detailer_assignment is not None} "
                f"team_pool size={len(team_pool)} detailer_ids={[d.id for d in team_pool]}"
            )

            created_jobs = []
            with transaction.atomic():
                # Bulk booking branch 1: single detailer covers full window (team_size=1 + contiguous block)
                if single_detailer_assignment is not None:
                    assignee, first_block_start = single_detailer_assignment
                    first_job_start_min = first_block_start + travel_interval
                    print(f"[create_bulk_booking] assigning all {number_of_vehicles} vehicles to single detailer id={assignee.id}")
                    for i in range(number_of_vehicles):
                        slot_min = first_job_start_min + i * slot_length_minutes
                        slot_time = time(slot_min // 60, slot_min % 60)
                        job_ref = f"{booking_reference}-{i + 1}"
                        appointment_datetime = datetime.combine(target_date, slot_time, tzinfo=ZoneInfo('Europe/London'))
                        job = Job.objects.create(
                            booking_reference=job_ref,
                            primary_detailer=assignee,
                            service_type=service_type,
                            client_name=data.get('client_name', '') or 'Client',
                            client_phone=data.get('client_phone', '') or '',
                            vehicle_registration=f"Bulk-{i + 1}",
                            vehicle_make="TBD",
                            vehicle_model="TBD",
                            vehicle_color="TBD",
                            total_amount=amount_per_job,
                            owner_note=data.get('owner_note', '') or '',
                            address=data.get('address', '') or '',
                            city=city,
                            post_code=data.get('postcode', '') or '',
                            country=country,
                            latitude=latitude,
                            longitude=longitude,
                            appointment_date=appointment_datetime,
                            appointment_time=slot_time,
                            duration=slot_duration,
                            valet_type=valet_type_str or None,
                            status='accepted',
                            loyalty_tier='bronze',
                            loyalty_benefits=[],
                        )
                        job.detailers.set([assignee])
                        intervals_by_detailer[assignee.id] = subtract_block(
                            intervals_by_detailer[assignee.id],
                            slot_min,
                            slot_min + slot_length_minutes,
                        )
                        created_jobs.append(job)
                # Bulk booking branch 2: greedy per-vehicle assign (expand team_pool when team_size=1)
                else:
                    for i in range(number_of_vehicles):
                        while True:
                            best_detailer = None
                            best_start = None
                            if suggested_team_size == 1:
                                # Fill first detailer completely, then use next: take first in pool who has any free slot
                                for d in team_pool:
                                    start = earliest_start(intervals_by_detailer[d.id], slot_length_minutes)
                                    if start is not None:
                                        best_detailer = d
                                        best_start = start
                                        break
                            else:
                                # Team size >= 2: pick detailer with earliest available start (spread jobs by time)
                                for d in team_pool:
                                    start = earliest_start(intervals_by_detailer[d.id], slot_length_minutes)
                                    if start is not None and (best_start is None or start < best_start):
                                        best_detailer = d
                                        best_start = start
                            if not best_detailer:
                                # No slot in current team_pool; if team_size=1 we can expand to next detailer and retry
                                if suggested_team_size == 1 and len(team_pool) < len(detailers_by_capacity):
                                    team_pool = detailers_by_capacity[:len(team_pool) + 1]
                                    continue
                                # Debug: log why we failed (remaining free intervals per detailer)
                                remaining = {did: intervals_by_detailer[did] for did in intervals_by_detailer}
                                print(
                                    f"[create_bulk_booking] CAPACITY FAILED at slot {i + 1}/{number_of_vehicles} ref={booking_reference} "
                                    f"remaining_intervals_by_detailer={remaining}"
                                )
                                import logging
                                logging.getLogger(__name__).warning(
                                    "Bulk booking capacity failed at slot %s/%s (ref=%s)",
                                    i + 1, number_of_vehicles, booking_reference,
                                )
                                return Response({
                                    "error": "Not enough detailer capacity to assign all vehicles. Please try a different date or time window."
                                }, status=status.HTTP_400_BAD_REQUEST)
                            break
                        slot_time = time(best_start // 60, best_start % 60)
                        job_ref = f"{booking_reference}-{i + 1}"
                        appointment_datetime = datetime.combine(target_date, slot_time, tzinfo=ZoneInfo('Europe/London'))
                        job = Job.objects.create(
                            booking_reference=job_ref,
                            primary_detailer=best_detailer,
                            service_type=service_type,
                            client_name=data.get('client_name', '') or 'Client',
                            client_phone=data.get('client_phone', '') or '',
                            vehicle_registration=f"Bulk-{i + 1}",
                            vehicle_make="TBD",
                            vehicle_model="TBD",
                            vehicle_color="TBD",
                            total_amount=amount_per_job,
                            owner_note=data.get('owner_note', '') or '',
                            address=data.get('address', '') or '',
                            city=city,
                            post_code=data.get('postcode', '') or '',
                            country=country,
                            latitude=latitude,
                            longitude=longitude,
                            appointment_date=appointment_datetime,
                            appointment_time=slot_time,
                            duration=slot_duration,
                            valet_type=valet_type_str or None,
                            status='accepted',
                            loyalty_tier='bronze',
                            loyalty_benefits=[],
                        )
                        job.detailers.set([best_detailer])
                        intervals_by_detailer[best_detailer.id] = subtract_block(
                            intervals_by_detailer[best_detailer.id],
                            best_start,
                            best_start + slot_length_minutes,
                        )
                        created_jobs.append(job)
            # All jobs created successfully; send notifications and publish events
            print(f"[create_bulk_booking] SUCCESS ref={booking_reference} created {len(created_jobs)} jobs")
            # After successful commit: send notifications and publish events
            for job in created_jobs:
                assigned = job.primary_detailer
                appointment_datetime = job.appointment_date
                slot_time = job.appointment_time
                if assigned.user.allow_email_notifications:
                    send_booking_confirmation_email.delay(
                        assigned.user.email,
                        job.booking_reference,
                        appointment_datetime.strftime('%b. %d, %Y, %I %p').replace(' 0', ' ').lower(),
                        slot_time.strftime('%I %p').replace(' 0', ' ').lower(),
                        job.address,
                        service_type.name,
                        job.owner_note,
                        f"{amount_per_job:.2f}",
                    )
                create_notification.delay(
                    assigned.user.id,
                    'New Appointment',
                    'assigned',
                    'success',
                    'You have been assigned an appointment.',
                )
                if assigned.user.allow_push_notifications and assigned.user.notification_token:
                    send_push_notification.delay(
                        assigned.user.id,
                        'New Appointment',
                        f'You have been assigned an appointment: {slot_time.strftime("%H:%M")} at {job.post_code}',
                        'booking_created',
                    )
                publish_job_acceptance.delay(
                    job.booking_reference,
                    assigned.user.email,
                    assigned.user.get_full_name(),
                    assigned.user.phone or '',
                    assigned.rating or 0.0,
                    request_id=request_id,
                )
            # Build unique assigned detailers list for client (same shape as Redis job_acceptance)
            seen_ids = set()
            assigned_detailers = []
            for job in created_jobs:
                d = job.primary_detailer
                if d and d.id not in seen_ids:
                    seen_ids.add(d.id)
                    assigned_detailers.append({
                        "id": str(d.id),
                        "name": d.user.get_full_name() or "",
                        "phone": (d.user.phone or "") or "",
                        "rating": float(d.rating or 0),
                        "image": None,
                    })
            log_timed(
                "booking.create_bulk_booking",
                handler_started,
                booking_reference=booking_reference,
                request_id=request_id,
                ok=True,
                jobs_created=len(created_jobs),
            )
            return Response({
                "success": True,
                "jobs_created": len(created_jobs),
                "booking_reference": booking_reference,
                "assigned_detailers": assigned_detailers,
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            log_timed(
                "booking.create_bulk_booking",
                handler_started if "handler_started" in locals() else time_mod.monotonic(),
                booking_reference=booking_reference if "booking_reference" in locals() else None,
                request_id=request_id if "request_id" in locals() else None,
                ok=False,
                error=str(e),
            )
            return Response({
                "success": False,
                "error": str(e),
            }, status=status.HTTP_400_BAD_REQUEST)

    def _reschedule_bulk_booking(self, request):
        """
        Reschedule an existing bulk order to a new date/window. Load existing jobs by base booking_reference,
        build new slots for the new date and selected option, then update or reassign each job.
        Input: booking_reference (base), date, start_time, end_time, number_of_vehicles, suggested_team_size
        (same shape as create_bulk_booking). Returns new_slots for client server to update BookedAppointments.
        """
        try:
            data = request.data or {}
            booking_reference = (data.get('booking_reference') or '').strip()
            if not booking_reference:
                return Response({"error": "booking_reference is required"}, status=status.HTTP_400_BAD_REQUEST)
            base_ref = booking_reference.rstrip('-')
            existing_jobs = list(
                Job.objects.filter(booking_reference__startswith=base_ref + '-')
                .select_related('primary_detailer', 'service_type')
                .order_by('booking_reference')
            )
            if not existing_jobs:
                return Response({"error": "No jobs found for this bulk order"}, status=status.HTTP_404_NOT_FOUND)
            number_of_vehicles = int(data.get('number_of_vehicles', len(existing_jobs)))
            if number_of_vehicles != len(existing_jobs):
                return Response({"error": "number_of_vehicles must match existing job count"}, status=status.HTTP_400_BAD_REQUEST)
            try:
                target_date = datetime.strptime(data.get('date', ''), '%Y-%m-%d').date()
            except (ValueError, TypeError):
                return Response({"error": "Invalid date. Use YYYY-MM-DD"}, status=status.HTTP_400_BAD_REQUEST)
            start_time_str = data.get('start_time', '07:00')
            end_time_str = data.get('end_time', '19:00')
            for fmt in ('%H:%M:%S', '%H:%M'):
                try:
                    start_time = datetime.strptime(start_time_str.split('.')[0], fmt).time()
                    break
                except ValueError:
                    continue
            else:
                start_time = time(7, 0)
            for fmt in ('%H:%M:%S', '%H:%M'):
                try:
                    end_time = datetime.strptime(end_time_str.split('.')[0], fmt).time()
                    break
                except ValueError:
                    continue
            else:
                end_time = time(19, 0)
            try:
                suggested_team_size = max(1, int(data.get('suggested_team_size', 1)))
            except (TypeError, ValueError):
                suggested_team_size = 1
            window = (data.get('window') or '').strip().lower()
            first_job = existing_jobs[0]
            service_type = first_job.service_type
            slot_length_minutes = first_job.slot_duration_minutes()
            city = (first_job.city or '').strip()
            country = (first_job.country or '').strip()
            latitude = getattr(first_job, 'latitude', None)
            longitude = getattr(first_job, 'longitude', None)
            detailers_qs, _ = find_detailers_for_location(
                country=country,
                city=city,
                latitude=latitude,
                longitude=longitude,
                is_available=True,
            )
            if not detailers_qs.exists():
                return Response({"error": "No available detailers for this location"}, status=status.HTTP_400_BAD_REQUEST)
            detailer_list = list(detailers_qs)
            from zoneinfo import ZoneInfo
            travel_interval = 30
            start_minutes = start_time.hour * 60 + start_time.minute
            end_minutes = end_time.hour * 60 + end_time.minute
            effective_start_minutes = start_minutes + travel_interval
            window_minutes = end_minutes - effective_start_minutes
            if window_minutes < slot_length_minutes:
                return Response({"error": "Time window too short"}, status=status.HTTP_400_BAD_REQUEST)
            bulk_job_ids = {j.id for j in existing_jobs}
            other_jobs_same_day = list(
                Job.objects.filter(
                    primary_detailer__in=detailer_list,
                    appointment_date__date=target_date,
                    status__in=['accepted', 'in_progress', 'pending'],
                )
                .exclude(id__in=bulk_job_ids)
                .select_related('primary_detailer', 'service_type')
            )
            detailer_unavailability = Availability.objects.filter(
                detailer__in=detailer_list,
                date=target_date,
            ).select_related("detailer")

            def _minutes_since_midnight(t):
                # Convert appointment ``time`` to minutes from midnight
                return t.hour * 60 + t.minute

            def _reschedule_free_intervals(detailer_id, range_start_min, range_end_min, jobs_for_detailer, unavails_for_detailer):
                # Merge unavailability + job blocks into free minute intervals for reschedule slot search.
                blocked = []
                for u in unavails_for_detailer:
                    u_start = _minutes_since_midnight(u.start_time)
                    u_end = _minutes_since_midnight(u.end_time)
                    overlap_start = max(u_start, range_start_min)
                    overlap_end = min(u_end, range_end_min)
                    if overlap_end > overlap_start:
                        blocked.append((overlap_start, overlap_end))
                for job in jobs_for_detailer:
                    j_start = _minutes_since_midnight(job.appointment_time)
                    j_dur = job.slot_duration_minutes()
                    j_block_start = max(0, j_start - travel_interval)
                    is_bulk_sub = (
                        getattr(job, "booking_reference", "")
                        and "-" in job.booking_reference
                        and job.booking_reference.split("-")[-1].isdigit()
                    )
                    j_end = j_start + j_dur + (0 if is_bulk_sub else travel_interval)
                    overlap_start = max(j_block_start, range_start_min)
                    overlap_end = min(j_end, range_end_min)
                    if overlap_end > overlap_start:
                        blocked.append((overlap_start, overlap_end))
                if not blocked:
                    return [(range_start_min, range_end_min)] if range_start_min < range_end_min else []
                blocked.sort(key=lambda x: x[0])
                merged = [blocked[0]]
                for a, b in blocked[1:]:
                    if a <= merged[-1][1]:
                        merged[-1] = (merged[-1][0], max(merged[-1][1], b))
                    else:
                        merged.append((a, b))
                free = []
                cur = range_start_min
                for a, b in merged:
                    if cur < a and cur < range_end_min:
                        free.append((cur, min(a, range_end_min)))
                    cur = max(cur, b)
                if cur < range_end_min:
                    free.append((cur, range_end_min))
                return free

            def _reschedule_subtract_block(intervals, block_start, block_end):
                """Remove a blocked minute range from a list of free intervals."""
                out = []
                for s, e in intervals:
                    if e <= block_start or s >= block_end:
                        out.append((s, e))
                    else:
                        if s < block_start:
                            out.append((s, block_start))
                        if e > block_end:
                            out.append((block_end, e))
                return out

            def _reschedule_earliest_start(intervals, duration):
                """Earliest minute offset that fits ``duration`` minutes inside free intervals."""
                best = None
                for s, e in intervals:
                    if e - s >= duration:
                        if best is None or s < best:
                            best = s
                return best

            def _reschedule_total_slots(intervals, slot_len):
                """Count discrete reschedule slots of length ``slot_len`` across all free intervals."""
                return sum(max(0, (e - s) // slot_len) for s, e in intervals)

            intervals_by_detailer = {}
            for d in detailer_list:
                jobs_d = [j for j in other_jobs_same_day if j.primary_detailer_id == d.id]
                unavails_d = detailer_unavailability.filter(detailer_id=d.id)
                intervals_by_detailer[d.id] = _reschedule_free_intervals(
                    d.id, effective_start_minutes, end_minutes, jobs_d, unavails_d
                )

            number_of_vehicles = len(existing_jobs)
            required_single_minutes = travel_interval + number_of_vehicles * slot_length_minutes
            single_detailer_assignment = None
            if suggested_team_size == 1:
                if window == 'fullday':
                    # Fullday + team_size=1: only assign to a detailer free for the entire window
                    window_fits_workload = (end_minutes - effective_start_minutes) >= (number_of_vehicles * slot_length_minutes)
                    for d in detailer_list:
                        intervals = intervals_by_detailer[d.id]
                        if not window_fits_workload:
                            continue
                        for s, e in intervals:
                            if s <= effective_start_minutes and e >= end_minutes:
                                first_block_start = effective_start_minutes - travel_interval
                                if single_detailer_assignment is None or first_block_start < single_detailer_assignment[1]:
                                    single_detailer_assignment = (d, first_block_start)
                                break
                else:
                    for d in detailer_list:
                        intervals = intervals_by_detailer[d.id]
                        max_contiguous = max((e - s for s, e in intervals), default=0)
                        if max_contiguous >= required_single_minutes:
                            start_min = _reschedule_earliest_start(intervals, required_single_minutes)
                            if start_min is not None and (single_detailer_assignment is None or start_min < single_detailer_assignment[1]):
                                single_detailer_assignment = (d, start_min)

            detailers_by_capacity = sorted(
                detailer_list,
                key=lambda d: _reschedule_total_slots(intervals_by_detailer[d.id], slot_length_minutes),
                reverse=True,
            )
            if suggested_team_size >= 2:
                team_pool = detailers_by_capacity[:suggested_team_size]
            elif suggested_team_size == 1 and window == 'fullday' and single_detailer_assignment is None:
                team_pool = detailers_by_capacity[:1]  # Respect client choice: one detailer only
            else:
                team_pool = detailers_by_capacity[:suggested_team_size] if suggested_team_size >= 1 else detailer_list

            new_slots = []
            with transaction.atomic():
                # Reschedule logic branch 1: same single-detailer contiguous window as create_bulk
                if single_detailer_assignment is not None:
                    assignee, first_block_start = single_detailer_assignment
                    first_job_start_min = first_block_start + travel_interval
                    for idx, job in enumerate(existing_jobs):
                        slot_min = first_job_start_min + idx * slot_length_minutes
                        slot_time = time(slot_min // 60, slot_min % 60)
                        appointment_datetime = datetime.combine(target_date, slot_time, tzinfo=ZoneInfo('Europe/London'))
                        job.primary_detailer = assignee
                        job.appointment_date = appointment_datetime
                        job.appointment_time = slot_time
                        job.detailers.set([assignee])
                        job.save()
                        intervals_by_detailer[assignee.id] = _reschedule_subtract_block(
                            intervals_by_detailer[assignee.id],
                            slot_min,
                            slot_min + slot_length_minutes,
                        )
                        new_slots.append({
                            "booking_reference": job.booking_reference,
                            "appointment_date": target_date.isoformat(),
                            "appointment_time": slot_time.strftime("%H:%M"),
                            "detailer_id": str(assignee.id),
                        })
                else:
                    # Reschedule logic branch 2: per-job greedy slot on new date (exclude bulk jobs from conflicts)
                    for idx, job in enumerate(existing_jobs):
                        while True:
                            best_detailer = None
                            best_start = None
                            if suggested_team_size == 1:
                                for d in team_pool:
                                    start = _reschedule_earliest_start(intervals_by_detailer[d.id], slot_length_minutes)
                                    if start is not None:
                                        best_detailer = d
                                        best_start = start
                                        break
                            else:
                                for d in team_pool:
                                    start = _reschedule_earliest_start(intervals_by_detailer[d.id], slot_length_minutes)
                                    if start is not None and (best_start is None or start < best_start):
                                        best_detailer = d
                                        best_start = start
                            if not best_detailer:
                                if suggested_team_size == 1 and len(team_pool) < len(detailers_by_capacity):
                                    team_pool = detailers_by_capacity[:len(team_pool) + 1]
                                    continue
                                return Response({
                                    "error": "Not enough detailer capacity for the new date. Please try a different option."
                                }, status=status.HTTP_400_BAD_REQUEST)
                            break
                        slot_time = time(best_start // 60, best_start % 60)
                        appointment_datetime = datetime.combine(target_date, slot_time, tzinfo=ZoneInfo('Europe/London'))
                        job.primary_detailer = best_detailer
                        job.appointment_date = appointment_datetime
                        job.appointment_time = slot_time
                        job.detailers.set([best_detailer])
                        job.save()
                        intervals_by_detailer[best_detailer.id] = _reschedule_subtract_block(
                            intervals_by_detailer[best_detailer.id],
                            best_start,
                            best_start + slot_length_minutes,
                        )
                        new_slots.append({
                            "booking_reference": job.booking_reference,
                            "appointment_date": target_date.isoformat(),
                            "appointment_time": slot_time.strftime("%H:%M"),
                            "detailer_id": str(best_detailer.id),
                        })
            return Response({
                "success": True,
                "booking_reference": base_ref,
                "new_slots": new_slots,
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                "success": False,
                "error": str(e),
            }, status=status.HTTP_400_BAD_REQUEST)

    
    # Format the appointment date and time so it says the day and time 
    # Example: Wednesday 8:00 AM
    def format_appointment_date_time(self, appointment_date, appointment_time):
        """
        Human-readable label for push copy (e.g. ``Wednesday 8:00 AM``).

        Args:
            appointment_date: Datetime or date component.
            appointment_time: ``time`` instance.

        Returns:
            Formatted string.
        """
        return f"{appointment_date.strftime('%A')} {appointment_time.strftime('%I:%M %p')}"
    

    # def get_available_detailer(self, country, city, appointment_date, appointment_time, service_duration=60, appointment_end_time=None):
    #     """ 
    #       Check if any detailer is available for a given appointment time in the specified location.
    #       The method uses get_all_detailer to get all detailers and checks their availability.
    #     ARGS:
    #         country: str - Country name
    #         city: str - City name
    #         appointment_date: str - Date in YYYY-MM-DD format
    #         appointment_time: str - Time in HH:MM format
    #         service_duration: int - Duration of the service in minutes (default 60)
    #       RETURNS:
    #         bool - True if any detailer is available, False otherwise
    #     """
    #     try:
    #         # Parse the appointment date and time
    #         try:
    #             target_date = datetime.strptime(appointment_date, '%Y-%m-%d').date()
    #             target_time = datetime.strptime(appointment_time, '%H:%M').time()
    #             target_end_time = datetime.strptime(appointment_end_time, '%H:%M').time()
    #         except ValueError:
    #             return False
            
    #         # Get all detailers in the location using the existing method
    #         detailers = self.get_all_detailer(country, city)
    #         if not detailers:
    #             return False
    #         # Calculate the end time of the appointment
    #         start_minutes = target_time.hour * 60 + target_time.minute
    #         end_minutes = start_minutes + service_duration
    #         appointment_end_time = time(end_minutes // 60, end_minutes % 60)
            
    #         # Check each detailer for availability
    #         for detailer in detailers:
    #             # Check if detailer has any conflicting jobs on the same date
    #             conflicting_jobs = Job.objects.filter(
    #                 detailer=detailer,
    #                 appointment_date__date=target_date,
    #                 status__in=['pending', 'accepted', 'in_progress']
    #             )
                
    #             has_conflict = False
    #             for job in conflicting_jobs:
    #                 job_start = job.appointment_time
    #                 job_end = target_end_time
    #                 job_start_minutes = job_start.hour * 60 + job_start.minute
    #                 job_end_minutes = job_end.hour * 60 + job_end.minute
                    
    #                 # Check for time overlap (including 30-minute travel buffer)
    #                 travel_buffer = 30  # minutes
    #                 job_end_with_buffer_minutes = job_end_minutes + travel_buffer
    #                 job_end_with_buffer = time(job_end_with_buffer_minutes // 60, job_end_with_buffer_minutes % 60)
                    
    #                 # Check if new appointment overlaps with existing job
    #                 if (target_time < job_end_with_buffer and appointment_end_time > job_start):
    #                     has_conflict = True
    #                     break
                
    #             if has_conflict:
    #                 continue  # Check next detailer
                
    #             # If no specific availability is set, use default business hours (6 AM to 9 PM)
    #             else:
    #                 business_start = time(7, 0)  # 7:00 AM
    #                 business_end = time(19, 0)   # 7:00 PM
                    
    #                 if target_time < business_start or appointment_end_time > business_end:
    #                     continue  # Check next detailer
                
    #             # If we reach here, this detailer is available
    #             return True
            
    #         # If no detailer is available
    #         return False

    #     except Exception as e:
    #         return False
        


    # def get_all_detailer(self, country=None, city=None):
    #     """ 
    #       Given the params the method is designed to get the available detailers in the city and country.
    #       ARGS:
    #         country: str
    #         city: str
    #       RETURNS:
    #         list of detailers
    #     """
    #     try:
    #         detailers = Detailer.objects.filter(country=country, city=city, is_active=True, is_verified=True)
    #         if not detailers.exists():
    #             return Response({"error": "No active detailers found in the city and country"}, status=status.HTTP_400_BAD_REQUEST)
    #         # Serialize the detailers
    #         detailers_serializer = DetailerSerializer(detailers, many=True)
    #         # Return the detailers
    #         return Response({"detailers": detailers_serializer.data}, status=status.HTTP_200_OK)
    #     except Exception as e:
    #         return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        
        
        
    # def get_service_type(self, service_type):
    #     """ 
    #       Given the service type the method is designed to get the service type from the service type model.
    #       ARGS:
    #         service_type: str
    #       RETURNS:
    #         service type
    #     """
    #     try:
    #         service_type = ServiceType.objects.get(name=service_type)
    #         # Serialize the service type
    #         service_type_serializer = ServiceTypeSerializer(service_type)
    #         # Return the service type
    #         return Response({"service_type": service_type_serializer.data}, status=status.HTTP_200_OK)
    #     except Exception as e:
    #         return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        

        




