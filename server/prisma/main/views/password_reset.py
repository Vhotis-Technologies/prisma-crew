"""
Password reset for detailer accounts (API + browser form).

**Auth:** ``AllowAny`` for all endpoints.

**POST (API):** request reset email, validate token, reset password (returns JWT on success).

**GET/POST (web):** ``WebResetPasswordView`` renders HTML form for email deep links.

**Rate limits:** 5 POST/min per IP on API reset endpoints.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from django.contrib.auth.hashers import make_password
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.http import JsonResponse
from django_ratelimit.decorators import ratelimit
from datetime import timedelta
from django.shortcuts import render
from django.conf import settings
import secrets
import hashlib
from main.models import User, PasswordResetToken
from main.tasks import send_password_reset_email
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.exceptions import ValidationError


def _password_reset_rate_limit_block(request):
    """
    Return 429 JSON when password-reset rate limit is exceeded.

    Args:
        request: Incoming HTTP request (unused).

    Returns:
        ``JsonResponse`` with status 429.
    """
    return JsonResponse({'detail': 'Too many requests. Try again later.'}, status=429)


# Rate limit: 5 POST/min per IP — limits reset-email spam and token guessing
@method_decorator(
    ratelimit(key='ip', rate='5/m', method='POST', block=_password_reset_rate_limit_block),
    name='post',
)
class RequestPasswordResetView(APIView):
    """Issue a one-hour reset token and email (response is always generic)."""

    permission_classes = [AllowAny]

    def post(self, request):
        """
        Create reset token and queue email; same message whether email exists.

        Args:
            request: Body ``email``.

        Returns:
            200 with generic success message.
        """
        email = request.data.get('email', '').strip().lower()

        if not email:
            return Response(
                {'error': 'Email is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user = User.objects.get(email=email)

            PasswordResetToken.objects.filter(user=user, used=False).update(used=True)

            token = secrets.token_urlsafe(32)
            expires_at = timezone.now() + timedelta(hours=1)

            PasswordResetToken.objects.create(
                user=user,
                token=token,
                expires_at=expires_at
            )

            send_password_reset_email.delay(user.email, user.get_full_name(), token)

            return Response({
                'message': 'If an account with that email exists, a password reset link has been sent.'
            }, status=status.HTTP_200_OK)

        except User.DoesNotExist:
            return Response({
                'message': 'If an account with that email exists, a password reset link has been sent.'
            }, status=status.HTTP_200_OK)


# Rate limit: 5 POST/min per IP — token validation endpoint
@method_decorator(
    ratelimit(key='ip', rate='5/m', method='POST', block=_password_reset_rate_limit_block),
    name='post',
)
class ValidateResetTokenView(APIView):
    """Check whether a reset token is still valid."""

    permission_classes = [AllowAny]

    def post(self, request):
        """
        Validate token without consuming it.

        Args:
            request: Body ``token``.

        Returns:
            ``valid``, ``expires_at``, ``user_email`` or 400 if invalid/expired.
        """
        token = request.data.get('token', '').strip()

        if not token:
            return Response(
                {'error': 'Token is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            reset_token = PasswordResetToken.objects.get(token=token)

            if not reset_token.is_valid():
                return Response(
                    {'error': 'Invalid or expired token'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            return Response({
                'valid': True,
                'message': 'Token is valid',
                'expires_at': reset_token.expires_at.isoformat(),
                'user_email': reset_token.user.email
            }, status=status.HTTP_200_OK)

        except PasswordResetToken.DoesNotExist:
            return Response(
                {'error': 'Invalid or expired token'},
                status=status.HTTP_400_BAD_REQUEST
            )


# Rate limit: 5 POST/min per IP — password change + JWT issuance
@method_decorator(
    ratelimit(key='ip', rate='5/m', method='POST', block=_password_reset_rate_limit_block),
    name='post',
)
class ResetPasswordView(APIView):
    """Apply new password and return fresh JWT pair for mobile login."""

    permission_classes = [AllowAny]

    def post(self, request):
        """
        Set password from valid token and mark token used.

        Args:
            request: Body ``token``, ``password`` (min 8 chars).

        Returns:
            access/refresh tokens and user summary, or 400 on failure.
        """
        token = request.data.get('token', '').strip()
        new_password = request.data.get('password', '').strip()

        if not token or not new_password:
            return Response(
                {'error': 'Token and new password are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if len(new_password) < 8:
            return Response(
                {'error': 'Password must be at least 8 characters long'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            reset_token = PasswordResetToken.objects.get(token=token)

            if not reset_token.is_valid():
                return Response(
                    {'error': 'Invalid or expired token'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            user = reset_token.user
            user.set_password(new_password)
            user.save()

            reset_token.used = True
            reset_token.save()

            refresh = RefreshToken.for_user(user)
            access_token = str(refresh.access_token)
            refresh_token = str(refresh)

            return Response({
                'message': 'Password reset successfully',
                'access': access_token,
                'refresh': refresh_token,
                'user': {
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'email': user.email,
                    'phone': user.phone,
                }
            }, status=status.HTTP_200_OK)

        except PasswordResetToken.DoesNotExist:
            return Response(
                {'error': 'Invalid or expired token'},
                status=status.HTTP_400_BAD_REQUEST
            )


class WebResetPasswordView(APIView):
    """
    Browser-based reset flow (HTML templates); no rate-limit decorator on class
    (typically linked from email once per user action).
    """

    permission_classes = [AllowAny]

    def get(self, request):
        """
        Display password reset form when token query param is valid.

        Args:
            request: Query ``token``.

        Returns:
            Rendered form, invalid template, or missing-token error page.
        """
        token = request.GET.get('token', '').strip()

        if not token:
            return render(request, 'password_reset_invalid.html', {
                'error': 'Token is required'
            })

        try:
            reset_token = PasswordResetToken.objects.get(token=token)

            if not reset_token.is_valid():
                return render(request, 'password_reset_invalid.html', {
                    'error': 'Invalid or expired token'
                })

            return render(request, 'password_reset_form.html', {
                'token': token,
                'user_email': reset_token.user.email,
                'expires_at': reset_token.expires_at
            })

        except PasswordResetToken.DoesNotExist:
            return render(request, 'password_reset_invalid.html', {
                'error': 'Invalid or expired token'
            })

    def post(self, request):
        """
        Process form POST: validate match/strength, update password, show success page.

        Args:
            request: POST ``token``, ``password``, ``confirm_password``.

        Returns:
            Success or re-rendered form with validation errors.
        """
        token = request.POST.get('token', '').strip()
        new_password = request.POST.get('password', '').strip()
        confirm_password = request.POST.get('confirm_password', '').strip()

        if not token or not new_password or not confirm_password:
            return render(request, 'password_reset_form.html', {
                'token': token,
                'error': 'All fields are required'
            })

        if new_password != confirm_password:
            return render(request, 'password_reset_form.html', {
                'token': token,
                'error': 'Passwords do not match'
            })

        if len(new_password) < 8:
            return render(request, 'password_reset_form.html', {
                'token': token,
                'error': 'Password must be at least 8 characters long'
            })

        if not any(c.islower() for c in new_password):
            return render(request, 'password_reset_form.html', {
                'token': token,
                'error': 'Password must contain at least one lowercase letter'
            })

        if not any(c.isupper() for c in new_password):
            return render(request, 'password_reset_form.html', {
                'token': token,
                'error': 'Password must contain at least one uppercase letter'
            })

        try:
            reset_token = PasswordResetToken.objects.get(token=token)

            if not reset_token.is_valid():
                return render(request, 'password_reset_invalid.html', {
                    'error': 'Invalid or expired token'
                })

            user = reset_token.user
            user.set_password(new_password)
            user.save()

            reset_token.used = True
            reset_token.save()

            return render(request, 'password_reset_success.html', {
                'user_email': user.email
            })

        except PasswordResetToken.DoesNotExist:
            return render(request, 'password_reset_invalid.html', {
                'error': 'Invalid or expired token'
            })
