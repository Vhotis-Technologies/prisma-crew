from rest_framework import serializers
from .models import User, Detailer, ServiceType, TimeSlot, Job, JobImage, JobFleetMaintenance, Earning, BankAccount, Review, TrainingRecord, Availability, JobActivityLog
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from main.util.media_helper import get_full_media_url


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = '__all__'

class DetailerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Detailer
        fields = '__all__'

class ServiceTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceType
        fields = '__all__'

class TimeSlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = TimeSlot
        fields = '__all__'

class JobImageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    
    class Meta:
        model = JobImage
        fields = ['id', 'job', 'image_type', 'segment', 'image', 'image_url', 'uploaded_at']
        read_only_fields = ['uploaded_at']
    
    def get_image_url(self, obj):
        if obj.image:
            return get_full_media_url(obj.image.url)
        return None

class JobFleetMaintenanceSerializer(serializers.ModelSerializer):
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
    class Meta:
        model = JobActivityLog
        fields = ['id', 'activity_state', 'start_time', 'end_time', 'hours_worked', 'rate_applied', 'amount_earned', 'is_active']

class JobSerializer(serializers.ModelSerializer):
    detailers = serializers.SerializerMethodField()
    primary_detailer_name = serializers.SerializerMethodField()
    activity_logs = serializers.SerializerMethodField()
    rating = serializers.SerializerMethodField()

    class Meta:
        model = Job
        fields = '__all__'

    def get_rating(self, obj):
        """Return rating from Review for this job if one exists."""
        review = Review.objects.filter(job=obj).first()
        if review is not None:
            return float(review.rating)
        return getattr(obj, 'rating', None) if hasattr(obj, 'rating') else None

    def get_detailers(self, obj):
        """Return array of detailers assigned to the job"""
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
        """Return primary detailer name for backward compatibility"""
        if obj.primary_detailer:
            return obj.primary_detailer.user.get_full_name()
        return None
    
    def get_activity_logs(self, obj):
        """Return activity logs for the job"""
        # Filter by current user's detailer if available
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
    class Meta:
        model = Earning
        fields = '__all__'

class AvailabilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Availability
        fields = '__all__'

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
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

        # Check if detailer account is verified before allowing login
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
