from django.db.models.signals import post_save
from django.dispatch import receiver
from datetime import timedelta
from django.utils import timezone
from main.models import Job, Notification, JobActivityLog
from main.tasks import send_push_notification, send_job_closing_notification
from decimal import Decimal

@receiver(post_save, sender=Job)
def handle_job_status_change(sender, instance, created, **kwargs):
    """Handle job status changes (reminders, activity logs, closing notification)."""
    if not created:
        if instance.status == 'accepted':
            # 30-min reminder is sent by the periodic task check_upcoming_jobs (main.tasks)
            # to avoid duplicates and ensure correct date/time handling.

            # Create activity log for traveling state when job is accepted
            # Create logs for all detailers assigned to the job
            for detailer in instance.detailers.all():
                # End any existing active logs for this detailer on this job
                JobActivityLog.objects.filter(
                    job=instance,
                    detailer=detailer,
                    is_active=True
                ).update(
                    end_time=timezone.now(),
                    is_active=False
                )
                # Calculate hours and amount for ended logs
                for log in JobActivityLog.objects.filter(
                    job=instance,
                    detailer=detailer,
                    is_active=False,
                    end_time__isnull=False
                ):
                    log.calculate_hours_and_amount()
                    log.save()
                
                # Create new traveling log
                JobActivityLog.objects.create(
                    job=instance,
                    detailer=detailer,
                    activity_state='traveling',
                    start_time=timezone.now(),
                    rate_applied=Decimal('9.00'),
                    is_active=True
                )
        
        # Schedule 15-minute closing notification when job status changes to in_progress
        elif instance.status == 'in_progress':
            # Create activity log for active state when job starts
            # End traveling logs and start active logs for all detailers
            for detailer in instance.detailers.all():
                # End any active traveling logs
                traveling_logs = JobActivityLog.objects.filter(
                    job=instance,
                    detailer=detailer,
                    activity_state='traveling',
                    is_active=True
                )
                for log in traveling_logs:
                    log.end_time = timezone.now()
                    log.is_active = False
                    log.calculate_hours_and_amount()
                    log.save()
                
                # Create new active log
                JobActivityLog.objects.create(
                    job=instance,
                    detailer=detailer,
                    activity_state='active',
                    start_time=timezone.now(),
                    rate_applied=Decimal('15.00'),
                    is_active=True
                )
            # Calculate closing notification time (15 minutes before appointment ends)
            appointment_datetime = timezone.datetime.combine(
                instance.appointment_date.date(), 
                instance.appointment_time
            )
            appointment_datetime = timezone.make_aware(appointment_datetime)
            
            # Add duration to get end time (duration is in minutes)
            duration_minutes = int(instance.duration or 0)
            end_time = appointment_datetime + timedelta(minutes=duration_minutes)
            closing_notification_time = end_time - timedelta(minutes=15)
            now = timezone.now()
            
            # Only schedule if the closing notification time is in the future
            if closing_notification_time > now:
                # Schedule the dedicated closing notification task to execute at the exact time
                send_job_closing_notification.apply_async(
                    args=[instance.id],
                    eta=closing_notification_time
                )
                pass
            else:
                pass
        
        elif instance.status in ['completed', 'cancelled']:
            if instance.status == 'completed':
                for detailer in instance.detailers.all():
                    active_logs = JobActivityLog.objects.filter(
                        job=instance,
                        detailer=detailer,
                        is_active=True
                    )
                    for log in active_logs:
                        log.end_time = timezone.now()
                        log.is_active = False
                        log.calculate_hours_and_amount()
                        log.save()
