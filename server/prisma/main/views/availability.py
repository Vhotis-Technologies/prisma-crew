from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.db.models import Q
from main.models import Detailer, Availability, Job, ServiceType
from main.utils.detailer_matcher import find_detailers_for_location
from datetime import datetime, time, timedelta
from django.utils import timezone
import json


def _merge_times_to_ranges(time_strings):
    """
    Convert a sorted list of time strings (e.g. ["06:00","07:00","08:00","10:00"])
    into contiguous (start_time, end_time) ranges as datetime.time.
    E.g. ["06:00","07:00","08:00","10:00"] -> [(06:00, 09:00), (10:00, 11:00)].
    Each slot is treated as one hour; end = start + 1 hour for the last in a run.
    """
    if not time_strings:
        return []
    ranges = []
    try:
        times = [datetime.strptime(t, "%H:%M").time() for t in sorted(time_strings)]
    except (ValueError, TypeError):
        return []
    start = times[0]
    prev = times[0]
    for i in range(1, len(times)):
        prev_minutes = prev.hour * 60 + prev.minute
        curr_minutes = times[i].hour * 60 + times[i].minute
        if curr_minutes != prev_minutes + 60:
            # Not consecutive: close current range at prev + 1 hour
            end_minutes = prev_minutes + 60
            end = time(end_minutes // 60, end_minutes % 60)
            ranges.append((start, end))
            start = times[i]
        prev = times[i]
    end_minutes = prev.hour * 60 + prev.minute + 60
    end = time(end_minutes // 60, end_minutes % 60) if end_minutes < 24 * 60 else time(23, 59)
    ranges.append((start, end))
    return ranges


def _range_to_hour_slots(start_min, end_min):
    """
    Return set of 'HH:00' for business hours 7-19 that overlap [start_min, end_min).
    UI only has whole-hour slots (07:00, 08:00, ...), so a job at 07:30 must block 07:00.
    If end_min <= start_min (e.g. duration 0), still block the hour containing start_min.
    """
    out = set()
    if end_min <= start_min:
        end_min = start_min + 1
    for h in range(7, 20):
        slot_start = h * 60
        slot_end = (h + 1) * 60
        if start_min < slot_end and end_min > slot_start:
            out.add(f"{h:02d}:00")
    return out


""" The class is used to handle all of the users availability related actions

    It is also used to handle the commuinication between the client app stack and the server
    through the internal docker container network
 """
class AvailabilityView(APIView):
    """ Enssure that only a few methods are accessed without authentication. 
        This is to allow the client app stack to access the availability endpoints without authentication.

        To do this, we will destructure and override the get_permissions method.
    """
    public_actions = ['get_timeslots', 'check_bulk_capacity']
    
    def get_permissions(self):
        """ set permissions to the allow any for the method that is connected from the client app stack
        """
        action = self.kwargs.get('action')
        if action in self.public_actions:
            permission_classes = [AllowAny]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]
    
    
    """ Create the action handler to route the user to the appropriate view, given the action """
    action_handler = {
        'get_timeslots': 'get_timeslots',
        'check_bulk_capacity': 'check_bulk_capacity',
        'get_availability': 'get_availability',
        'create_availability': 'create_availability',
        'get_busy_times': 'get_busy_times',
    }

    def get(self, request, *args, **kwargs):
        action = kwargs.get('action')
        if action not in self.action_handler:
            return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)
        handler = getattr(self, self.action_handler[action])
        return handler(request)
    
    def post(self, request, *args, **kwargs):
        action = kwargs.get('action')
        if action not in self.action_handler:
            return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)
        handler = getattr(self, self.action_handler[action])
        return handler(request)
    
    
    def get_timeslots(self, request):
        """
        Get available time slots for detailers in a specific location
        
        Query Parameters:
        - date: YYYY-MM-DD format
        - service_duration: Duration in minutes
        - country: Country name
        - city: City name
        - latitude: Optional - Client latitude for geographic fallback (30km radius)
        - longitude: Optional - Client longitude for geographic fallback (30km radius)
        - is_express_service: Boolean (optional) - if True, checks for 2 available detailers
        
        Returns:
        - slots: Array of available time slots
        """
        try:
            data = request.query_params
            date_str = data.get('date')
            service_duration = int(data.get('service_duration', 60))
            country = data.get('country').strip() if data.get('country') else None
            city = data.get('city').strip() if data.get('city') else None
            latitude_str = data.get('latitude')
            longitude_str = data.get('longitude')
            is_express_service = data.get('is_express_service', 'false').lower() == 'true'

            # Optional lat/lng for geographic fallback
            latitude = None
            longitude = None
            if latitude_str and longitude_str:
                try:
                    latitude = float(latitude_str)
                    longitude = float(longitude_str)
                except (TypeError, ValueError):
                    pass

            # Validate required parameters
            if not all([date_str, country, city]):
                return Response({
                    "error": "Missing required parameters: date, country, city"
                }, status=status.HTTP_400_BAD_REQUEST)

            # Parse date
            try:
                target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                return Response({
                    "error": "Invalid date format. Use YYYY-MM-DD"
                }, status=status.HTTP_400_BAD_REQUEST)

            # Get detailers using three-step fallback: exact -> normalized -> 30km radius
            # Only include detailers who have is_available=True (toggled on for work)
            detailers, _ = find_detailers_for_location(
                country=country,
                city=city,
                latitude=latitude,
                longitude=longitude,
                is_available=True,
            )

            if not detailers.exists():
                return Response({
                    "error": f"No active detailers found in {city}, {country}. We are currently working to bring PRISMA closer to you. Please check back another time.",
                    "slots": []
                }, status=status.HTTP_200_OK)

            # Business hours: 7 AM to 7 PM. First bookable slot is 7:30 AM to allow 30 min drive to first appointment.
            business_start = time(7, 0)
            first_slot_start = time(7, 30)  # 30 min drive considered for first booking
            business_end = time(19, 0)
            travel_interval = 30

            # Generate all possible slots for the day (first slot 6:30, then after each slot + travel_interval)
            all_slots = self._generate_time_slots(
                first_slot_start,
                business_end,
                service_duration,
                travel_interval,
            )

            # Availability table stores when detailers are NOT available (off work). Subtract those windows.
            detailer_unavailability = Availability.objects.filter(
                detailer__in=detailers,
                date=target_date,
            ).select_related("detailer")

            existing_jobs = Job.objects.filter(
                primary_detailer__in=detailers,
                appointment_date__date=target_date,
                status__in=["accepted", "in_progress", "pending"],
            ).select_related("primary_detailer")

            available_slots = self._calculate_available_slots(
                all_slots,
                existing_jobs,
                service_duration,
                travel_interval,
                detailers=list(detailers),
                detailer_unavailability=detailer_unavailability,
            )

            if not available_slots:
                return Response({
                    "error": "No available slots found",
                    "slots": []
                }, status=status.HTTP_200_OK)
            return Response({
                "slots": available_slots,
            }, status=status.HTTP_200_OK)

        except ValueError as e:
            return Response({
                "error": f"Invalid parameter: {str(e)}"
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                "error": f"Server error: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


    def check_bulk_capacity(self, request):
        """
        Check if there is enough aggregate detailer capacity for a bulk booking on a given date.
        GET/POST params: date (YYYY-MM-DD), workload_minutes, service_duration (minutes per vehicle),
                        country, city, optional latitude, longitude.
        Returns booking options (morning/afternoon/fullday) with best_start_time, estimated_finish_time,
        suggested_team_size when capacity >= workload_minutes.
        """
        try:
            data = request.query_params if request.method == 'GET' else (request.data or {})
            date_str = data.get('date')
            workload_minutes = data.get('workload_minutes')
            service_duration = data.get('service_duration')
            country = (data.get('country') or '').strip()
            city = (data.get('city') or '').strip()
            latitude_str = data.get('latitude')
            longitude_str = data.get('longitude')

            if not date_str or not country or not city:
                return Response({
                    "error": "Missing required parameters: date, country, city"
                }, status=status.HTTP_400_BAD_REQUEST)
            try:
                workload_minutes = int(workload_minutes)
            except (TypeError, ValueError):
                return Response({
                    "error": "workload_minutes must be an integer"
                }, status=status.HTTP_400_BAD_REQUEST)
            try:
                service_duration = int(service_duration) if service_duration is not None else 60
            except (TypeError, ValueError):
                service_duration = 60

            try:
                target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                return Response({
                    "error": "Invalid date format. Use YYYY-MM-DD"
                }, status=status.HTTP_400_BAD_REQUEST)

            latitude = None
            longitude = None
            if latitude_str is not None and longitude_str is not None:
                try:
                    latitude = float(latitude_str)
                    longitude = float(longitude_str)
                except (TypeError, ValueError):
                    pass

            # "Too late for today" check: if selected date is today, ensure enough time until 9pm
            business_end = time(19, 0)
            today = timezone.now().date()
            if target_date == today:
                now_param = data.get('now')
                if now_param:
                    try:
                        now_dt = datetime.fromisoformat(now_param.replace('Z', '+00:00'))
                        if timezone.is_naive(now_dt):
                            now_dt = timezone.make_aware(now_dt, timezone.get_current_timezone())
                        now_dt = timezone.localtime(now_dt)
                        now_minutes = now_dt.hour * 60 + now_dt.minute
                    except (ValueError, TypeError):
                        now_minutes = timezone.now().hour * 60 + timezone.now().minute
                else:
                    now_dt = timezone.now()
                    now_minutes = now_dt.hour * 60 + now_dt.minute
                business_end_min = 19 * 60
                minutes_left = business_end_min - now_minutes
                # Same-location bulk: one 30 min drive + workload
                required_minutes = 30 + workload_minutes
                if minutes_left < required_minutes:
                    return Response({
                        "error": "Too late for this volume today. Business closes at 9pm. Try fewer vehicles or another day.",
                        "available": False,
                        "options": [],
                    }, status=status.HTTP_200_OK)

            travel_interval = 30  # for existing jobs at other locations only
            # Same-location bulk: no travel between jobs; slot = duration only
            slot_length = service_duration

            # Window boundaries (minutes from midnight for comparison)
            business_start = time(7, 0)
            business_end = time(19, 0)
            morning_end = time(12, 0)
            afternoon_end = time(18, 0)

            detailers, _ = find_detailers_for_location(
                country=country,
                city=city,
                latitude=latitude,
                longitude=longitude,
                is_available=True,
            )
            if not detailers.exists():
                return Response({
                    "error": "Not enough capacity on this date. Try another date or fewer vehicles.",
                    "available": False,
                    "options": [],
                }, status=status.HTTP_200_OK)

            # Availability table = when detailers are NOT available. Default = available (business hours).
            detailer_unavailability = Availability.objects.filter(
                detailer__in=detailers,
                date=target_date,
            ).select_related("detailer")

            existing_jobs = Job.objects.filter(
                primary_detailer__in=detailers,
                appointment_date__date=target_date,
                status__in=["accepted", "in_progress", "pending"],
            ).select_related("primary_detailer", "service_type")

            def minutes_since_midnight(t):
                return t.hour * 60 + t.minute

            def free_intervals_in_range(detailer_id, range_start, range_end):
                """
                Return list of (start_min, end_min) for contiguous free segments
                in [range_start, range_end), in minutes from midnight.
                """
                start_min = minutes_since_midnight(range_start)
                end_min = minutes_since_midnight(range_end)
                blocked = []
                unavails = detailer_unavailability.filter(detailer_id=detailer_id)
                for u in unavails:
                    u_start = minutes_since_midnight(u.start_time)
                    u_end = minutes_since_midnight(u.end_time)
                    overlap_start = max(u_start, start_min)
                    overlap_end = min(u_end, end_min)
                    if overlap_end > overlap_start:
                        blocked.append((overlap_start, overlap_end))
                jobs_for_detailer = existing_jobs.filter(primary_detailer_id=detailer_id)
                for job in jobs_for_detailer:
                    j_start = minutes_since_midnight(job.appointment_time)
                    j_dur = getattr(job.service_type, "duration", 60) or 60
                    # Block from 30 min before job (drive to appointment) until job end + 30 min (travel after)
                    j_block_start = max(0, j_start - travel_interval)
                    j_end = j_start + j_dur + travel_interval
                    overlap_start = max(j_block_start, start_min)
                    overlap_end = min(j_end, end_min)
                    if overlap_end > overlap_start:
                        blocked.append((overlap_start, overlap_end))
                if not blocked:
                    return [(start_min, end_min)] if start_min < end_min else []
                blocked.sort(key=lambda x: x[0])
                merged = [blocked[0]]
                for a, b in blocked[1:]:
                    if a <= merged[-1][1]:
                        merged[-1] = (merged[-1][0], max(merged[-1][1], b))
                    else:
                        merged.append((a, b))
                free = []
                cur = start_min
                for a, b in merged:
                    if cur < a and cur < end_min:
                        free.append((cur, min(a, end_min)))
                    cur = max(cur, b)
                if cur < end_min:
                    free.append((cur, end_min))
                return free

            def max_contiguous_free_minutes_in_range(detailer_id, range_start, range_end):
                """Longest contiguous free block for this detailer in the window."""
                intervals = free_intervals_in_range(detailer_id, range_start, range_end)
                return max((e - s for s, e in intervals), default=0)

            # Build list of detailer ids (from queryset)
            detailer_ids = list(detailers.values_list('id', flat=True))

            # Define the three booking windows: morning (7-12), afternoon (12-18), fullday (7-19)
            windows_config = [
                ('morning', business_start, morning_end),
                ('afternoon', morning_end, afternoon_end),
                ('fullday', business_start, business_end),
            ]
            options = []
            for window_name, w_start, w_end in windows_config:
                w_start_min = minutes_since_midnight(w_start)
                w_end_min = minutes_since_midnight(w_end)
                # For each detailer, get their longest contiguous free block in this window (minutes)
                max_contiguous_per_detailer = [
                    max_contiguous_free_minutes_in_range(did, w_start, w_end) for did in detailer_ids
                ]
                total_contiguous = sum(max_contiguous_per_detailer)
                if total_contiguous < workload_minutes:
                    continue
                # How many job slots we need: one per vehicle (workload_minutes = vehicles * service_duration)
                number_of_slots = (workload_minutes + service_duration - 1) // service_duration
                if number_of_slots <= 0:
                    number_of_slots = 1
                # How many slots each detailer can fit in their longest free block
                slots_per_detailer = [m // slot_length for m in max_contiguous_per_detailer]
                slots_per_detailer.sort(reverse=True)
                # Find minimum team size that can cover all slots (greedy: use busiest detailers first)
                team_size = 0
                slots_covered = 0
                for s in slots_per_detailer:
                    team_size += 1
                    slots_covered += s
                    if slots_covered >= number_of_slots:
                        break
                if slots_covered < number_of_slots:
                    continue
                # Busiest detailer needs: 30 min drive + (ceil(number_of_slots/team_size) * service_duration)
                jobs_per_busiest = (number_of_slots + team_size - 1) // team_size
                required_window_minutes = 30 + jobs_per_busiest * service_duration
                if (w_end_min - w_start_min) < required_window_minutes:
                    continue
                # Pick window start and estimated finish so create_bulk_booking gets the same convention:
                # We return WINDOW START (not first job start). create_bulk_booking does effective_start = window_start + 30,
                # so first job will be at window_start + 30. So we set best_start_time = segment start (e.g. 07:00),
                # and end_min = window_start + 30 + jobs_per_busiest * service_duration (e.g. 17:30).
                busiest_idx = max(range(len(detailer_ids)), key=lambda i: max_contiguous_per_detailer[i])
                busiest_detailer_id = detailer_ids[busiest_idx]
                intervals = free_intervals_in_range(busiest_detailer_id, w_start, w_end)
                window_start_min = None
                for seg_start, seg_end in intervals:
                    if seg_end - seg_start >= required_window_minutes:
                        # Return window start (seg_start); first job will be at seg_start + 30 in create_bulk_booking
                        window_start_min = seg_start
                        break
                if window_start_min is None:
                    continue
                # End of work = window start + 30 min drive + all jobs for busiest detailer
                end_min = window_start_min + 30 + jobs_per_busiest * service_duration
                end_min = min(end_min, w_end_min)
                best_start_time = time(window_start_min // 60, window_start_min % 60).strftime('%H:%M')
                estimated_finish_time = time(end_min // 60, end_min % 60).strftime('%H:%M')
                # Debug: log what we're promising so it matches create_bulk_booking's effective window
                effective_window_min = end_min - (window_start_min + 30)
                slots_in_returned_window = effective_window_min // slot_length
                print(
                    f"[check_bulk_capacity] option: window={window_name} best_start_time={best_start_time} "
                    f"estimated_finish_time={estimated_finish_time} team_size={team_size} "
                    f"number_of_slots={number_of_slots} slots_in_returned_window={slots_in_returned_window} "
                    f"required_window_minutes={required_window_minutes}"
                )
                options.append({
                    "window": window_name,
                    "best_start_time": best_start_time,
                    "estimated_finish_time": estimated_finish_time,
                    "suggested_team_size": team_size,
                })

            if not options:
                return Response({
                    "error": "Not enough capacity on this date. Try another date or fewer vehicles.",
                    "available": False,
                    "options": [],
                }, status=status.HTTP_200_OK)

            return Response({
                "available": True,
                "options": options,
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({
                "error": f"Server error: {str(e)}",
                "available": False,
                "options": [],
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _generate_time_slots(self, start_time, end_time, service_duration, travel_interval):
        slots = []
        current_time = start_time
        
        while current_time < end_time:
            # Calculate end time for this slot
            start_minutes = current_time.hour * 60 + current_time.minute
            end_minutes = start_minutes + service_duration
            
            # Check if this slot would extend beyond business hours
            if end_minutes > (end_time.hour * 60 + end_time.minute):
                break
                
            end_time_slot = time(end_minutes // 60, end_minutes % 60)
            
            slots.append({
                "start_time": current_time.strftime("%H:%M"),
                "end_time": end_time_slot.strftime("%H:%M"),
                "is_available": True
            })
            
            next_start_minutes = end_minutes + travel_interval
            current_time = time(next_start_minutes // 60, next_start_minutes % 60)
        
        return slots
    

    def _generate_slots_from_availability(self, detailer_availability, service_duration, travel_interval):
        all_slots = []
        
        for availability in detailer_availability:
            # Generate slots for this detailer's availability window
            detailer_slots = self._generate_time_slots(
                availability.start_time,
                availability.end_time,
                service_duration,
                travel_interval
            )
            
            # Add detailer info to each slot
            for slot in detailer_slots:
                slot['detailer_id'] = availability.detailer.id
                slot['detailer_name'] = availability.detailer.user.get_full_name()
            
            all_slots.extend(detailer_slots)
        
        # Remove duplicates and sort by start time
        unique_slots = []
        seen_times = set()
        
        for slot in sorted(all_slots, key=lambda x: x['start_time']):
            time_key = f"{slot['start_time']}-{slot['end_time']}"
            if time_key not in seen_times:
                seen_times.add(time_key)
                unique_slots.append(slot)
        
        return unique_slots


    def _calculate_available_slots(
        self,
        all_slots,
        existing_jobs,
        service_duration,
        travel_interval,
        detailers=None,
        detailer_unavailability=None,
    ):
        """
        Keep a slot if at least one detailer is free (no unavailability, no job) at that time.
        """
        detailers = detailers or []
        detailer_unavailability = list(detailer_unavailability or [])
        unavail_by_detailer = {}
        for u in detailer_unavailability:
            did = u.detailer_id
            if did not in unavail_by_detailer:
                unavail_by_detailer[did] = []
            unavail_by_detailer[did].append((u.start_time, u.end_time))

        available_slots = []
        for slot in all_slots:
            slot_start = datetime.strptime(slot["start_time"], "%H:%M").time()
            slot_end = datetime.strptime(slot["end_time"], "%H:%M").time()

            for detailer in detailers:
                did = detailer.pk
                unavail_windows = unavail_by_detailer.get(did, [])
                if any(slot_start < u_end and slot_end > u_start for u_start, u_end in unavail_windows):
                    continue
                detailer_jobs = existing_jobs.filter(primary_detailer_id=did)
                in_job = False
                for job in detailer_jobs:
                    job_start = job.appointment_time
                    js = job_start.hour * 60 + job_start.minute
                    job_duration = getattr(job.service_type, 'duration', None) or 60
                    je = js + job_duration + travel_interval
                    job_end = time(je // 60, je % 60)
                    if slot_start < job_end and slot_end > job_start:
                        in_job = True
                        break
                if not in_job:
                    available_slots.append({
                        "start_time": slot["start_time"],
                        "end_time": slot["end_time"],
                        "is_available": True,
                    })
                    break
        return available_slots
    

    def get_availability(self, request):
        """
        GET: Load the detailer's unavailability (when they're not available for work).
        Calendar shows selected = unavailable (self-set or job). isBlockedByJob = job times (read-only).
        """
        try:
            try:
                detailer = Detailer.objects.get(user=request.user)
            except Detailer.DoesNotExist:
                return Response(
                    {"error": "Detailer profile not found"},
                    status=status.HTTP_403_FORBIDDEN,
                )
            today = timezone.now().date()
            end_date = today + timedelta(days=365)
            # All Availability rows for this detailer = when they're NOT available (unavailability)
            rows = Availability.objects.filter(
                detailer=detailer,
                date__gte=today,
                date__lte=end_date,
            ).order_by("date", "start_time")

            all_hours = [f"{h:02d}:00" for h in range(6, 21)]
            date_to_unavailable_hours = {}
            for r in rows:
                d = r.date.isoformat()
                if d not in date_to_unavailable_hours:
                    date_to_unavailable_hours[d] = set()
                start_min = r.start_time.hour * 60 + r.start_time.minute
                end_min = r.end_time.hour * 60 + r.end_time.minute
                for m in range(start_min, end_min, 60):
                    hour_str = f"{m // 60:02d}:{m % 60:02d}"
                    date_to_unavailable_hours[d].add(hour_str)

            jobs = Job.objects.filter(
                Q(primary_detailer=detailer) | Q(detailers=detailer),
                appointment_date__date__gte=today,
                appointment_date__date__lte=end_date,
                status__in=["pending", "accepted", "in_progress"],
            ).distinct().select_related("service_type")
            date_to_job_hours = {}
            for job in jobs:
                d = job.appointment_date.date().isoformat()
                if d not in date_to_job_hours:
                    date_to_job_hours[d] = set()
                start_min = job.appointment_time.hour * 60 + job.appointment_time.minute
                end_min = start_min + (job.service_type.duration or 0)
                date_to_job_hours[d] |= _range_to_hour_slots(start_min, end_min)

            all_dates = sorted(
                set(date_to_unavailable_hours.keys()) | set(date_to_job_hours.keys())
            )
            selected_dates = []
            for d in all_dates:
                unavailable_hours = date_to_unavailable_hours.get(d, set())
                job_hours = date_to_job_hours.get(d, set())
                time_slots = []
                for h in all_hours:
                    hour_num = int(h.split(":")[0])
                    is_blocked_by_job = h in job_hours
                    # Selected = unavailable (either self-set or job)
                    is_selected = h in unavailable_hours or is_blocked_by_job
                    time_slots.append({
                        "id": f"{hour_num}-00",
                        "time": h,
                        "isSelected": is_selected,
                        "isBlockedByJob": is_blocked_by_job,
                    })
                selected_dates.append({
                    "date": d,
                    "timeSlots": time_slots,
                    "isSelected": True,
                })

            now = timezone.now()
            return Response({
                "selectedDates": selected_dates,
                "currentMonth": now.strftime("%Y-%m"),
                "currentYear": now.year,
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def get_busy_times(self, request):
        """
        GET: Return hour slots (HH:MM) for a single date when the detailer has a job.
        Query param: date=YYYY-MM-DD.
        Response: { "date": "YYYY-MM-DD", "busySlots": ["09:00", "10:00", ...] }
        Used when the detailer selects a date so the app can block those slots (read-only).
        """
        try:
            try:
                detailer = Detailer.objects.get(user=request.user)
            except Detailer.DoesNotExist:
                return Response(
                    {"error": "Detailer profile not found"},
                    status=status.HTTP_403_FORBIDDEN,
                )
            date_str = request.query_params.get("date")
            if not date_str:
                return Response(
                    {"error": "Missing required parameter: date (YYYY-MM-DD)"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
            except ValueError:
                return Response(
                    {"error": "Invalid date format. Use YYYY-MM-DD"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            today = timezone.now().date()
            if target_date < today:
                return Response(
                    {"date": date_str, "busySlots": []},
                    status=status.HTTP_200_OK,
                )
            jobs = Job.objects.filter(
                Q(primary_detailer=detailer) | Q(detailers=detailer),
                appointment_date__date=target_date,
                status__in=["pending", "accepted", "in_progress"],
            ).distinct().select_related("service_type")
            busy = set()
            for job in jobs:
                start_min = job.appointment_time.hour * 60 + job.appointment_time.minute
                end_min = start_min + (job.service_type.duration or 0)
                busy |= _range_to_hour_slots(start_min, end_min)
            # Include existing unavailability so those times are not returned as available to mark
            availability_rows = Availability.objects.filter(
                detailer=detailer,
                date=target_date,
            )
            for row in availability_rows:
                start_min = row.start_time.hour * 60 + row.start_time.minute
                end_min = row.end_time.hour * 60 + row.end_time.minute
                busy |= _range_to_hour_slots(start_min, end_min)
            busy_slots = sorted(busy)
            return Response(
                {"date": date_str, "busySlots": busy_slots},
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def create_availability(self, request):
        """
        POST: Save when the detailer is NOT available (unavailability).
        Body: { "selectedDates": [ { "date": "YYYY-MM-DD", "timeSlots": ["06:00", ...] } ] }
        Selected times = when they're off. Replaces unavailability for the given dates.
        """
        try:
            try:
                detailer = Detailer.objects.get(user=request.user)
            except Detailer.DoesNotExist:
                return Response(
                    {"error": "Detailer profile not found"},
                    status=status.HTTP_403_FORBIDDEN,
                )

            data = request.data or {}
            selected_dates = data.get("selectedDates")
            if selected_dates is None:
                return Response(
                    {"error": "selectedDates is required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            today = timezone.now().date()
            valid_hours = {f"{h:02d}:00" for h in range(6, 21)}

            if len(selected_dates) == 0:
                Availability.objects.filter(
                    detailer=detailer,
                    date__gte=today,
                ).delete()
                return Response({
                    "selectedDates": [],
                    "currentMonth": today.strftime("%Y-%m"),
                    "currentYear": today.year,
                }, status=status.HTTP_200_OK)

            dates_to_update = []
            for item in selected_dates:
                date_str = item.get("date")
                time_slots = item.get("timeSlots") or []
                if not date_str:
                    continue
                try:
                    d = datetime.strptime(date_str, "%Y-%m-%d").date()
                except (ValueError, TypeError):
                    return Response(
                        {"error": f"Invalid date format: {date_str}. Use YYYY-MM-DD"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if d < today:
                    continue
                times = []
                for ts in time_slots:
                    if isinstance(ts, dict):
                        t = ts.get("time")
                        if ts.get("isSelected") and t and t in valid_hours:
                            times.append(t)
                    elif isinstance(ts, str) and ts in valid_hours:
                        times.append(ts)
                dates_to_update.append((d, times))

            def _job_hours_on_date(detailer_obj, date_obj):
                out = set()
                jobs = Job.objects.filter(
                    Q(primary_detailer=detailer_obj) | Q(detailers=detailer_obj),
                    appointment_date__date=date_obj,
                    status__in=["pending", "accepted", "in_progress"],
                ).distinct().select_related("service_type")
                for job in jobs:
                    start_min = job.appointment_time.hour * 60 + job.appointment_time.minute
                    end_min = start_min + (job.service_type.duration or 0)
                    out |= _range_to_hour_slots(start_min, end_min)
                return out

            for d, time_strings in dates_to_update:
                job_hours = _job_hours_on_date(detailer, d)
                overlapping = [t for t in time_strings if t in job_hours]
                if overlapping:
                    sample = sorted(overlapping)[:3]
                    sample_str = ", ".join(sample)
                    return Response(
                        {
                            "error": (
                                "Cannot set unavailability for times that have an existing appointment "
                                f"(e.g. {sample_str}). Remove those times and try again."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            for d, _ in dates_to_update:
                Availability.objects.filter(detailer=detailer, date=d).delete()

            for d, time_strings in dates_to_update:
                job_hours = _job_hours_on_date(detailer, d)
                unavail_times = [t for t in time_strings if t not in job_hours]
                for start_t, end_t in _merge_times_to_ranges(unavail_times):
                    Availability.objects.create(
                        detailer=detailer,
                        date=d,
                        start_time=start_t,
                        end_time=end_t,
                        is_available=False,
                    )

            now = timezone.now()
            return Response({
                "selectedDates": [{"date": d.isoformat(), "timeSlots": tlist} for d, tlist in dates_to_update],
                "currentMonth": now.strftime("%Y-%m"),
                "currentYear": now.year,
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
