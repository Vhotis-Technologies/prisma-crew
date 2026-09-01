"""
Django admin registrations for the detailer service.

Custom forms edit JSON list fields (service descriptions, loyalty benefits) as
newline-separated textareas for staff usability.
"""
from django.contrib import admin
from django import forms
from .models import ServiceType, Job, Earning, BankAccount, Review, Detailer, User, Availability, Notification, TermsAndConditions, PrivacyPolicy, JobFleetMaintenance, JobImage, JobActivityLog, PayoutHistory

admin.site.site_header = "Prisma Car Care Detailer Admin"
admin.site.site_title = "Prisma Car Care Detailer Admin"
admin.site.index_title = "Welcome to Prisma Car Care Admin Panel"

class ServiceTypeForm(forms.ModelForm):
    """Admin form: edit ``description`` JSON array as newline-separated lines."""

    description_text = forms.CharField(
        widget=forms.Textarea(attrs={'rows': 4, 'cols': 50}),
        help_text="Enter each service item on a new line. These will be stored as an array.",
        required=False
    )
    
    class Meta:
        model = ServiceType
        fields = '__all__'
    
    def __init__(self, *args, **kwargs):
        """
        Pre-fill the textarea from the stored JSON description array.

        Args:
            *args, **kwargs: Standard ModelForm constructor arguments.
        """
        super().__init__(*args, **kwargs)
        if self.instance and self.instance.pk:
            if self.instance.description:
                self.fields['description_text'].initial = '\n'.join(self.instance.description)
    
    def save(self, commit=True):
        """
        Convert textarea lines back to a JSON string list on the model.

        Args:
            commit: When True, persist the instance to the database.

        Returns:
            ServiceType: Saved instance with ``description`` array updated.
        """
        instance = super().save(commit=False)
        description_text = self.cleaned_data.get('description_text', '')
        if description_text:
            description_array = [line.strip() for line in description_text.split('\n') if line.strip()]
            instance.description = description_array
        else:
            instance.description = []
        
        if commit:
            instance.save()
        return instance

class JobForm(forms.ModelForm):
    """Admin form: edit ``loyalty_benefits`` JSON array as newline-separated lines."""

    loyalty_benefits_text = forms.CharField(
        widget=forms.Textarea(attrs={'rows': 4, 'cols': 50}),
        help_text="Enter each loyalty benefit on a new line. These will be stored as an array of strings.",
        required=False
    )
    
    class Meta:
        model = Job
        fields = '__all__'
    
    def __init__(self, *args, **kwargs):
        """
        Pre-fill the textarea from the stored JSON loyalty_benefits array.

        Args:
            *args, **kwargs: Standard ModelForm constructor arguments.
        """
        super().__init__(*args, **kwargs)
        if self.instance and self.instance.pk:
            if self.instance.loyalty_benefits:
                self.fields['loyalty_benefits_text'].initial = '\n'.join(self.instance.loyalty_benefits)
    
    def save(self, commit=True):
        """
        Convert textarea lines back to a JSON string list on the job.

        Args:
            commit: When True, persist the instance to the database.

        Returns:
            Job: Saved instance with ``loyalty_benefits`` array updated.
        """
        instance = super().save(commit=False)
        loyalty_benefits_text = self.cleaned_data.get('loyalty_benefits_text', '')
        if loyalty_benefits_text:
            loyalty_benefits_array = [line.strip() for line in loyalty_benefits_text.split('\n') if line.strip()]
            instance.loyalty_benefits = loyalty_benefits_array
        else:
            instance.loyalty_benefits = []
        
        if commit:
            instance.save()
        return instance
    
@admin.register(ServiceType)
class ServiceTypeAdmin(admin.ModelAdmin):
    """List/search service types; uses :class:`ServiceTypeForm` for descriptions."""

    form = ServiceTypeForm
    list_display = ('name', 'price', 'duration')
    list_filter = ('price', 'duration')
    search_fields = ('name',)
    
    def get_fields(self, request, obj=None):
        """
        Swap the raw JSON ``description`` field for ``description_text`` in the admin UI.

        Args:
            request: Current admin HTTP request.
            obj: Existing instance when editing, else None.

        Returns:
            list: Field names shown on the change form.
        """
        fields = list(super().get_fields(request, obj))
        if 'description' in fields:
            fields.remove('description')
        return fields

@admin.register(Job)
class JobAdmin(admin.ModelAdmin):
    """Job admin with textarea-backed loyalty benefits."""

    form = JobForm
    list_display = ('service_type', 'booking_reference', 'client_name', 'vehicle_registration', 'address', 'city', 'post_code', 'appointment_date', 'primary_detailer', 'loyalty_tier')
    search_fields = ('booking_reference', 'client_name', 'vehicle_registration',)
    list_filter = ('booking_reference', 'client_name', 'loyalty_tier', 'status')
    
    def get_fields(self, request, obj=None):
        """
        Swap the raw JSON ``loyalty_benefits`` field for ``loyalty_benefits_text``.

        Args:
            request: Current admin HTTP request.
            obj: Existing instance when editing, else None.

        Returns:
            list: Field names shown on the change form.
        """
        fields = list(super().get_fields(request, obj))
        if 'loyalty_benefits' in fields:
            fields.remove('loyalty_benefits')
        return fields

@admin.register(Earning)
class EarningAdmin(admin.ModelAdmin):
    """Browse detailer earnings and payout status."""

    list_display = ('detailer', 'gross_amount', 'hourly_earnings', 'total_active_hours', 'total_inactive_hours', 'net_amount', 'payout_date', 'payment_status')
    search_fields = ('detailer__user__first_name', 'detailer__user__last_name', 'job__booking_reference', 'job__client_name', 'job__vehicle_registration')
    list_filter = ('payment_status', 'payout_date')

@admin.register(PayoutHistory)
class PayoutHistoryAdmin(admin.ModelAdmin):
    """Track initiated and completed detailer payouts."""

    list_display = ('detailer', 'payout_amount', 'status', 'payment_type', 'initiated_at', 'processed_at', 'completed_at')
    search_fields = ('detailer__user__first_name', 'detailer__user__last_name', 'payout_reference')
    list_filter = ('status', 'payment_type', 'initiated_at', 'processed_at', 'completed_at')

@admin.register(BankAccount)
class BankAccountAdmin(admin.ModelAdmin):
    """Manage detailer bank accounts (IBAN may be encrypted at rest)."""

    list_display = ('detailer', 'account_name', 'iban', 'is_primary', 'is_verified')
    search_fields = ('detailer__user__first_name', 'detailer__user__last_name', 'account_name', 'iban')
    list_filter = ('is_primary', 'is_verified')

@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    """Client reviews linked to completed jobs."""

    list_display = ('job', 'rating', 'comment', 'created_at')
    search_fields = ('job__client_name', 'job__vehicle_registration', 'comment')
    list_filter = ('rating', 'created_at')

@admin.register(JobImage)
class JobImageAdmin(admin.ModelAdmin):
    """Before/after job photos by segment."""

    list_display = ('job', 'image_type', 'segment', 'image', 'uploaded_at')
    search_fields = ('job__client_name', 'job__vehicle_registration', 'image_type', 'segment')
    list_filter = ('uploaded_at', 'image_type', 'segment')

@admin.register(JobFleetMaintenance)
class JobFleetMaintenanceAdmin(admin.ModelAdmin):
    """Fleet vehicle inspection data captured on a job."""

    list_display = ('job', 'inspected_by', 'inspected_at')
    search_fields = ('job__client_name', 'job__vehicle_registration', 'inspected_by__first_name', 'inspected_by__last_name')
    list_filter = ('inspected_at', 'inspected_by')

@admin.register(Detailer)
class DetailerAdmin(admin.ModelAdmin):
    """Detailer profiles, verification, and service area."""

    list_display = ('user', 'rating', 'city', 'is_active', 'is_verified')
    search_fields = ('user__first_name', 'user__last_name', 'user__email', 'city')
    list_filter = ('is_active', 'is_verified', 'city')

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    """Detailer/staff user accounts."""

    list_display = ('email', 'first_name', 'last_name', 'phone', 'is_detailer', 'is_admin', 'is_active')
    search_fields = ('email', 'first_name', 'last_name', 'phone')
    list_filter = ('is_detailer', 'is_admin', 'is_active', 'date_joined')

@admin.register(Availability)
class AvailabilityAdmin(admin.ModelAdmin):
    """Recurring or dated availability windows."""

    list_display = ('detailer', 'date', 'start_time', 'end_time', 'is_available')
    search_fields = ('detailer__user__first_name', 'detailer__user__last_name')
    list_filter = ('date', 'is_available')

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    """In-app notifications for detailer users."""

    list_display = ('user', 'title', 'message', 'type', 'status', 'timestamp', 'is_read')
    search_fields = ('user__first_name', 'title')
    list_filter = ('type', 'status')


@admin.register(TermsAndConditions)
class TermsAndConditionsAdmin(admin.ModelAdmin):
    """Versioned terms content for legal pages."""

    list_display = ('version', 'last_updated')
    ordering = ('-last_updated',)


@admin.register(PrivacyPolicy)
class PrivacyPolicyAdmin(admin.ModelAdmin):
    """Versioned privacy policy content for legal pages."""

    list_display = ('version', 'last_updated')
    ordering = ('-last_updated',)
