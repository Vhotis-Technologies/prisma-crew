"""DRF serializers for the detailer API (jobs, auth, media URLs, fleet maintenance)."""
from rest_framework import serializers
from .models import User, Detailer, ServiceType, Job, JobImage, JobFleetMaintenance, Earning, BankAccount, Review, Availability, JobActivityLog
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from main.util.media_helper import get_full_media_url


class UserSerializer(serializers.ModelSerializer):
    """Serialize :class:`main.models.User` for internal/admin use."""

    class Meta:
        model = User
        fields = '__all__'

class DetailerSerializer(serializers.ModelSerializer):
    """Serialize :class:`main.models.Detailer` profile fields."""

    class Meta:
        model = Detailer
        fields = '__all__'

class ServiceTypeSerializer(serializers.ModelSerializer):
    """Serialize :class:`main.models.ServiceType` catalog entries."""

    class Meta:
        model = ServiceType
        fields = '__all__'

class JobImageSerializer(serializers.ModelSerializer):
    """Job before/after image with absolute ``image_url`` for mobile clients."""

    image_url = serializers.SerializerMethodField()
    
    class Meta:
        model = JobImage
        fields = ['id', 'job', 'image_type', 'segment', 'image', 'image_url', 'uploaded_at']
        read_only_fields = ['uploaded_at']
    
    def get_image_url(self, obj):
        """
        Resolve a public URL for the stored image file.

        Args:
            obj: :class:`main.models.JobImage` instance.

        Returns:
            str | None: Absolute media URL or None when no file attached.
        """
        if obj.image:
            return get_full_media_url(obj.image.url)
        return None

class JobFleetMaintenanceSerializer(serializers.ModelSerializer):
    """Fleet inspection checklist captured at job completion."""

    class Meta:
        model = JobFleetMaintenance
        fields = [
            'id', 'job', 'tire_tread_depth', 'tire_condition', 'wiper_status',
            'oil_level', 'coolant_level', 'brake_fluid_level', 'battery_condition',
            'headlights_status', 'taillights_status', 'indicators_status',
            'vehicle_condition_notes', 'damage_report', 'inspected_by', 'inspected_at'
        ]
        read_only_fields = ['inspected_at']

class JobActivityLogSerializer(serializers.ModelSerializer):
    """Time-on-job segments used for hourly earnings calculation."""

    class Meta:
        model = JobActivityLog
        fields = ['id', 'activity_state', 'start_time', 'end_time', 'hours_worked', 'rate_applied', 'amount_earned', 'is_active']

class JobSerializer(serializers.ModelSerializer):
    """
    Full job representation with nested detailers, activity logs, and review fields.

    Review rating/comment are read from :class:`main.models.Review` when present.
    Activity logs are scoped to the requesting detailer when available in context.
    """

    detailers = serializers.SerializerMethodField()
    primary_detailer_name = serializers.SerializerMethodField()
    activity_logs = serializers.SerializerMethodField()
    rating = serializers.SerializerMethodField()
    review_comment = serializers.SerializerMethodField()

    class Meta:
        model = Job
        fields = '__all__'

    def get_rating(self, obj):
        """
        Return the client review rating for this job when a Review exists.

        Args:
            obj: Job instance.

        Returns:
            float | None: Review rating or legacy ``obj.rating`` if defined.
        """
        review = Review.objects.filter(job=obj).first()
        if review is not None:
            return float(review.rating)
        return getattr(obj, 'rating', None) if hasattr(obj, 'rating') else None

    def get_review_comment(self, obj):
        """
        Return trimmed review comment text when present.

        Args:
            obj: Job instance.

        Returns:
            str | None: Comment text or None when missing/blank.
        """
        review = Review.objects.filter(job=obj).first()
        if review is None or not (review.comment or "").strip():
            return None
        return review.comment.strip()

    def get_detailers(self, obj):
        """
        Build a list of assigned detailers for API consumers.

        Args:
            obj: Job instance.

        Returns:
            list[dict]: id, name, email, rating, phone per assigned detailer.
        """
        detailers_data = []
        for detailer in obj.detailers.all():
            detailers_data.append({
                'id': detailer.id,
                'name': detailer.user.get_full_name(),
                'email': detailer.user.email,
                'rating': float(detailer.rating) if detailer.rating else 0.0,
                'phone': detailer.user.phone if hasattr(detailer.user, 'phone') else None,
            })
        return detailers_data
    
    def get_primary_detailer_name(self, obj):
        """
        Primary detailer display name for backward-compatible clients.

        Args:
            obj: Job instance.

        Returns:
            str | None: Full name of ``primary_detailer`` or None.
        """
        if obj.primary_detailer:
            return obj.primary_detailer.user.get_full_name()
        return None
    
    def get_activity_logs(self, obj):
        """
        Serialize activity logs, filtered to the current user's detailer when possible.

        Args:
            obj: Job instance.

        Returns:
            list: Serialized :class:`JobActivityLogSerializer` data.
        """
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            try:
                detailer = Detailer.objects.get(user=request.user)
                logs = obj.activity_logs.filter(detailer=detailer)
            except Detailer.DoesNotExist:
                logs = obj.activity_logs.all()
        else:
            logs = obj.activity_logs.all()
        
        return JobActivityLogSerializer(logs, many=True).data

class EarningSerializer(serializers.ModelSerializer):
    """Serialize :class:`main.models.Earning` payout line items."""

    class Meta:
        model = Earning
        fields = '__all__'

class AvailabilitySerializer(serializers.ModelSerializer):
    """Serialize :class:`main.models.Availability` calendar blocks."""

    class Meta:
        model = Availability
        fields = '__all__'

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    JWT login that embeds detailer profile and verification gate.

    Normalizes email (case-insensitive lookup). Blocks login when the linked
    detailer exists but ``is_verified`` is False.
    """

    def validate(self, attrs):
        """
        Authenticate by email and attach user + detailer fields to the token response.

        Args:
            attrs: Credentials dict (email/password) from the login request.

        Returns:
            dict: JWT tokens plus a ``user`` object for the mobile app.

        Raises:
            ValidationError: When the detailer account is pending admin approval.
        """
        email = attrs.get(self.username_field)
        if email:
            normalized_email = email.strip().lower()
            try:
                user = User.objects.get(email__iexact=normalized_email)
                attrs[self.username_field] = user.email
            except User.DoesNotExist:
                attrs[self.username_field] = normalized_email

        data = super().validate(attrs)
        user = self.user
        try:
            detailer = Detailer.objects.get(user=user)
        except Detailer.DoesNotExist:
            detailer = None

        if detailer and not detailer.is_verified:
            raise serializers.ValidationError("Your account is pending admin approval. Please wait for approval before logging in.")

        data.update({
            'user': {
                'id': user.id,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'email': user.email,
                'phone': getattr(user, 'phone', None),
                'address': detailer.address if detailer else None,
                'city': detailer.city if detailer else None,
                'post_code': detailer.post_code if detailer else None,
                'country': detailer.country if detailer else None,
                'allow_push_notifications': user.allow_push_notifications,
                'allow_email_notifications': user.allow_email_notifications,
                'allow_marketing_emails': user.allow_marketing_emails,
                'is_verified': detailer.is_verified,
            }
        })
        return data
