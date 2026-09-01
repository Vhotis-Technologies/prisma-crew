"""
Detailer-service domain models.

Covers crew accounts, jobs synced from the client platform, time-based earnings,
encrypted payout bank details, reviews, and payout lifecycle records. Jobs completed
on the detailer app drive ``Earning`` rows; ``PayoutHistory`` batches pending earnings
into bank transfers.
"""
from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db.models.functions import Lower
from django.utils import timezone
import math
import uuid
from datetime import timedelta
from django.db.models import Sum, Avg
from main.tasks import send_welcome_email, send_push_notification


# -------------------------------
# User Management
# -------------------------------
class UserManager(BaseUserManager):
    """Create detailer-app users with email as the login identifier."""

    def create_user(self, email, password=None, **extra_fields):
        """
        Create and persist a detailer user with a hashed password.

        Args:
            email: Unique login email; required.
            password: Plain password to hash, or None for unusable password.
            **extra_fields: Extra ``User`` field values (``is_detailer`` defaults True).

        Returns:
            User: The saved user instance.
        """
        if not email:
            raise ValueError("Email is required")
        extra_fields.setdefault("is_detailer", True)
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user
    
    def create_superuser(self, email, password=None, **extra_fields):
        """
        Create a staff/superuser account for Django admin and internal tools.

        Args:
            email: Unique login email.
            password: Plain password to hash.
            **extra_fields: Must include ``is_staff`` and ``is_superuser`` as True.

        Returns:
            User: The saved superuser instance.

        Raises:
            ValueError: If ``is_staff`` or ``is_superuser`` is not True.
        """
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        extra_fields.setdefault("is_admin", True)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")
        return self.create_user(email, password, **extra_fields)
    

class User(AbstractUser):
    """
    Detailer-app account: authentication, notification preferences, and profile.

    Email is the username. New users trigger a welcome email after first save.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=30)
    last_name = models.CharField(max_length=30)
    phone = models.CharField(max_length=15, unique=True)
    image = models.ImageField(upload_to="profile_images/", null=True, blank=True)
    is_detailer = models.BooleanField(default=False)
    is_admin = models.BooleanField(default=False)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    allow_marketing_emails = models.BooleanField(default=False)
    allow_push_notifications = models.BooleanField(default=True)
    allow_email_notifications = models.BooleanField(default=True)
    notification_token = models.TextField(null=True, blank=True)
    date_joined = models.DateTimeField(auto_now_add=True)
    last_login = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name"]

    def __str__(self):
        return self.email
    
    
    def get_full_name(self):
        """
        Return display name from first and last name.

        Returns:
            str: ``"{first_name} {last_name}"``.
        """
        return f"{self.first_name} {self.last_name}"
    
    def save(self, *args, **kwargs):
        """
        Keep ``username`` in sync with email and queue welcome email on create.

        Args:
            *args: Passed to ``AbstractUser.save``.
            **kwargs: Passed to ``AbstractUser.save``.

        Returns:
            None
        """
        self.username = self.email
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new:
            send_welcome_email.delay(self.email)


# -------------------------------
# Detailer
# -------------------------------
class Detailer(models.Model):
    """
    Crew profile linked to a ``User``: location, availability flags, and performance rating.

    Earnings and jobs hang off this record. Rating can come from job scores or ``Review`` rows.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE )
    rating = models.FloatField(default=0, blank=True, null=True)
    address = models.CharField(max_length=120, blank=True, null=True)
    city = models.CharField(max_length=55, blank=True, null=True)
    post_code = models.CharField(max_length=10, blank=True, null=True)
    country = models.CharField(max_length=55, blank=True, null=True)
    latitude = models.FloatField(blank=True, null=True)
    longitude = models.FloatField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    is_verified = models.BooleanField(default=False)
    is_available = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.user.get_full_name()} - {self.user.email}'

    def total_earnings(self):
        """
        Sum net amounts across all earnings for this detailer.

        Returns:
            Decimal | int: Total net earnings, or 0 if none.
        """
        return self.earnings.aggregate(total=Sum("net_amount"))["total"] or 0

    def unpaid_earnings(self):
        """
        Sum net amounts for earnings still awaiting payout.

        Returns:
            Decimal | int: Total pending net earnings, or 0 if none.
        """
        return self.earnings.aggregate(total=Sum("net_amount"))["total"] or 0

    def update_rating_from_reviews(self):
        """
        Recompute ``rating`` from the average of all ``Review`` rows for this detailer.

        Caps the stored value at 5.0; sets 0.0 when there are no reviews.

        Returns:
            None
        """
        from django.db.models import Avg
        result = Review.objects.filter(detailer=self).aggregate(avg_rating=Avg('rating'))
        avg_rating = result['avg_rating']
        if avg_rating is not None:
            new_rating = min(round(float(avg_rating), 2), 5.0)
        else:
            new_rating = 0.0
        Detailer.objects.filter(pk=self.pk).update(rating=new_rating)

    def check_for_deactivation(self):
        """
        Deactivate detailer when recent review quality falls below platform thresholds.

        Rules (only evaluated after at least 10 reviews in the last 20):
        - 3+ ratings <= 2.0 in the last 20 reviews, or
        - 2+ ratings of 1.0 in the last 15 reviews.

        On deactivation, clears ``is_active`` and ``is_available`` and may send a push.

        Returns:
            tuple[bool, str]: ``(True, reason)`` if deactivated this call;
            ``(False, "")`` otherwise.
        """
        last_20_reviews = list(Review.objects.filter(detailer=self).order_by('-created_at')[:20])
        last_15_reviews = last_20_reviews[:15]

        if len(last_20_reviews) < 10:
            return False, ""

        poor_ratings_count = sum(1 for r in last_20_reviews if float(r.rating) <= 2.0)
        very_poor_ratings_count = sum(1 for r in last_15_reviews if float(r.rating) == 1.0)

        should_deactivate = False
        deactivation_reason = ""

        if poor_ratings_count >= 3:
            should_deactivate = True
            deactivation_reason = f"Poor performance: {poor_ratings_count} ratings of 2.0 or below in last 20 rated jobs. Please speak to support if you think this is a mistake."
        elif very_poor_ratings_count >= 2:
            should_deactivate = True
            deactivation_reason = f"Very poor performance: {very_poor_ratings_count} ratings of 1.0 in last 15 rated jobs. Please speak to support if you think this is a mistake."

        if should_deactivate and self.is_active:
            self.is_active = False
            self.is_available = False
            self.save()

            if self.user.allow_push_notifications and self.user.notification_token:
                send_push_notification.delay(
                    self.user.id,
                    "Account Deactivated",
                    deactivation_reason,
                    "deactivated"
                )
            return True, deactivation_reason

        return False, ""


# -------------------------------
# Service Type
# -------------------------------
class ServiceType(models.Model):
    """Catalog service offered on jobs (name, duration, price, marketing copy)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120)  # e.g. "Full Interior Clean"
    description = models.JSONField(blank=True, null=True, default=dict)
    duration = models.IntegerField(default=0)  # in minutes
    price = models.FloatField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                Lower("name"),
                name="main_servicetype_name_lower_uniq",
            ),
        ]

    def __str__(self):
        return f"{self.name}"


# -------------------------------
# Availability
# -------------------------------
class Job(models.Model):
    """
    Client booking mirrored on the detailer service (assignments, status, pricing).

    Completed jobs auto-create ``Earning`` rows per assigned detailer. Status flows
    include pending → accepted → in_progress → completed or cancelled.
    """

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    LOYALTY_TIER_CHOICES = [
        ('bronze', 'Bronze'),
        ('silver', 'Silver'),
        ('gold', 'Gold'),
        ('platinum', 'Platinum'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    service_type = models.ForeignKey(ServiceType, on_delete=models.CASCADE)

    booking_reference = models.CharField(max_length=120, unique=True)
    client_name = models.CharField(max_length=120)
    client_phone = models.CharField(max_length=15)

    vehicle_registration = models.CharField(max_length=15)
    vehicle_make = models.CharField(max_length=55)
    vehicle_model = models.CharField(max_length=55)
    vehicle_color = models.CharField(max_length=55)
    vehicle_year = models.IntegerField(blank=True, null=True)
    owner_note = models.TextField(blank=True, null=True)
    address = models.CharField(max_length=120)
    city = models.CharField(max_length=55)
    post_code = models.CharField(max_length=10)
    country = models.CharField(max_length=55)
    latitude = models.FloatField(blank=True, null=True)
    longitude = models.FloatField(blank=True, null=True)
    appointment_date = models.DateTimeField()
    appointment_time = models.TimeField()
    duration = models.IntegerField(default=0, blank=True, null=True)
    addon_names = models.JSONField(default=list, blank=True)  # list of addon names from client
    valet_type = models.CharField(max_length=20, default=None, null=True, blank=True)
    total_amount = models.DecimalField(default=0, blank=True, null=True, max_digits=6, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    loyalty_tier = models.CharField(max_length=20, choices=LOYALTY_TIER_CHOICES, default='bronze')
    loyalty_benefits = models.JSONField(default=list, blank=True, null=True)
    detailers = models.ManyToManyField(Detailer, related_name="jobs", blank=True)
    primary_detailer = models.ForeignKey(Detailer, on_delete=models.SET_NULL, null=True, blank=True, related_name="primary_jobs")
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=0, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['primary_detailer', 'status', 'appointment_date', 'appointment_time', 'booking_reference']),
        ]

    def slot_duration_minutes(self) -> int:
        """
        Minutes this job occupies on the calendar.

        Prefers ``duration`` stored at create time; falls back to catalog then 60.
        """
        try:
            stored = int(self.duration or 0)
        except (TypeError, ValueError):
            stored = 0
        if stored > 0:
            return stored
        catalog = getattr(self.service_type, "duration", None) or 0
        try:
            catalog = int(catalog)
        except (TypeError, ValueError):
            catalog = 0
        return catalog if catalog > 0 else 60

    def create_earning(self):
        """
        Create ``Earning`` rows for each detailer on this job when status is completed.

        Skips detailers that already have an earning for this job. New earnings get
        amounts from activity logs via ``calculate_from_activity_logs``.

        Returns:
            None
        """
        if self.status == "completed":
            # Create earning for each detailer assigned to the job
            for detailer in self.detailers.all():
                # Check if earning already exists to avoid duplicates
                if not Earning.objects.filter(job=self, detailer=detailer).exists():
                    earning = Earning.objects.create(
                        detailer=detailer,
                        job=self,
                        gross_amount=self.total_amount,
                        payout_date=timezone.now().date()  # Set payout date to today
                    )
                    # Calculate earnings from activity logs
                    earning.calculate_from_activity_logs()
                    earning.save()

    def __str__(self):
        detailer_name = self.primary_detailer.user.get_full_name() if self.primary_detailer else "No Detailer"
        return f'Job {self.id} - {detailer_name}'
    
    def save(self, *args, **kwargs):
        """
        Persist the job and ensure earnings exist when marked completed.

        Args:
            *args: Passed to ``Model.save``.
            **kwargs: Passed to ``Model.save``.

        Returns:
            None
        """
        super().save(*args, **kwargs)

        # Create earning if job is completed
        if self.status == "completed":
            self.create_earning()

    
    def update_detailer_rating(self):
        """
        Set primary detailer's ``rating`` from average job ratings on primary jobs.

        Uses jobs where ``rating`` > 0; updates via queryset ``update`` to avoid signals.

        Returns:
            None
        """
        try:
            if not self.primary_detailer:
                return
                
            # Calculate average rating from all jobs where this detailer is primary and has ratings > 0
            avg_rating = Job.objects.filter(
                primary_detailer=self.primary_detailer,
                rating__gt=0
            ).aggregate(avg_rating=Avg('rating'))['avg_rating']
            
            if avg_rating is not None:
                # Round to 2 decimal places and ensure it doesn't exceed 5.0
                self.primary_detailer.rating = min(round(float(avg_rating), 2), 5.0)
            else:
                # No ratings yet, set to 0
                self.primary_detailer.rating = 0.0
            
            # Save the detailer without triggering signals to avoid recursion
            Detailer.objects.filter(pk=self.primary_detailer.pk).update(rating=self.primary_detailer.rating)
            
        except Exception as e:
            # Log the error but don't raise it to avoid breaking the save process
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to update detailer rating: {e}")


# -------------------------------
# Job Activity Log
# -------------------------------
class JobActivityLog(models.Model):
    """
    Time segment for a detailer on a job (travel, wait, or active cleaning).

    Rates: traveling/waiting $9/hr, active cleaning $15/hr. Feeds ``Earning`` calculations.
    """
    ACTIVITY_STATES = [
        ('traveling', 'Traveling/Driving'),  # $9/hour
        ('waiting', 'Waiting'),              # $9/hour
        ('active', 'Active Cleaning'),       # $15/hour
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name='activity_logs')
    detailer = models.ForeignKey(Detailer, on_delete=models.CASCADE)
    activity_state = models.CharField(max_length=20, choices=ACTIVITY_STATES)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField(null=True, blank=True)
    hours_worked = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    rate_applied = models.DecimalField(max_digits=5, decimal_places=2)  # $9 or $15
    amount_earned = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['start_time']
        indexes = [
            models.Index(fields=['job', 'detailer', 'is_active']),
        ]
    
    def calculate_hours_and_amount(self):
        """
        Compute ``hours_worked`` and ``amount_earned`` from start/end and ``rate_applied``.

        Uses ``timezone.now()`` when ``end_time`` is still open.

        Returns:
            tuple[Decimal, Decimal]: ``(hours_worked, amount_earned)`` after updating fields.
        """
        from django.utils import timezone
        from decimal import Decimal
        
        if not self.end_time:
            end = timezone.now()
        else:
            end = self.end_time
        
        delta = end - self.start_time
        hours = delta.total_seconds() / 3600
        self.hours_worked = Decimal(str(round(hours, 2)))
        rate = self.rate_applied if isinstance(self.rate_applied, Decimal) else Decimal(str(self.rate_applied or 0))
        self.amount_earned = self.hours_worked * rate
        return self.hours_worked, self.amount_earned
    
    def __str__(self):
        return f'Activity log for {self.detailer.user.get_full_name()} - {self.activity_state} - Job {self.job.id}'


# -------------------------------
# Job Images
# -------------------------------
def job_image_upload_path(instance, filename):
    """
    Build S3/storage path for job before/after photos by type and segment.

    Args:
        instance: ``JobImage`` being saved (uses ``image_type`` and ``segment``).
        filename: Original upload filename.

    Returns:
        str: Path like ``jobs/images/{before|after}/{segment}/YYYY/MM/DD/{filename}``.
    """
    segment = getattr(instance, 'segment', 'unspecified')
    return f'jobs/images/{instance.image_type}/{segment}/{timezone.now().strftime("%Y/%m/%d")}/{filename}'


class JobImage(models.Model):
    """
    Store multiple before/after images for a job.
    Uploaded by detailer during job execution (camera only for freshness).
    Images are categorized by segment: interior or exterior.
    """
    IMAGE_TYPE_CHOICES = [
        ('before', 'Before'),
        ('after', 'After'),
    ]
    
    SEGMENT_CHOICES = [
        ('interior', 'Interior'),
        ('exterior', 'Exterior'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name='images')
    image_type = models.CharField(max_length=10, choices=IMAGE_TYPE_CHOICES)
    segment = models.CharField(max_length=10, choices=SEGMENT_CHOICES, default='exterior')
    image = models.ImageField(upload_to=job_image_upload_path)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['uploaded_at']
        indexes = [
            models.Index(fields=['job', 'image_type', 'segment']),
            models.Index(fields=['uploaded_at']),
        ]
    
    def __str__(self):
        return f"{self.image_type} {self.segment} image for Job {self.job.id}"


class JobFleetMaintenance(models.Model):
    """
    Store fleet maintenance inspection data for a job.
    Captured by detailer during job completion to help fleet managers maintain vehicle readiness.
    """
    WIPER_STATUS_CHOICES = [
        ('good', 'Good'),
        ('needs_work', 'Needs Work'),
        ('bad', 'Bad'),
    ]
    
    FLUID_LEVEL_CHOICES = [
        ('good', 'Good'),
        ('low', 'Low'),
        ('needs_change', 'Needs Change'),
        ('needs_refill', 'Needs Refill'),
    ]
    
    BATTERY_CONDITION_CHOICES = [
        ('good', 'Good'),
        ('weak', 'Weak'),
        ('replace', 'Replace'),
    ]
    
    LIGHT_STATUS_CHOICES = [
        ('working', 'Working'),
        ('dim', 'Dim'),
        ('not_working', 'Not Working'),
    ]
    
    INDICATOR_STATUS_CHOICES = [
        ('working', 'Working'),
        ('not_working', 'Not Working'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job = models.OneToOneField(Job, on_delete=models.CASCADE, related_name='fleet_maintenance')
    tire_tread_depth = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, help_text="Tire tread depth in mm")
    tire_condition = models.TextField(blank=True, null=True, help_text="Notes about tire condition")
    wiper_status = models.CharField(max_length=20, choices=WIPER_STATUS_CHOICES, null=True, blank=True)
    oil_level = models.CharField(max_length=20, choices=FLUID_LEVEL_CHOICES, null=True, blank=True)
    coolant_level = models.CharField(max_length=20, choices=FLUID_LEVEL_CHOICES, null=True, blank=True)
    brake_fluid_level = models.CharField(max_length=20, choices=FLUID_LEVEL_CHOICES, null=True, blank=True)
    battery_condition = models.CharField(max_length=20, choices=BATTERY_CONDITION_CHOICES, null=True, blank=True)
    headlights_status = models.CharField(max_length=20, choices=LIGHT_STATUS_CHOICES, null=True, blank=True)
    taillights_status = models.CharField(max_length=20, choices=LIGHT_STATUS_CHOICES, null=True, blank=True)
    indicators_status = models.CharField(max_length=20, choices=INDICATOR_STATUS_CHOICES, null=True, blank=True)
    vehicle_condition_notes = models.TextField(blank=True, null=True, help_text="General observations about vehicle condition")
    damage_report = models.TextField(blank=True, null=True, help_text="Notes about any visible damage")
    inspected_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='fleet_inspections')
    inspected_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-inspected_at']
        indexes = [
            models.Index(fields=['job']),
            models.Index(fields=['inspected_at']),
        ]
    
    def __str__(self):
        return f"Fleet maintenance for Job {self.job.id}"


class Earning(models.Model):
    """
    Payable amount for one detailer on one completed job.

    Net pay is derived from ``JobActivityLog`` hourly buckets (active vs inactive rates).
    Linked to ``PayoutHistory`` when a batch payout completes.
    """

    PAYMENT_STATUS = [
        ("pending", "Pending"),
        ("paid", "Paid"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    detailer = models.ForeignKey(Detailer, on_delete=models.CASCADE, related_name="earnings")
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name="earnings")
    gross_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_active_hours = models.DecimalField(max_digits=5, decimal_places=2, default=0)  # hours @ $15/hr
    total_inactive_hours = models.DecimalField(max_digits=5, decimal_places=2, default=0)  # hours @ $9/hr
    hourly_rate_active = models.DecimalField(max_digits=5, decimal_places=2, default=15.00)
    hourly_rate_inactive = models.DecimalField(max_digits=5, decimal_places=2, default=9.00)
    hourly_earnings = models.DecimalField(max_digits=10, decimal_places=2, default=0)  # calculated from hours
    net_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    payout_date = models.DateField(blank=True, null=True)
    payment_status = models.CharField(max_length=10, choices=PAYMENT_STATUS, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Earning for {self.detailer.user.get_full_name()} - Job {self.job.id}"

    def save(self, *args, **kwargs):
        """
        Persist earning; default ``net_amount`` from ``hourly_earnings`` when unset.

        Args:
            *args: Passed to ``Model.save``.
            **kwargs: Passed to ``Model.save``.

        Returns:
            None
        """
        # Calculate net_amount from hourly_earnings if not already set
        if not self.net_amount and self.hourly_earnings:
            self.net_amount = self.hourly_earnings
        super().save(*args, **kwargs)
    
    def calculate_from_activity_logs(self):
        """
        Roll up activity logs into active/inactive hours and ``hourly_earnings`` / ``net_amount``.

        Active state uses ``hourly_rate_active``; traveling/waiting use ``hourly_rate_inactive``.

        Returns:
            Decimal: Total hourly earnings (also stored on ``self.hourly_earnings``).
        """
        from decimal import Decimal
        from django.db.models import Sum
        
        # Coerce rates to Decimal (defaults from model can be float in memory before refresh)
        rate_active = self.hourly_rate_active if isinstance(self.hourly_rate_active, Decimal) else Decimal(str(self.hourly_rate_active if self.hourly_rate_active is not None else 15))
        rate_inactive = self.hourly_rate_inactive if isinstance(self.hourly_rate_inactive, Decimal) else Decimal(str(self.hourly_rate_inactive if self.hourly_rate_inactive is not None else 9))
        
        # Get all activity logs for this job and detailer
        activity_logs = self.job.activity_logs.filter(detailer=self.detailer)
        
        total_active_hours = Decimal('0')
        total_inactive_hours = Decimal('0')
        
        for log in activity_logs:
            hours, amount = log.calculate_hours_and_amount()
            if log.activity_state == 'active':
                total_active_hours += hours
            else:  # traveling, waiting
                total_inactive_hours += hours
        
        self.total_active_hours = total_active_hours
        self.total_inactive_hours = total_inactive_hours
        self.hourly_earnings = (total_active_hours * rate_active) + (total_inactive_hours * rate_inactive)
        self.net_amount = self.hourly_earnings
        return self.hourly_earnings

    def mark_as_paid(self, payout_date=None):
        """
        Mark this earning as paid after a successful payout.

        Args:
            payout_date: Date funds were sent; defaults to None if not supplied.

        Returns:
            None
        """
        # Earning payment_status: pending → paid (via PayoutHistory.mark_as_completed)
        self.payment_status = "paid"
        self.payout_date = payout_date
        self.save()


class BankAccount(models.Model):
    """
    Crew bank account for payout transfers (holder name and IBAN only).

    IBAN is stored encrypted at rest (``enc$`` prefix); use ``get_iban_plain`` /
    ``set_iban_plain`` for application-layer access.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    detailer = models.ForeignKey(Detailer, on_delete=models.CASCADE)
    account_name = models.CharField(max_length=100)
    iban = models.CharField(max_length=512)
    is_primary = models.BooleanField(default=False)
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def get_iban_plain(self) -> str:
        """
        Decrypt stored IBAN for payout APIs or admin display.

        Returns:
            str: Normalized plaintext IBAN, or empty string if missing/decrypt fails.
        """
        from main.utils.pii_encryption import decrypt_iban

        # Decrypt Fernet token (enc$ prefix) for outbound transfer or validation
        return decrypt_iban(self.iban)

    def set_iban_plain(self, plain: str) -> None:
        """
        Encrypt and assign IBAN on the model (does not save).

        Args:
            plain: Raw IBAN from user input.

        Returns:
            None
        """
        from main.utils.pii_encryption import encrypt_iban

        # Encrypt before persistence; save() also encrypts plaintext passed to iban field
        self.iban = encrypt_iban(plain)

    def save(self, *args, **kwargs):
        """
        Encrypt plaintext IBAN before writing to the database.

        Args:
            *args: Passed to ``Model.save``.
            **kwargs: Passed to ``Model.save``.

        Returns:
            None
        """
        if self.iban and not str(self.iban).startswith("enc$"):
            from main.utils.pii_encryption import encrypt_iban

            # At-rest encryption: plaintext from forms/API → enc$… token in DB
            self.iban = encrypt_iban(self.iban)
        super().save(*args, **kwargs)

    def __str__(self):
        from main.utils.pii_encryption import mask_iban

        return f"{self.account_name} - {mask_iban(self.iban)}"

# -------------------------------
# Review
# -------------------------------
class Review(models.Model):
    """Client review for a job, tied to the primary detailer (rating and optional comment)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job = models.OneToOneField(Job, on_delete=models.CASCADE)
    detailer = models.ForeignKey(Detailer, on_delete=models.CASCADE)
    rating = models.DecimalField(max_digits=3, decimal_places=2)
    comment = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Review for {self.detailer.user.get_full_name()} - Job {self.job.id}'
    

class Availability(models.Model):
    """Recurring or one-off availability block for a detailer on a calendar date."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    detailer = models.ForeignKey(Detailer, on_delete=models.CASCADE, related_name="availability")
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_available = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)


class PayoutHistory(models.Model):
    """
    Batch payout to a detailer's bank account (request or scheduled).

    Status progresses pending → processing → completed or failed/cancelled.
    Completing a payout marks linked ``Earning`` rows as paid.
    """

    PAYOUT_STATUS_CHOICES = [
        ("pending", "Pending"),
        ("processing", "Processing"),
        ("completed", "Completed"),
        ("failed", "Failed"),
        ("cancelled", "Cancelled"),
    ]

    PAYOUT_TYPE_CHOICE = [
        ("request", "Request"),
        ("scheduled", "Scheduled")
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    detailer = models.ForeignKey(Detailer, on_delete=models.CASCADE, related_name="payout_history")
    bank_account = models.ForeignKey(BankAccount, on_delete=models.SET_NULL, null=True, blank=True)
    payout_amount = models.DecimalField(max_digits=10, decimal_places=2)
    payout_reference = models.CharField(max_length=100, unique=True, blank=True, null=True)
    status = models.CharField(max_length=20, choices=PAYOUT_STATUS_CHOICES, default="pending")
    payment_type =models.CharField(max_length=20, choices=PAYOUT_TYPE_CHOICE, default='scheduled')
    initiated_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(blank=True, null=True)
    completed_at = models.DateTimeField(blank=True, null=True)
    earnings = models.ManyToManyField(Earning, related_name="payouts")
    failure_reason = models.TextField(blank=True, null=True)
    external_transaction_id = models.CharField(max_length=100, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['detailer', 'status', 'initiated_at']),
            models.Index(fields=['payout_reference']),
        ]
    
    def __str__(self):
        return f"Payout {self.payout_reference or self.id} - {self.detailer.user.get_full_name()} - {self.payout_amount}"
    
    def mark_as_processing(self):
        """
        Move payout to processing when transfer is submitted to the bank/processor.

        Returns:
            None
        """
        # Payout state: pending → processing
        self.status = "processing"
        self.processed_at = timezone.now()
        self.save()
    
    def mark_as_completed(self, external_transaction_id=None):
        """
        Finalize payout as completed and mark all linked earnings paid.

        Args:
            external_transaction_id: Optional processor/bank reference id.

        Returns:
            None
        """
        # Payout state: processing → completed
        self.status = "completed"
        self.completed_at = timezone.now()
        if external_transaction_id:
            self.external_transaction_id = external_transaction_id
        self.save()
        
        # Cascade: each linked Earning pending → paid with payout completion date
        for earning in self.earnings.all():
            earning.mark_as_paid(self.completed_at.date())
    
    def mark_as_failed(self, failure_reason=None):
        """
        Mark payout failed; earnings stay pending for a retry or new payout batch.

        Args:
            failure_reason: Optional processor error message for support.

        Returns:
            None
        """
        # Payout state: processing (or pending) → failed; earnings remain pending
        self.status = "failed"
        if failure_reason:
            self.failure_reason = failure_reason
        self.save()



class Notification(models.Model):
    """
    In-app notification for a detailer user (booking, review, system, etc.).

    May be created by Redis ``appointment_subscriber`` or app views alongside push.
    """

    NOTIFICATION_TYPE_CHOICES = [
        ('booking_confirmed', 'Booking Confirmed'),
        ('booking_cancelled', 'Booking Cancelled'),
        ('booking_rescheduled', 'Booking Rescheduled'),
        ('booking_created', 'Booking Created'),
        ('cleaning_completed', 'Cleaning Completed'),
        ('appointment_started', 'Appointment Started'),
        ('review_received', 'Review Received'),
        ('pending', 'Pending'),
        ('car_ready', 'Car Ready'),
        ('payment_received', 'Payment Received'),
        ('reminder', 'Reminder'),
        ('system', 'System'),
        ('crew_chat', 'Crew Chat'),
    ]
    NOTIFICATION_STATUS_CHOICES = [
        ('success', 'Success'),
        ('warning', 'Warning'),
        ('error', 'Error'),
        ('info', 'Info'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    message = models.TextField()
    type = models.CharField(max_length=255, choices=NOTIFICATION_TYPE_CHOICES, default='pending')
    status = models.CharField(max_length=255, choices=NOTIFICATION_STATUS_CHOICES, default='info')
    timestamp = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.user.first_name} {self.user.last_name} - {self.title}"
    
    def save(self, *args, **kwargs):
        """
        Persist notification record (hook point for future side effects).

        Args:
            *args: Passed to ``Model.save``.
            **kwargs: Passed to ``Model.save``.

        Returns:
            None
        """
        super().save(*args, **kwargs)


class TermsAndConditions(models.Model):
    """Versioned terms of service text shown in the detailer app."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    version = models.CharField(max_length=20, unique=True)
    content = models.TextField()
    last_updated = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Terms and Conditions - {self.version}"


class PrivacyPolicy(models.Model):
    """Versioned privacy policy content for legal acceptance flows."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    version = models.CharField(max_length=20, unique=True)
    content = models.TextField()
    last_updated = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Privacy Policy - {self.version}"


class PasswordResetToken(models.Model):
    """Single-use, time-limited token for password reset emails."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    token = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)
    
    class Meta:
        db_table = 'password_reset_tokens'
    
    def is_expired(self):
        """
        Check whether the token past its expiry timestamp.

        Returns:
            bool: True if current time is after ``expires_at``.
        """
        return timezone.now() > self.expires_at
    
    def is_valid(self):
        """
        Whether the token can still be used for a reset.

        Returns:
            bool: True if not used and not expired.
        """
        return not self.used and not self.is_expired()
    
    def __str__(self):
        return f"Password reset token for {self.user.email}"


# -------------------------------
# Job Reassignment Audit
# -------------------------------
class JobReassignmentAudit(models.Model):
    """Permanent record of every support-driven crew reassignment.

    Captures who triggered it, why, the previous and new assignees, and a
    snapshot of job status at the time so disputes can be reviewed later.
    """

    REASON_CHOICES = [
        ('illness', 'Crew illness'),
        ('emergency', 'Personal emergency'),
        ('vehicle_issue', 'Vehicle / equipment issue'),
        ('no_show', 'Crew no-show'),
        ('schedule_conflict', 'Schedule conflict'),
        ('other', 'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    booking_reference = models.CharField(max_length=120, db_index=True)
    is_bulk = models.BooleanField(default=False)
    is_express = models.BooleanField(default=False)
    job_count = models.PositiveIntegerField(default=1)
    old_detailer_ids = models.JSONField(default=list, blank=True)
    new_detailer_ids = models.JSONField(default=list, blank=True)
    reason_code = models.CharField(max_length=32, choices=REASON_CHOICES, default='other')
    reason_notes = models.TextField(blank=True, default='')
    support_user_id = models.CharField(max_length=120, blank=True, default='')
    support_user_email = models.CharField(max_length=255, blank=True, default='')
    previous_status = models.CharField(max_length=20, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['booking_reference', '-created_at']),
        ]

    def __str__(self):
        return f"Reassignment {self.booking_reference} ({self.reason_code})"
