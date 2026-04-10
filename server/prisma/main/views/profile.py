from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum, Avg, Q
from main.models import Job, Review, Earning, Detailer
from main.utils.redis_geo import update_detailer_location


class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    action_handler = {
        "get_profile_statistics": "_get_profile_statistics",
        "update_push_notification_token": "_update_push_notification_token",
        "update_email_notification_token": "_update_email_notification_token",
        "update_marketing_email_token": "_update_marketing_email_token",
        "get_user_profile": "_get_user_profile",
        "update_location": "_update_location",
    }

    def get(self, request, *args, **kwargs):
        action = kwargs.get('action')
        if action not in self.action_handler:
            return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)
        handler = getattr(self, self.action_handler[action])
        return handler(request)

    def post(self, request, *args, **kwargs):
        action = kwargs.get('action')
        if action not in self.action_handler:
            return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)
        handler = getattr(self, self.action_handler[action])
        return handler(request)

    def patch(self, request, *args, **kwargs):
        action = kwargs.get('action')
        if action not in self.action_handler:
            return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)
        handler = getattr(self, self.action_handler[action])
        return handler(request)
    
    def _get_profile_statistics(self, request):
        try:
            # Get the stats which includes average rating, total bookings, total earnings and reviews
            total_bookings = Job.objects.filter(
                Q(primary_detailer__user=request.user) | Q(detailers__user=request.user)
            ).distinct().count()

            total_earnings = Earning.objects.filter(detailer__user=request.user).aggregate(total=Sum('net_amount'))['total'] or 0

            average_rating = Review.objects.filter(detailer__user=request.user).aggregate(avg_rating=Avg('rating'))['avg_rating'] or 0

            reviews = Review.objects.filter(detailer__user=request.user)

            review_data=[]
            # Loop through this and create a review data object
            for review in reviews:
                review_data.append({
                    'id': review.id,
                    'rating': review.rating,
                    'comment': review.comment,
                    'created_at': review.created_at,
                    'created_by': review.job.client_name
                })

            data = {
                'avg_rating': average_rating,
                'total_bookings': total_bookings,
                'total_earnings': total_earnings,
                'reviews': review_data
            }
            pass
            return Response(data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



    def _update_push_notification_token(self, request):
        try:
            update_value = request.data.get('update')
            
            if update_value is None:
                return Response(
                    {'error': 'Update value is required'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            request.user.allow_push_notifications = update_value
            request.user.save()
            
            return Response({
                'success': True,
                'message': 'Push notification setting updated successfully',
                'value': update_value
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)



    def _update_email_notification_token(self, request):
        try:
            update_value = request.data.get('update')
            
            if update_value is None:
                return Response(
                    {'error': 'Update value is required'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Update the user's email notification setting
            request.user.allow_email_notifications = update_value
            request.user.save()
            
            return Response({
                'success': True,
                'message': 'Email notification setting updated successfully',
                'value': update_value
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)



    def _update_marketing_email_token(self, request):
        try:
            update_value = request.data.get('update')
            
            if update_value is None:
                return Response(
                    {'error': 'Update value is required'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Update the user's marketing email setting
            request.user.allow_marketing_emails = update_value
            request.user.save()
            
            return Response({
                'success': True,
                'message': 'Marketing email setting updated successfully',
                'value': update_value
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def _update_location(self, request):
        """Update detailer's current location (DB + Redis GEO). Authenticated detailer only."""
        try:
            latitude = request.data.get('latitude')
            longitude = request.data.get('longitude')
            if latitude is None or longitude is None:
                return Response(
                    {'error': 'latitude and longitude are required'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                lat_f = float(latitude)
                lng_f = float(longitude)
            except (TypeError, ValueError):
                return Response(
                    {'error': 'latitude and longitude must be valid numbers'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                detailer = Detailer.objects.get(user=request.user)
            except Detailer.DoesNotExist:
                return Response(
                    {'error': 'Detailer profile not found'},
                    status=status.HTTP_404_NOT_FOUND,
                )
            detailer.latitude = lat_f
            detailer.longitude = lng_f
            detailer.save(update_fields=['latitude', 'longitude'])
            try:
                update_detailer_location(detailer.id, lng_f, lat_f)
            except Exception as e:
                # Log but do not fail the request; DB is updated
                import logging
                logging.getLogger(__name__).warning(
                    "Redis GEO update failed for detailer %s: %s", detailer.id, e
                )
            return Response(
                {'success': True, 'message': 'Location updated successfully'},
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

