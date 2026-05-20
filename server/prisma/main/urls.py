"""
URL routing for the detailer API (v1).

Maps authentication, bookings, appointments, banking, earnings, notifications,
password reset, and internal support endpoints. Serves media files in DEBUG.
"""
from django.urls import path
from django.conf import settings
from django.conf.urls.static import static
from main.views.authentication import AuthenticationView, CustomTokenObtainPairView
from main.views.authentication import TokenRefreshView
from main.views.availability import AvailabilityView    
from main.views.dashboard import DashboardView
from main.views.booking import BookingView
from main.views.appointment import AppointmentView
from main.views.banking import BankingView  
from main.views.profile import ProfileView
from main.views.earning import EarningView
from main.views.notifications import NotificationsView
from main.views.terms import TermsView
from .views.password_reset import RequestPasswordResetView, ResetPasswordView, ValidateResetTokenView, WebResetPasswordView
from main.views.support.support_crew import CrewView
from main.views.support.support_jobs import SupportJobsView
from main.views.support.support_payouts import SupportPayoutsView

app_name = 'main'
urlpatterns = [
    path('onboard/<str:action>/', AuthenticationView.as_view(), name='onboard'),
    path('authentication/login/', CustomTokenObtainPairView.as_view(), name='login'),
    path('authentication/refresh/', TokenRefreshView.as_view(), name='refresh'),
    path('availability/<str:action>/', AvailabilityView.as_view(), name='availability'),
    path('dashboard/<str:action>/', DashboardView.as_view(), name='dashboard'),
    path('booking/<str:action>/', BookingView.as_view(), name='booking'),
    path('appointments/<str:action>/', AppointmentView.as_view(), name='appointments'),
    path('banking/<str:action>/', BankingView.as_view(), name='banking'),
    path('profile/<str:action>/', ProfileView.as_view(), name='profile'),
    path('earnings/<str:action>/', EarningView.as_view(), name='earnings'),
    path('terms/<str:action>/', TermsView.as_view(), name='terms'),
    path('notifications/<str:action>/', NotificationsView.as_view(), name='notifications'),
    # Password reset endpoints
    path('auth/password-reset/', RequestPasswordResetView.as_view(), name='request_password_reset'),
    path('auth/validate-reset-token/', ValidateResetTokenView.as_view(), name='validate_reset_token'),
    path('auth/reset-password/', ResetPasswordView.as_view(), name='reset_password'),
    path('auth/web-reset-password/', WebResetPasswordView.as_view(), name='web_reset_password'),

    # The following endpoints are for the support team
    path('support/crew/<str:action>/', CrewView.as_view(), name='crew'),
    path('support/jobs/<str:action>/', SupportJobsView.as_view(), name='support_jobs'),
    path('support/payouts/<str:action>/', SupportPayoutsView.as_view(), name='support_payouts'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)        
