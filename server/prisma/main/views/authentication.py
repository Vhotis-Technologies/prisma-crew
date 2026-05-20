"""
Detailer authentication and onboarding.

**Auth:** ``AllowAny`` for login, refresh, and onboarding; JWT issued via
``CustomTokenObtainPairSerializer`` after admin-approved accounts log in.

**POST actions (onboard):** ``create_new_user`` — register detailer + profile (pending approval).

**Rate limits:** login/onboard 5/min per IP; token refresh 30/min per IP.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework.exceptions import ValidationError
from ..serializer import CustomTokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView as BaseTokenRefreshView
from django.utils.decorators import method_decorator
from django.http import JsonResponse
from django_ratelimit.decorators import ratelimit
from main.models import User, Detailer
from main.tasks import send_welcome_email
from main.utils.ratelimit_helpers import rate_limit_json_response


def _auth_rate_limit_block(request):
    """
    Return 429 JSON when login/onboard rate limit is exceeded.

    Args:
        request: Incoming HTTP request (unused; required by django-ratelimit).

    Returns:
        ``JsonResponse`` with status 429.
    """
    return JsonResponse({'detail': 'Too many requests. Try again later.'}, status=429)


# Rate limit: 5 POST/min per IP — brute-force protection on credential login
@method_decorator(
    ratelimit(key='ip', rate='5/m', method='POST', block=_auth_rate_limit_block),
    name='post',
)
class CustomTokenObtainPairView(TokenObtainPairView):
    """JWT login for approved detailers; uses custom serializer for detailer claims."""

    permission_classes = [AllowAny]
    serializer_class = CustomTokenObtainPairSerializer


# Rate limit: 30 POST/min per IP — refresh tokens are less sensitive than passwords
@method_decorator(
    ratelimit(key="ip", rate="30/m", method="POST", block=rate_limit_json_response),
    name="post",
)
class TokenRefreshView(BaseTokenRefreshView):
    """Rotate access token from a valid refresh token."""

    permission_classes = [AllowAny]


# Rate limit: 5 POST/min per IP — registration abuse protection
@method_decorator(
    ratelimit(key='ip', rate='5/m', method='POST', block=_auth_rate_limit_block),
    name='post',
)
class AuthenticationView(APIView):
    """
    Onboarding router (registration today; training flows reserved).

    **Auth:** ``AllowAny``.

    **POST actions:** ``create_new_user``.
    """

    permission_classes = [AllowAny]

    action_handler = {
        'create_new_user': 'create_new_user',
    }

    def post(self, request, *args, **kwargs):
        """
        Dispatch URL ``action`` to the matching handler.

        Args:
            request: DRF request with registration payload in ``credentials``.
            **kwargs: Must include ``action`` (e.g. ``create_new_user``).

        Returns:
            Handler ``Response`` or 400 for unknown actions.
        """
        action = kwargs.get('action')
        if action not in self.action_handler:
            return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)

        view = getattr(self, self.action_handler[action])
        return view(request)

    def create_new_user(self, request):
        """
        Register a new detailer user and ``Detailer`` profile (pending admin approval).

        Args:
            request: Body ``credentials`` with email, password, name, phone, address fields.

        Returns:
            201 with user summary, or 400/500 on validation or server errors.
        """
        try:
            credentials = request.data.get('credentials')
            if not credentials:
                return Response({'error': 'Credentials are required'}, status=status.HTTP_400_BAD_REQUEST)

            required_fields = ['email', 'password', 'first_name', 'last_name', 'phone', 'address', 'city', 'postcode', 'country']
            missing_fields = [field for field in required_fields if not credentials.get(field)]
            if missing_fields:
                return Response({'error': f'Missing required fields: {", ".join(missing_fields)}'}, status=status.HTTP_400_BAD_REQUEST)

            user = User.objects.create_user(
                email=credentials.get('email'),
                password=credentials.get('password'),
                first_name=credentials.get('first_name'),
                last_name=credentials.get('last_name'),
                phone=credentials.get('phone'),
                is_detailer=True,
                username=credentials.get('email'),
            )
            user.save()
            profile = Detailer.objects.create(
                user=user,
                address=credentials.get('address'),
                city=credentials.get('city'),
                post_code=credentials.get('postcode'),
                country=credentials.get('country'),
            )

            user.save()
            profile.save()
            return Response({
                'message': 'Account created successfully. Your account is pending admin approval.',
                'user': {
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'email': user.email,
                    'phone': user.phone,
                    'address': profile.address,
                    'city': profile.city,
                    'postcode': profile.post_code,
                    'country': profile.country,
                },
            }, status=status.HTTP_201_CREATED)

        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': f'An error occurred while creating the user: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
