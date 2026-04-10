from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

# from .routing import websocket_urlpatterns

urlpatterns = [
    path('detailer-admin/', admin.site.urls),
    path('api/v1/', include('main.urls')),
]

# Serve static and media files during development
# Serve media files during development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)