from django.contrib import admin
from django import forms
from .models import ServiceType, Job, Earning, BankAccount, Review, TrainingRecord, Detailer, User, TimeSlot, Availability, Notification, TermsAndConditions, JobFleetMaintenance, JobImage, JobActivityLog, PayoutHistory

admin.site.site_header = "Prisma Valet Detailer Admin"
admin.site.site_title = "Prisma Valet Detailer  Admin"
admin.site.index_title = "Welcome to Prisma Valet Admin Panel"

# Custom form for ServiceType to handle description as textarea
class ServiceTypeForm(forms.ModelForm):
    description_text = forms.CharField(
        widget=forms.Textarea(attrs={'rows': 4, 'cols': 50}),
        help_text="Enter each service item on a new line. These will be stored as an array.",
        required=False
    )
    
    class Meta:
        model = ServiceType
        fields = '__all__'
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance and self.instance.pk:
            # Convert JSON array back to text for editing
            if self.instance.description:
                self.fields['description_text'].initial = '\n'.join(self.instance.description)
    
    def save(self, commit=True):
        instance = super().save(commit=False)
        # Convert textarea input to JSON array
        description_text = self.cleaned_data.get('description_text', '')
        if description_text:
            # Split by newlines and filter out empty lines
            description_array = [line.strip() for line in description_text.split('\n') if line.strip()]
            instance.description = description_array
        else:
            instance.description = []
        
        if commit:
            instance.save()
        return instance

# Custom form for Job to handle loyalty_benefits as textarea
class JobForm(forms.ModelForm):
    loyalty_benefits_text = forms.CharField(
        widget=forms.Textarea(attrs={'rows': 4, 'cols': 50}),
        help_text="Enter each loyalty benefit on a new line. These will be stored as an array of strings.",
        required=False
    )
    
    class Meta:
        model = Job
        fields = '__all__'
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance and self.instance.pk:
            # Convert JSON array back to text for editing
            if self.instance.loyalty_benefits:
                self.fields['loyalty_benefits_text'].initial = '\n'.join(self.instance.loyalty_benefits)
    
    def save(self, commit=True):
        instance = super().save(commit=False)
        # Convert textarea input to JSON array
        loyalty_benefits_text = self.cleaned_data.get('loyalty_benefits_text', '')
        if loyalty_benefits_text:
            # Split by newlines and filter out empty lines
            loyalty_benefits_array = [line.strip() for line in loyalty_benefits_text.split('\n') if line.strip()]
            instance.loyalty_benefits = loyalty_benefits_array
        else:
            instance.loyalty_benefits = []
        
        if commit:
            instance.save()
        return instance
    
@admin.register(ServiceType)
class ServiceTypeAdmin(admin.ModelAdmin):
    form = ServiceTypeForm
    list_display = ('name', 'price', 'duration')
    list_filter = ('price', 'duration')
    search_fields = ('name',)
    
    def get_fields(self, request, obj=None):
        # Exclude the original description field and use our custom one
        fields = list(super().get_fields(request, obj))
        if 'description' in fields:
            fields.remove('description')
        return fields

@admin.register(Job)
class JobAdmin(admin.ModelAdmin):
    form = JobForm
    list_display = ('service_type', 'booking_reference', 'client_name', 'vehicle_registration', 'address', 'city', 'post_code', 'appointment_date', 'primary_detailer', 'loyalty_tier')
    search_fields = ('booking_reference', 'client_name', 'vehicle_registration',)
    list_filter = ('booking_reference', 'client_name', 'loyalty_tier', 'status')
    
    def get_fields(self, request, obj=None):
        # Exclude the original loyalty_benefits field and use our custom one
        fields = list(super().get_fields(request, obj))
        if 'loyalty_benefits' in fields:
            fields.remove('loyalty_benefits')
        return fields

@admin.register(Earning)
class EarningAdmin(admin.ModelAdmin):
    list_display = ('detailer', 'gross_amount', 'hourly_earnings', 'total_active_hours', 'total_inactive_hours', 'net_amount', 'payout_date', 'payment_status')
    search_fields = ('detailer__user__first_name', 'detailer__user__last_name', 'job__booking_reference', 'job__client_name', 'job__vehicle_registration')
    list_filter = ('payment_status', 'payout_date')

@admin.register(PayoutHistory)
class PayoutHistoryAdmin(admin.ModelAdmin):
    list_display = ('detailer', 'payout_amount', 'status', 'payment_type', 'initiated_at', 'processed_at', 'completed_at')
    search_fields = ('detailer__user__first_name', 'detailer__user__last_name', 'payout_reference')
    list_filter = ('status', 'payment_type', 'initiated_at', 'processed_at', 'completed_at')

@admin.register(BankAccount)
class BankAccountAdmin(admin.ModelAdmin):
    list_display = ('detailer', 'account_name', 'iban', 'is_primary', 'is_verified')
    search_fields = ('detailer__user__first_name', 'detailer__user__last_name', 'account_name', 'iban')
    list_filter = ('is_primary', 'is_verified')

@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ('job', 'rating', 'comment', 'created_at')
    search_fields = ('job__client_name', 'job__vehicle_registration', 'comment')
    list_filter = ('rating', 'created_at')

@admin.register(TrainingRecord)
class TrainingRecordAdmin(admin.ModelAdmin):
    list_display = ('detailer', 'title', 'status', 'date_completed')
    search_fields = ('detailer__user__first_name', 'detailer__user__last_name', 'title')
    list_filter = ('status', 'date_completed')


@admin.register(JobImage)
class JobImageAdmin(admin.ModelAdmin):
    list_display = ('job', 'image_type', 'segment', 'image', 'uploaded_at')
    search_fields = ('job__client_name', 'job__vehicle_registration', 'image_type', 'segment')
    list_filter = ('uploaded_at', 'image_type', 'segment')

@admin.register(JobFleetMaintenance)
class JobFleetMaintenanceAdmin(admin.ModelAdmin):
    list_display = ('job', 'inspected_by', 'inspected_at')
    search_fields = ('job__client_name', 'job__vehicle_registration', 'inspected_by__first_name', 'inspected_by__last_name')
    list_filter = ('inspected_at', 'inspected_by')

@admin.register(Detailer)
class DetailerAdmin(admin.ModelAdmin):
    list_display = ('user', 'rating', 'city', 'is_active', 'is_verified')
    search_fields = ('user__first_name', 'user__last_name', 'user__email', 'city')
    list_filter = ('is_active', 'is_verified', 'city')

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('email', 'first_name', 'last_name', 'phone', 'is_detailer', 'is_admin', 'is_active')
    search_fields = ('email', 'first_name', 'last_name', 'phone')
    list_filter = ('is_detailer', 'is_admin', 'is_active', 'date_joined')

@admin.register(TimeSlot)
class TimeSlotAdmin(admin.ModelAdmin):
    list_display = ('detailer', 'date', 'start_time', 'end_time', 'is_available', 'is_booked')
    search_fields = ('detailer__user__first_name', 'detailer__user__last_name')
    list_filter = ('date', 'is_available', 'is_booked')

@admin.register(Availability)
class AvailabilityAdmin(admin.ModelAdmin):
    list_display = ('detailer', 'date', 'start_time', 'end_time', 'is_available')
    search_fields = ('detailer__user__first_name', 'detailer__user__last_name')
    list_filter = ('date', 'is_available')

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('user', 'title', 'message', 'type', 'status', 'timestamp', 'is_read')
    search_fields = ('user__first_name', 'title')
    list_filter = ('type', 'status')


@admin.register(TermsAndConditions)
class TermsAndConditionsAdmin(admin.ModelAdmin):
    list_display = ('version', 'last_updated')
    ordering = ('-last_updated',)
