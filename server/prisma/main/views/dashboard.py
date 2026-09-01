"""
Detailer home dashboard aggregates.

**Auth:** ``IsAuthenticated``.

**GET actions:** ``get_today_overview``, ``get_quick_stats``, ``get_recent_jobs``.

**PATCH actions:** ``start_current_job``, ``complete_current_job`` (shortcut from dashboard card).
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Q
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.utils import timezone
from datetime import datetime, timedelta
from django.db.models import Sum, Avg, Count, Q
from ..models import Detailer, Job, Earning, Review, ServiceType
from ..tasks import publish_job_started, publish_job_completed
import json
import logging

# Set up logging for debugging and error tracking
logger = logging.getLogger(__name__)


class DashboardView(APIView):
    """Today's schedule, earnings KPIs, recent history, and in-card job start/complete."""
    
    permission_classes = [IsAuthenticated] 

    # Map action names to their corresponding handler methods
    action_handler = {
        "get_today_overview": '_get_today_overview',
        "get_quick_stats": '_get_quick_stats',
        "get_recent_jobs": '_get_recent_jobs',
        "start_current_job": '_start_current_job',
        "complete_current_job": '_complete_current_job',
    }   

    def get(self, request, *args, **kwargs):
        """Route GET ``action`` to handler."""
        action = kwargs.get('action')
        if action not in self.action_handler:
            return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)
        handler = getattr(self, self.action_handler[action])
        return handler(request)

    def patch(self, request, *args, **kwargs):
        """Route PATCH ``action`` (start/complete current job) to handler."""
        action = kwargs.get('action')
        if action not in self.action_handler:
            return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)
        handler = getattr(self, self.action_handler[action])
        return handler(request)


    def _get_today_overview(self, request):
        """
        Today's job counts, current in-progress card, and next pending appointment.

        Args:
            request: Authenticated DRF request.

        Returns:
            ``totalAppointments``, ``completedJobs``, ``pendingJobs``, ``currentJob``, ``nextAppointment``.
        """
        try:
            today = timezone.now().date()

            # Get today's jobs for the authenticated detailer
            today_jobs = Job.objects.filter(
                Q(primary_detailer__user=request.user) | Q(detailers__user=request.user),
                appointment_date__date=today,
                status__in=['pending', 'accepted', 'in_progress']
            ).distinct()
            # Calculate basic statistics
            total_appointments = today_jobs.count()
            completed_jobs = today_jobs.filter(status='completed').count()
            pending_jobs = today_jobs.filter(status__in=['pending', 'accepted', 'in_progress']).count()
            
            # Get current job first (job currently in progress)
            current_job = None
            in_progress_job = None
            try:
                # Find the job that's currently in progress or accepted
                in_progress_job = today_jobs.filter(status__in=['in_progress', 'accepted']).first()
                
                if in_progress_job:
                    # Calculate progress (simplified - you might want to track actual progress)
                    progress = 50  # Default progress
                    current_job = {
                        "id": str(in_progress_job.id),
                        "clientName": in_progress_job.client_name if in_progress_job.client_name else "",
                        "serviceType": in_progress_job.service_type.name if in_progress_job.service_type else "",
                        "startTime": in_progress_job.appointment_time.strftime("%H:%M") if in_progress_job.appointment_time else "",
                        "estimatedEndTime": (datetime.combine(today, in_progress_job.appointment_time) + 
                                           timedelta(minutes=in_progress_job.slot_duration_minutes())).strftime("%H:%M") if in_progress_job.appointment_time else "",
                        "progress": progress,
                        "status": in_progress_job.status,
                        "valetType": in_progress_job.valet_type if in_progress_job.valet_type else "",
                        "addons": list(in_progress_job.addon_names or []),
                        "specialInstruction": in_progress_job.owner_note if in_progress_job.owner_note else "",
                        'vehicleInfo': f"{in_progress_job.vehicle_make} {in_progress_job.vehicle_model} ({in_progress_job.vehicle_registration})" if in_progress_job.vehicle_registration else "",
                        "booking_reference": in_progress_job.booking_reference,
                        "clientPhone": in_progress_job.client_phone if in_progress_job.client_phone else "",
                        "address": in_progress_job.address if in_progress_job.address else "",
                    }
            except Exception as e:
                logger.error(f"Error getting current job: {str(e)}")
                current_job = None
            
            # Get next appointment for today (excludes the currently in-progress job)
            next_appointment = None
            try:
                # Get the next pending/accepted job that's not currently in progress
                next_job = today_jobs.filter(
                    status__in=['pending', 'accepted']
                ).exclude(
                    id=in_progress_job.id if in_progress_job else None
                ).order_by('appointment_date').first()
                
                pass
                
                if next_job:
                    next_appointment = {
                        "id": str(next_job.id) if next_job.id else "",
                        "clientName": next_job.client_name if next_job.client_name else "",
                        "serviceType": next_job.service_type.name if next_job.service_type else "",
                        "appointmentTime": next_job.appointment_time.strftime("%H:%M") if next_job.appointment_time else "",
                        "duration": next_job.slot_duration_minutes(),
                        "address": next_job.address if next_job.address else "",
                        "vehicleInfo": f"{next_job.vehicle_make} {next_job.vehicle_model} ({next_job.vehicle_registration})" if next_job.vehicle_registration else "",
                        "valetType": next_job.valet_type if next_job.valet_type else "",
                        "addons": list(next_job.addon_names or []),
                        "specialInstruction": next_job.owner_note if next_job.owner_note else ""
                    }
            except Exception as e:
                logger.error(f"Error getting next appointment: {str(e)}")
                next_appointment = None
            
            # Prepare response data
            data = {
                "totalAppointments": total_appointments,
                "completedJobs": completed_jobs,
                "pendingJobs": pending_jobs,
                "nextAppointment": next_appointment,
                "currentJob": current_job
            }
            
            # Ensure all numeric fields are integers, not None for consistent client handling
            data["totalAppointments"] = int(data["totalAppointments"]) if data["totalAppointments"] is not None else 0
            data["completedJobs"] = int(data["completedJobs"]) if data["completedJobs"] is not None else 0
            data["pendingJobs"] = int(data["pendingJobs"]) if data["pendingJobs"] is not None else 0

            return Response(data, status=status.HTTP_200_OK)
            
        except Detailer.DoesNotExist:
            logger.error("Detailer not found for user")
            return Response(
                {"error": "Detailer profile not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error in _get_today_overview: {str(e)}")
            return Response(
                {"error": "Internal server error", "details": str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )



    def _get_quick_stats(self, request):
        try:
            detailer = Detailer.objects.get(user=request.user)
            today = timezone.now().date()
            
            # Calculate date ranges for weekly and monthly statistics
            week_start = today - timedelta(days=today.weekday())  # Start of current week (Monday)
            month_start = today.replace(day=1)  # Start of current month
            
            # Calculate weekly earnings
            try:
                weekly_paid_earnings = Earning.objects.filter(
                    detailer=detailer,
                    payout_date__gte=week_start,
                    payout_date__lte=today
                ).aggregate(total_net=Sum('net_amount'))
                weekly_net_earnings = weekly_paid_earnings['total_net'] or 0

                weekly_completed_jobs = Job.objects.filter(
                    Q(primary_detailer=detailer) | Q(detailers=detailer),
                    status='completed',
                    appointment_date__date__gte=week_start,
                    appointment_date__date__lte=today
                ).distinct()
                weekly_new_earnings = Earning.objects.filter(
                    detailer=detailer,
                    job__in=weekly_completed_jobs,
                    payout_date__isnull=True
                ).aggregate(total_net=Sum('net_amount'))
                weekly_new_net = weekly_new_earnings['total_net'] or 0

                weekly_earnings = weekly_net_earnings + weekly_new_net
                weekly_total_earnings = weekly_earnings
            except Exception as e:
                logger.error(f"Error calculating weekly earnings: {str(e)}")
                weekly_earnings = 0
                weekly_total_earnings = 0

            # Calculate monthly earnings
            try:
                monthly_paid_earnings = Earning.objects.filter(
                    detailer=detailer,
                    payout_date__gte=month_start,
                    payout_date__lte=today
                ).aggregate(total_net=Sum('net_amount'))
                monthly_net_earnings = monthly_paid_earnings['total_net'] or 0

                monthly_completed_jobs = Job.objects.filter(
                    Q(primary_detailer=detailer) | Q(detailers=detailer),
                    status='completed',
                    appointment_date__date__gte=month_start,
                    appointment_date__date__lte=today
                ).distinct()
                monthly_new_earnings = Earning.objects.filter(
                    detailer=detailer,
                    job__in=monthly_completed_jobs,
                    payout_date__isnull=True
                ).aggregate(total_net=Sum('net_amount'))
                monthly_new_net = monthly_new_earnings['total_net'] or 0

                monthly_earnings = monthly_net_earnings + monthly_new_net
                monthly_total_earnings = monthly_earnings
            except Exception as e:
                logger.error(f"Error calculating monthly earnings: {str(e)}")
                monthly_earnings = 0
                monthly_total_earnings = 0
            
            # Calculate completed jobs this week
            try:
                completed_jobs_this_week = Job.objects.filter(
                    Q(primary_detailer=detailer) | Q(detailers=detailer),
                    status='completed',
                    appointment_date__date__gte=week_start,
                    appointment_date__date__lte=today
                ).distinct().count()
            except Exception as e:
                logger.error(f"Error calculating completed jobs this week: {str(e)}")
                completed_jobs_this_week = 0
            
            # Calculate completed jobs this month
            try:
                completed_jobs_this_month = Job.objects.filter(
                    Q(primary_detailer=detailer) | Q(detailers=detailer),
                    status='completed',
                    appointment_date__date__gte=month_start,
                    appointment_date__date__lte=today
                ).distinct().count()
            except Exception as e:
                logger.error(f"Error calculating completed jobs this month: {str(e)}")
                completed_jobs_this_month = 0
            
            # Calculate pending jobs count (all pending jobs, not just today)
            try:
                pending_jobs_count = Job.objects.filter(
                    Q(primary_detailer=detailer) | Q(detailers=detailer),
                    status__in=['pending', 'accepted']
                ).distinct().count()
            except Exception as e:
                logger.error(f"Error calculating pending jobs count: {str(e)}")
                pending_jobs_count = 0
            
            # Calculate average rating and total reviews from Review model only
            try:
                reviews = Review.objects.filter(detailer=detailer)
                average_rating = reviews.aggregate(avg_rating=Avg('rating'))['avg_rating'] or 0
                total_reviews = reviews.count()
            except Exception as e:
                logger.error(f"Error calculating ratings: {str(e)}")
                average_rating = 0
                total_reviews = 0
            
            # Debug logging
            logger.info(f"Weekly: {weekly_earnings} = {weekly_total_earnings}")
            logger.info(f"Monthly: {monthly_earnings} = {monthly_total_earnings}")
            logger.info(f"Rating: {average_rating} from {total_reviews} reviews")

            data = {
                "weeklyEarnings": float(weekly_total_earnings),
                "weeklyNetEarnings": float(weekly_earnings),
                "monthlyEarnings": float(monthly_total_earnings),
                "monthlyNetEarnings": float(monthly_earnings),
                "completedJobsThisWeek": completed_jobs_this_week,
                "completedJobsThisMonth": completed_jobs_this_month,
                "pendingJobsCount": pending_jobs_count,
                "averageRating": float(average_rating),
                "totalReviews": total_reviews,
            }
            
            return Response(data, status=status.HTTP_200_OK)
            
        except Detailer.DoesNotExist:
            logger.error("Detailer not found for user")
            return Response(
                {"error": "Detailer profile not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error in _get_quick_stats: {str(e)}")
            return Response(
                {"error": "Internal server error", "details": str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


    def _get_recent_jobs(self, request):
        """
        Get recent completed jobs for the authenticated detailer
        
        Retrieves completed jobs from the last 7 days with associated earnings and ratings.
        This provides a history of recent work and performance for the detailer.
        
        Only completed jobs are returned to show actual work history, not pending
        or in-progress jobs.
        
        Args:
            request: The HTTP request object containing the authenticated user
            
        Returns:
            Response: JSON object containing:
                - recentJobs: Array of job objects with:
                    - id: Job identifier
                    - clientName: Name of the client
                    - serviceType: Type of service provided
                    - completedAt: ISO formatted completion date/time
                    - earnings: Amount earned for the job
                    - rating: Client rating (if available)
                    - status: Job status (should be 'completed')
                    
        Raises:
            HTTP_404_NOT_FOUND: If detailer profile doesn't exist
            HTTP_500_INTERNAL_SERVER_ERROR: If database query fails
        """
        try:
            # Get completed jobs from the last 7 days
            seven_days_ago = timezone.now().date() - timedelta(days=7)
            recent_jobs = Job.objects.filter(
                Q(primary_detailer__user=request.user) | Q(detailers__user=request.user),
                appointment_date__date__gte=seven_days_ago,
                status='completed'  # Only completed jobs for history
            ).distinct().order_by('-appointment_date')  # Most recent first
            
            # Process each job to include earnings and ratings
            recent_jobs_data = []
            for job in recent_jobs:
                try:
                    # Get earnings for this job
                    earning = Earning.objects.filter(job=job).first()
                    earnings_amount = float(earning.net_amount) if earning else 0
                    
                    # Get rating for this job
                    review = Review.objects.filter(job=job).first()
                    rating = float(review.rating) if review else None
                    
                    # Build job data object
                    recent_jobs_data.append({
                        "id": str(job.id),
                        "clientName": job.client_name if job.client_name else "", 
                        "serviceType": job.service_type.name if job.service_type else "",
                        "completedAt": job.appointment_date.isoformat() if job.appointment_date else "",
                        "earnings": earnings_amount,
                        "rating": rating,
                        "status": job.status if job.status else ""
                    })
                except Exception as e:
                    logger.error(f"Error processing job {job.id}: {str(e)}")
                    continue  # Skip this job if there's an error
            
            # Prepare response data
            data = {
                "recentJobs": recent_jobs_data,
            }
            
            return Response(data, status=status.HTTP_200_OK)
            
        except Detailer.DoesNotExist:
            logger.error("Detailer not found for user")
            return Response(
                {"error": "Detailer profile not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error in _get_recent_jobs: {str(e)}")
            return Response(
                {"error": "Internal server error", "details": str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
    
    def _start_current_job(self, request):
        """
        Start the current job
        
        Args:
            request: The HTTP request object containing the authenticated user
        """
        try:
            id = request.data.get('id')
            job = Job.objects.filter(
                id=id
            ).filter(
                Q(primary_detailer__user=request.user) | Q(detailers__user=request.user)
            ).distinct().first()
            if job.status != 'in_progress':
                job.status = 'in_progress'
                job.save()
                
                # trigger the job started to redis
                publish_job_started.delay(job.booking_reference)
                
                return Response({"message": "Job started successfully"}, status=status.HTTP_200_OK)
            else:
                return Response({"message": "Job is already in progress"}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error in _start_current_job: {str(e)}")
            return Response(
                {"error": "Internal server error", "details": str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
    def _complete_current_job(self, request):
        """
        Complete the current job
        
        Args:
            request: The HTTP request object containing the authenticated user
            id: The ID of the job to complete

        Returns:
            Response: JSON object containing:
                - message: Success message

        Raises:
            HTTP_404_NOT_FOUND: If job not found
            HTTP_500_INTERNAL_SERVER_ERROR: If error occurs

        """
        try:
            id = request.data.get('id')
            pass
            job = Job.objects.filter(
                id=id
            ).filter(
                Q(primary_detailer__user=request.user) | Q(detailers__user=request.user)
            ).distinct().first()
            if job.status == 'in_progress':
                job.status = 'completed'
                job.save()  # This will trigger the Job model's save method which creates the earning record

                # trigger the job completed to redis
                publish_job_completed.delay(job.booking_reference)

                # Get the earning record that was created by the Job model's save method
                earning = Earning.objects.filter(job=job).first()
                if earning and not earning.payout_date:
                    earning.payout_date = timezone.now().date()
                    earning.save()
                return Response({"message": "Assignment completed successfully."}, status=status.HTTP_200_OK)
            else:
                return Response({"message": "You have already completed this job"}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error in _complete_current_job: {str(e)}")
            return Response(
                {"error": "Internal server error", "details": str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    