from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework.exceptions import ValidationError
from ..serializer import CustomTokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from django.utils.decorators import method_decorator
from django.http import JsonResponse
from django_ratelimit.decorators import ratelimit
from main.models import User, Detailer
from main.tasks import send_welcome_email


def _auth_rate_limit_block(request):
    return JsonResponse({'detail': 'Too many requests. Try again later.'}, status=429)


# This simply handles the login process and returns the user data
@method_decorator(
    ratelimit(key='ip', rate='5/m', method='POST', block=_auth_rate_limit_block),
    name='post',
)
class CustomTokenObtainPairView(TokenObtainPairView):
    permission_classes = [AllowAny]
    serializer_class = CustomTokenObtainPairSerializer


""" This class is designed to handle the users registration, training, and other onboarding processes.
    Note: only the registration login is handled for now
"""
@method_decorator(
    ratelimit(key='ip', rate='5/m', method='POST', block=_auth_rate_limit_block),
    name='post',
)
class AuthenticationView(APIView):
    permission_classes = [AllowAny]

    """ Create the action handler to route the user to the appropriate view, given the action """
    action_handler = {
        'create_new_user' : 'create_new_user',
    }

    """ Override the post method to route the user to the appropriate view, given the action """
    def post(self, request, *args, **kwargs):
        action = kwargs.get('action')
        if action not in self.action_handler:
            return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)
        
        view = getattr(self, self.action_handler[action])
        return view(request)
    
    """ Create a new user """
    def create_new_user(self, request):
        pass
        try:
            credentials = request.data.get('credentials')
            if not credentials:
                return Response({'error': 'Credentials are required'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Validate required fields
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
            # Create the new user profile and then create the detailer profile
            # using the user object
            profile = Detailer.objects.create(
                user=user,
                address=credentials.get('address'),
                city=credentials.get('city'),
                post_code=credentials.get('postcode'),  # Frontend sends 'postcode', not 'post_code'
                country=credentials.get('country'),
            )

            # Save the user and the profile, then return success message and user data (no tokens)
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
