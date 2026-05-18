from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.db.models import Q
from main.models import Job, JobImage, JobFleetMaintenance, Detailer
from main.serializer import JobImageSerializer, JobFleetMaintenanceSerializer, JobSerializer
from datetime import datetime
from main.util.media_helper import get_full_media_url
from main.tasks import publish_job_started, publish_job_completed
# from channels.layers import get_channel_layer
# from asgiref.sync import async_to_sync
# from main.task import send_job_accepted_email

# Required count per segment for start/complete matches max allowed per segment.
MAX_SEGMENT_JOB_IMAGES = 4


class AppointmentView(APIView):
    permission_classes = [IsAuthenticated]

    action_handler = {
        "get_all_appointments": '_get_all_appointments',
        "get_appointment_details": '_get_appointment_details',
        "complete_appointment": '_complete_appointment',
        "start_appointment": '_start_appointment',
        "upload_before_images": '_upload_before_images',
        "upload_after_images": '_upload_after_images',
        "submit_fleet_maintenance": '_submit_fleet_maintenance',
    }   

    def get(self, request, *args, **kwargs):
        action = kwargs.get('action')
        if action not in self.action_handler:
            return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)
        handler = getattr(self, self.action_handler[action])
        return handler(request)
    
    """ Override the patch method here.
        This will be used to update the detailers appointments
    """
    def patch(self, request, *args, **kwargs):
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
    

    def _get_all_appointments(self, request):
        try:
            # Get the date from the request and use the date to query the jobs
            # model.
            date = datetime.strptime(request.query_params.get('date'), '%Y-%m-%d').date()
            # Get jobs where user is either primary_detailer or in detailers ManyToMany
            appointments = Job.objects.filter(
                appointment_date__date=date
            ).filter(
                Q(primary_detailer__user=request.user) | Q(detailers__user=request.user)
            ).distinct().exclude(status='cancelled')
            # Return the appointments in a list if it exists
            appointment_list = []
            if appointments.exists():
                for appointment in appointments:
                    appointment_data = {
                        'id': appointment.id,
                        'booking_reference': appointment.booking_reference,
                        'service_type': appointment.service_type.name,
                        'client_name': appointment.client_name,
                        'valet_type': appointment.valet_type,
                        'appointment_date': appointment.appointment_date.strftime('%Y-%m-%d'),
                        'appointment_time': appointment.appointment_time.strftime('%H:%M'),
                        'duration': appointment.service_type.duration if appointment.service_type.duration else 0,
                        'status': appointment.status,
                    }
                    appointment_list.append(appointment_data)
            else:
                return Response({"error": "No appointments found for this date"}, status=status.HTTP_200_OK)
            # Return the appointments in a list if it exists
            return Response(appointment_list, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        
    
    def _get_appointment_details(self, request):
        try:
            # Get job where user is either primary_detailer or in detailers ManyToMany
            appointment = Job.objects.filter(
                id=request.query_params.get('id'),
                status__in=['pending', 'accepted', 'in_progress', 'completed']
            ).filter(
                Q(primary_detailer__user=request.user) | Q(detailers__user=request.user)
            ).distinct().first()
            
            if not appointment:
                return Response({"error": "Appointment Details not found"}, status=status.HTTP_404_NOT_FOUND)
            
            appointment_detaile = {
                'id': appointment.id,
                'booking_reference': appointment.booking_reference,
                'client_name': appointment.client_name if appointment.client_name else '',
                'client_phone': appointment.client_phone if appointment.client_phone else '',
                'vehicle_make': appointment.vehicle_make if appointment.vehicle_make else '',
                'vehicle_model': appointment.vehicle_model if appointment.vehicle_model else '',
                'vehicle_color': appointment.vehicle_color if appointment.vehicle_color else '',
                'vehicle_year': appointment.vehicle_year if appointment.vehicle_year else '',
                'vehiclie_license': appointment.vehicle_registration if appointment.vehicle_registration else '',
                'service_type': {
                    'name': appointment.service_type.name if appointment.service_type.name else '',
                    'description': appointment.service_type.description if appointment.service_type.description else [],
                    'duration': appointment.service_type.duration if appointment.service_type.duration else 0,
                    'price': appointment.service_type.price if appointment.service_type.price else 0,
                } if appointment.service_type else None,
                'address': appointment.address if appointment.address else '',
                'city': appointment.city if appointment.city else '',
                'post_code': appointment.post_code if appointment.post_code else '',
                'country': appointment.country if appointment.country else '',
                'latitude': appointment.latitude if appointment.latitude else '',
                'longitude': appointment.longitude if appointment.longitude else '',
                'appointment_date': appointment.appointment_date.strftime('%Y-%m-%d'),
                'appointment_time': appointment.appointment_time.strftime('%H:%M'),
                'duration': appointment.duration if appointment.duration else 0,
                'status': appointment.status,
                'special_instruction': appointment.owner_note if appointment.owner_note else '',
                'valet_type': appointment.valet_type if appointment.valet_type else '',
                'addons': list(appointment.addon_names or []),
                'loyalty_tier': appointment.loyalty_tier if appointment.loyalty_tier else 'bronze',
                'loyalty_benefits': appointment.loyalty_benefits if appointment.loyalty_benefits else [],
                'before_images_interior': [
                    {
                        'id': img.id,
                        'image_url': get_full_media_url(img.image.url),
                        'uploaded_at': img.uploaded_at.isoformat(),
                        'segment': img.segment
                    } for img in appointment.images.filter(image_type='before', segment='interior')
                ],
                'before_images_exterior': [
                    {
                        'id': img.id,
                        'image_url': get_full_media_url(img.image.url),
                        'uploaded_at': img.uploaded_at.isoformat(),
                        'segment': img.segment
                    } for img in appointment.images.filter(image_type='before', segment='exterior')
                ],
                'after_images_interior': [
                    {
                        'id': img.id,
                        'image_url': get_full_media_url(img.image.url),
                        'uploaded_at': img.uploaded_at.isoformat(),
                        'segment': img.segment
                    } for img in appointment.images.filter(image_type='after', segment='interior')
                ],
                'after_images_exterior': [
                    {
                        'id': img.id,
                        'image_url': get_full_media_url(img.image.url),
                        'uploaded_at': img.uploaded_at.isoformat(),
                        'segment': img.segment
                    } for img in appointment.images.filter(image_type='after', segment='exterior')
                ],
                'fleet_maintenance': JobFleetMaintenanceSerializer(appointment.fleet_maintenance).data if hasattr(appointment, 'fleet_maintenance') and appointment.fleet_maintenance else None,
            }
            return Response(appointment_detaile, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


    def _start_appointment(self, request):
        """ Start the appointment
        Args:
            request: The request objectwhy does
        Returns:
            Response: The response object
        """
        try:
            appointment = Job.objects.filter(
                id=request.data.get('id')
            ).filter(
                Q(primary_detailer__user=request.user) | Q(detailers__user=request.user)
            ).distinct().first()
            if not appointment:
                return Response({"error": "Appointment not found"}, status=status.HTTP_404_NOT_FOUND)
            
            # Check if the appointment is already started, completed, or cancelled
            if appointment.status in ['in_progress', 'completed', 'cancelled']:
                return Response({"error": "Appointment is already in progress, completed, or cancelled"}, status=status.HTTP_400_BAD_REQUEST)
            
            # Check if the appointment is accepted before starting
            if appointment.status != 'accepted':
                return Response({"error": "Appointment must be accepted before starting"}, status=status.HTTP_400_BAD_REQUEST)
            
            appointment.status = 'in_progress'
            appointment.save()

            # trigger the job started to redis
            publish_job_started.delay(appointment.booking_reference)

            return Response({"message": "Appointment started successfully"}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
            

    def _complete_appointment(self, request):
        """ Complete the appointment
        Args:
            request: The request object
        Returns:
            Response: The response object
        """
        def _bad_request(msg):
            return Response({"error": msg}, status=status.HTTP_400_BAD_REQUEST)

        try:
            raw_id = request.data.get('id') if request.data else None
            if raw_id is None:
                return _bad_request("Missing appointment id")
            try:
                job_id = raw_id
            except (TypeError, ValueError):
                return _bad_request("Invalid appointment id")

            appointment = Job.objects.filter(
                id=job_id
            ).filter(
                Q(primary_detailer__user=request.user) | Q(detailers__user=request.user)
            ).distinct().first()
            if not appointment:
                return Response({"error": "Appointment not found"}, status=status.HTTP_404_NOT_FOUND)

            # Check if the appointment is already completed or cancelled
            if appointment.status in ['completed', 'cancelled']:
                return _bad_request("Appointment is already completed or cancelled")

            # Check if the appointment is in progress before completing
            if appointment.status != 'in_progress':
                return _bad_request(
                    f"Appointment must be in progress before completing (current status: {appointment.status})"
                )

            # Validate that all required images are uploaded (per-segment min = max)
            before_interior_count = appointment.images.filter(image_type='before', segment='interior').count()
            before_exterior_count = appointment.images.filter(image_type='before', segment='exterior').count()
            after_interior_count = appointment.images.filter(image_type='after', segment='interior').count()
            after_exterior_count = appointment.images.filter(image_type='after', segment='exterior').count()

            if before_interior_count < MAX_SEGMENT_JOB_IMAGES:
                return _bad_request(
                    f"Minimum {MAX_SEGMENT_JOB_IMAGES} before interior images required. Current: {before_interior_count}"
                )
            if before_exterior_count < MAX_SEGMENT_JOB_IMAGES:
                return _bad_request(
                    f"Minimum {MAX_SEGMENT_JOB_IMAGES} before exterior images required. Current: {before_exterior_count}"
                )
            if after_interior_count < MAX_SEGMENT_JOB_IMAGES:
                return _bad_request(
                    f"Minimum {MAX_SEGMENT_JOB_IMAGES} after interior images required. Current: {after_interior_count}"
                )
            if after_exterior_count < MAX_SEGMENT_JOB_IMAGES:
                return _bad_request(
                    f"Minimum {MAX_SEGMENT_JOB_IMAGES} after exterior images required. Current: {after_exterior_count}"
                )

            appointment.status = 'completed'
            appointment.save()

            # trigger the job completed to redis
            publish_job_completed.delay(appointment.booking_reference)

            return Response({"message": "Appointment completed successfully"}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    def _submit_fleet_maintenance(self, request):
        """
        Submit fleet maintenance inspection data for a job.
        Creates or updates JobFleetMaintenance instance for the job.
        
        Args:
            request: HTTP request containing job_id and fleet maintenance data
        
        Returns:
            Response: JSON with fleet maintenance data or error
        """
        try:
            job_id = request.data.get('job_id')
            if not job_id:
                return Response({"error": "job_id is required"}, status=status.HTTP_400_BAD_REQUEST)
            
            # Get the job and verify it belongs to the authenticated detailer
            try:
                job = Job.objects.filter(
                    id=job_id
                ).filter(
                    Q(primary_detailer__user=request.user) | Q(detailers__user=request.user)
                ).distinct().first()
            except Job.DoesNotExist:
                return Response({"error": "Job not found or access denied"}, status=status.HTTP_404_NOT_FOUND)
            
            # Check if job is in_progress
            if job.status != 'in_progress':
                return Response({
                    "error": "Can only submit fleet maintenance data for in-progress jobs"
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Get or create fleet maintenance record
            fleet_maintenance, created = JobFleetMaintenance.objects.get_or_create(
                job=job,
                defaults={'inspected_by': request.user}
            )
            
            # Update fields from request data
            serializer = JobFleetMaintenanceSerializer(fleet_maintenance, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save(inspected_by=request.user)
                return Response({
                    "message": "Fleet maintenance data submitted successfully",
                    "fleet_maintenance": serializer.data
                }, status=status.HTTP_200_OK if not created else status.HTTP_201_CREATED)
            else:
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    
    def _upload_before_images(self, request):
        """
        Upload before images for a job.
        Called when detailer starts the job or during the job.
        Accepts multiple images via multipart/form-data with segment parameter.
        
        Args:
            request: HTTP request containing job_id, segment (interior/exterior), and image files
        
        Returns:
            Response: JSON with uploaded image details or error
        """
        try:
            job_id = request.data.get('job_id')
            segment = request.data.get('segment', 'exterior')  # Default to exterior for backward compatibility
            
            if not job_id:
                return Response({"error": "job_id is required"}, status=status.HTTP_400_BAD_REQUEST)
            
            # Validate segment
            if segment not in ['interior', 'exterior']:
                return Response({"error": "segment must be 'interior' or 'exterior'"}, status=status.HTTP_400_BAD_REQUEST)
            
            # Get the job and verify it belongs to the authenticated detailer
            try:
                job = Job.objects.filter(
                    id=job_id
                ).filter(
                    Q(primary_detailer__user=request.user) | Q(detailers__user=request.user)
                ).distinct().first()
            except Job.DoesNotExist:
                return Response({"error": "Job not found or access denied"}, status=status.HTTP_404_NOT_FOUND)
            
            # Check if job is in accepted or in_progress status
            if job.status not in ['accepted', 'in_progress']:
                return Response({
                    "error": "Can only upload before images for accepted or in-progress jobs"
                }, status=status.HTTP_400_BAD_REQUEST)
            
            image_keys = [k for k in request.FILES if k.startswith('image')]
            if not image_keys:
                return Response({"error": "No images provided"}, status=status.HTTP_400_BAD_REQUEST)

            existing_before = JobImage.objects.filter(
                job=job, image_type='before', segment=segment
            ).count()
            if existing_before + len(image_keys) > MAX_SEGMENT_JOB_IMAGES:
                return Response(
                    {
                        "error": (
                            f"At most {MAX_SEGMENT_JOB_IMAGES} before {segment} images per job "
                            f"(have {existing_before}, cannot add {len(image_keys)})."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            uploaded_images = []
            image_count = 0
            for key in image_keys:
                image_file = request.FILES[key]
                job_image = JobImage.objects.create(
                    job=job,
                    image_type='before',
                    segment=segment,
                    image=image_file,
                    uploaded_by=request.user,
                )
                uploaded_images.append(
                    {
                        "id": job_image.id,
                        "image_url": get_full_media_url(job_image.image.url),
                        "uploaded_at": job_image.uploaded_at.isoformat(),
                        "segment": job_image.segment,
                    }
                )
                image_count += 1
            
            resp = Response({
                "message": f"{image_count} before {segment} image(s) uploaded successfully",
                "images": uploaded_images
            }, status=status.HTTP_201_CREATED)
            # Republish job_started so the client stack receives before_images after DB + storage exist.
            # skip_client_notification avoids duplicate "appointment started" push/in-app notification.
            if job.status == 'in_progress' and image_count > 0:
                publish_job_started.delay(
                    job.booking_reference,
                    skip_client_notification=True,
                )
            return resp
            
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    
    def _upload_after_images(self, request):
        """
        Upload after images for a job.
        Called before completing the job.
        Accepts multiple images via multipart/form-data with segment parameter.
        
        Args:
            request: HTTP request containing job_id, segment (interior/exterior), and image files
        
        Returns:
            Response: JSON with uploaded image details or error
        """
        try:
            job_id = request.data.get('job_id')
            segment = request.data.get('segment', 'exterior')  # Default to exterior for backward compatibility
            
            if not job_id:
                return Response({"error": "job_id is required"}, status=status.HTTP_400_BAD_REQUEST)
            
            # Validate segment
            if segment not in ['interior', 'exterior']:
                return Response({"error": "segment must be 'interior' or 'exterior'"}, status=status.HTTP_400_BAD_REQUEST)
            
            # Get the job and verify it belongs to the authenticated detailer
            try:
                job = Job.objects.filter(
                    id=job_id
                ).filter(
                    Q(primary_detailer__user=request.user) | Q(detailers__user=request.user)
                ).distinct().first()
            except Job.DoesNotExist:
                return Response({"error": "Job not found or access denied"}, status=status.HTTP_404_NOT_FOUND)
            
            # Check if job is in_progress
            if job.status != 'in_progress':
                return Response({
                    "error": "Can only upload after images for in-progress jobs"
                }, status=status.HTTP_400_BAD_REQUEST)
            
            image_keys = [k for k in request.FILES if k.startswith('image')]
            if not image_keys:
                return Response({"error": "No images provided"}, status=status.HTTP_400_BAD_REQUEST)

            existing_after = JobImage.objects.filter(
                job=job, image_type='after', segment=segment
            ).count()
            if existing_after + len(image_keys) > MAX_SEGMENT_JOB_IMAGES:
                return Response(
                    {
                        "error": (
                            f"At most {MAX_SEGMENT_JOB_IMAGES} after {segment} images per job "
                            f"(have {existing_after}, cannot add {len(image_keys)})."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            uploaded_images = []
            image_count = 0
            for key in image_keys:
                image_file = request.FILES[key]
                job_image = JobImage.objects.create(
                    job=job,
                    image_type='after',
                    segment=segment,
                    image=image_file,
                    uploaded_by=request.user,
                )
                uploaded_images.append(
                    {
                        "id": job_image.id,
                        "image_url": get_full_media_url(job_image.image.url),
                        "uploaded_at": job_image.uploaded_at.isoformat(),
                        "segment": job_image.segment,
                    }
                )
                image_count += 1
            
            resp = Response({
                "message": f"{image_count} after {segment} image(s) uploaded successfully",
                "images": uploaded_images
            }, status=status.HTTP_201_CREATED)
            # Republish job_completed payload so client receives after_images once DB + storage exist.
            # skip_client_notification avoids marking booking completed / duplicate completion notifications.
            if job.status == 'in_progress' and image_count > 0:
                publish_job_completed.delay(
                    job.booking_reference,
                    skip_client_notification=True,
                )
            return resp
            
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)