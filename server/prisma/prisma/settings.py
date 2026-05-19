from pathlib import Path
from datetime import timedelta
from urllib.parse import quote_plus
import os
import dj_database_url
from celery.schedules import crontab
from google.oauth2 import service_account




BASE_DIR = Path(__file__).resolve().parent.parent

PRISMA_ENV = os.getenv('PRISMA_ENV', 'production').strip().lower()
IS_STAGING = PRISMA_ENV == 'staging'
# Staging shares one Redis (client_staging_redis); use separate logical DBs from client (0–2).
_DEFAULT_REDIS_HOST = 'client_staging_redis' if IS_STAGING else 'prisma_redis'

SECRET_KEY = os.getenv('DJANGO_SECRET_KEY')

BASE_URL = os.getenv('BASE_URL')

_DEFAULT_DETAILER_ORIGIN = (
    'https://staging.detailer.prismavalet.com' if IS_STAGING else 'https://detailer.prismavalet.com'
)
# Production: detailer.prismavalet.com on droplet. Override via env for local/dev.
_DETAILER_ORIGIN = os.getenv('DETAILER_ORIGIN', _DEFAULT_DETAILER_ORIGIN)
# Base URL for email footers and public legal pages (/legal/privacy/, /legal/terms/).
FRONTEND_BASE_URL = os.getenv('FRONTEND_BASE_URL', _DETAILER_ORIGIN).rstrip('/')   
ALLOWED_ORIGINS = os.getenv('ALLOWED_ORIGINS', _DETAILER_ORIGIN).split(',') if os.getenv('ALLOWED_ORIGINS') else [_DETAILER_ORIGIN]
CSRF_TRUSTED_ORIGINS = os.getenv('CSRF_TRUSTED_ORIGINS', _DETAILER_ORIGIN).split(',') if os.getenv('CSRF_TRUSTED_ORIGINS') else [_DETAILER_ORIGIN]
CORS_ALLOWED_ORIGINS = os.getenv('CORS_ALLOWED_ORIGINS', _DETAILER_ORIGIN).split(',') if os.getenv('CORS_ALLOWED_ORIGINS') else [_DETAILER_ORIGIN]
CORS_ALLOW_CREDENTIALS = True
DEBUG = os.getenv('DEBUG') == 'True'
# Allow production host and ngrok tunnels (Django accepts leading dot for subdomains)
_default_hosts = ['detailer.prismavalet.com', '450e-2a02-8084-c81-a480-c018-9c4e-4107-9d95.ngrok-free.app']
_allowed_hosts_env = os.getenv('ALLOWED_HOSTS')
if _allowed_hosts_env:
    ALLOWED_HOSTS = [h.strip() for h in _allowed_hosts_env.split(',') if h.strip()]
else:
    ALLOWED_HOSTS = ['*']

USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

INSTALLED_APPS = [
    'daphne',  # <-- Move this to the first position
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'main',
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'channels',
    'channels_redis',
    'storages',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'prisma.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

# Database
# https://docs.djangoproject.com/en/5.2/ref/settings/#databases
# DATABASE_URL or POSTGRES_* required (Postgres only for this project).


def _resolve_database_url():
    explicit = os.getenv('DATABASE_URL', '').strip()
    if explicit:
        return explicit
    user = os.getenv('POSTGRES_USER')
    password = os.getenv('POSTGRES_PASSWORD')
    host = os.getenv('POSTGRES_HOST')
    port = os.getenv('POSTGRES_PORT', '5432')
    db = os.getenv('POSTGRES_DB')
    if user and password and host and db:
        return (
            f'postgresql://{quote_plus(user)}:{quote_plus(password)}'
            f'@{host}:{port}/{db}'
        )
    return ''


_database_url = _resolve_database_url()
if not _database_url:
    from django.core.exceptions import ImproperlyConfigured
    raise ImproperlyConfigured(
        'Set DATABASE_URL or POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_HOST, and POSTGRES_DB '
        f'(PRISMA_ENV={PRISMA_ENV!r}).'
    )
DATABASES = {
    'default': dj_database_url.config(
        default=_database_url,
        conn_max_age=int(os.getenv('DATABASE_CONN_MAX_AGE', '600')),
    ),
}


# Staging: local media. Production: Google Cloud Storage.
if IS_STAGING:
    GS_CREDENTIALS_PATH_STAGING = os.path.join(BASE_DIR, 'prisma-6fc48-642e49c334e8.json')
    GS_BUCKET_NAME_STAGING = os.getenv('GS_BUCKET_NAME_STAGING', 'prisma_staging_bucket')
    GS_LOCATION_STAGING = os.getenv('GS_LOCATION_STAGING', 'main-app')
    GS_CREDENTIALS_STAGING = service_account.Credentials.from_service_account_file(
        GS_CREDENTIALS_PATH_STAGING,
        scopes=['https://www.googleapis.com/auth/cloud-platform'],
    )
    STORAGES = {
        'default': {
            'BACKEND': 'storages.backends.gcloud.GoogleCloudStorage',
            'OPTIONS': {
                'bucket_name': GS_BUCKET_NAME_STAGING,
                'location': GS_LOCATION_STAGING,
                'credentials': GS_CREDENTIALS_STAGING,
                'default_acl': None,
            },
        },
        'staticfiles': {
            'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage',
        },
    }
else:
    GS_BUCKET_NAME = os.getenv('GS_BUCKET_NAME', 'prisma-valet-bucket')
    GS_LOCATION = os.getenv('GS_LOCATION', 'detailer-app')
    GS_CREDENTIALS_PATH = os.getenv('GS_CREDENTIALS_PATH', '')
    GS_CREDENTIALS = None
    if GS_CREDENTIALS_PATH and Path(GS_CREDENTIALS_PATH).is_file():
        GS_CREDENTIALS = service_account.Credentials.from_service_account_file(
            GS_CREDENTIALS_PATH,
            scopes=['https://www.googleapis.com/auth/cloud-platform'],
        )
    MEDIA_URL = f'https://storage.googleapis.com/{GS_BUCKET_NAME}/'
    MEDIA_ROOT = BASE_DIR / 'media'
    STORAGES = {
        'default': {
            'BACKEND': 'storages.backends.gcloud.GoogleCloudStorage',
        },
        'staticfiles': {
            'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage',
        },
    }
    

# Password validation
# https://docs.djangoproject.com/en/5.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/5.2/topics/i18n/

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Europe/London'
USE_I18N = True
USE_TZ = True

_redis_host = os.getenv('REDIS_HOST', _DEFAULT_REDIS_HOST)
_redis_port = int(os.getenv('REDIS_PORT', '6379'))
if IS_STAGING:
    _redis_db_broker = int(os.getenv('REDIS_CELERY_BROKER_DB', '3'))
    _redis_db_result = int(os.getenv('REDIS_CELERY_RESULT_DB', '4'))
    _redis_db_cache = int(os.getenv('REDIS_CACHE_DB', '5'))
    _redis_db_channels = int(os.getenv('REDIS_CHANNELS_DB', '6'))
else:
    _redis_db_broker, _redis_db_result, _redis_db_cache = 0, 1, 2
    _redis_db_channels = 0

# Cache (for django-ratelimit; Redis shared with Celery/Channels, different DB index)
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': os.getenv(
            'REDIS_URL',
            f'redis://{_redis_host}:{_redis_port}/{_redis_db_cache}',
        ),
        'OPTIONS': {},
    },
}

# REST Framework Configuration
_rest_renderers = ['rest_framework.renderers.JSONRenderer']
if IS_STAGING and DEBUG:
    _rest_renderers.append('rest_framework.renderers.BrowsableAPIRenderer')
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_RENDERER_CLASSES': tuple(_rest_renderers),
}


CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [
                f'redis://{_redis_host}:{_redis_port}/{_redis_db_channels}',
            ],
        },
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=120),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": False,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "VERIFYING_KEY": "",
    "AUDIENCE": None,
    "ISSUER": None,
    "JSON_ENCODER": None,
    "JWK_URL": None,
    "LEEWAY": 0,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "AUTH_HEADER_NAME": "HTTP_AUTHORIZATION",
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
    "USER_AUTHENTICATION_RULE": "rest_framework_simplejwt.authentication.default_user_authentication_rule",
    "AUTH_TOKEN_CLASSES": ("rest_framework_simplejwt.tokens.AccessToken",),
    "TOKEN_TYPE_CLAIM": "token_type",
    "TOKEN_USER_CLASS": "rest_framework_simplejwt.models.TokenUser",
    "JTI_CLAIM": "jti",
    "SLIDING_TOKEN_REFRESH_EXP_CLAIM": "refresh_exp",
    "SLIDING_TOKEN_LIFETIME": timedelta(minutes=60),
    "SLIDING_TOKEN_REFRESH_LIFETIME": timedelta(days=1),
    "TOKEN_OBTAIN_SERIALIZER": "rest_framework_simplejwt.serializers.TokenObtainPairSerializer",
    "TOKEN_REFRESH_SERIALIZER": "rest_framework_simplejwt.serializers.TokenRefreshSerializer",
    "TOKEN_VERIFY_SERIALIZER": "rest_framework_simplejwt.serializers.TokenVerifySerializer",
    "TOKEN_BLACKLIST_SERIALIZER": "rest_framework_simplejwt.serializers.TokenBlacklistSerializer",
    "SLIDING_TOKEN_OBTAIN_SERIALIZER": "rest_framework_simplejwt.serializers.TokenObtainSlidingSerializer",
    "SLIDING_TOKEN_REFRESH_SERIALIZER": "rest_framework_simplejwt.serializers.TokenRefreshSlidingSerializer",
}

CELERY_BEAT_SCHEDULE = {
    # 'Job starting soon' reminder disabled: was causing notifications with no job / duplicates.
    # Previously: 'check-upcoming-jobs' ran main.tasks.check_upcoming_jobs (crontab every 15 min).
    'send-daily-schedule': {
        'task': 'main.tasks.check_daily_schedule',
        'schedule': crontab(hour=7, minute=0),  # Daily at 7 AM
    },
}


CELERY_BROKER_URL = os.getenv(
    'CELERY_BROKER_URL',
    f'redis://{_redis_host}:{_redis_port}/{_redis_db_broker}',
)
CELERY_RESULT_BACKEND = os.getenv(
    'CELERY_RESULT_BACKEND',
    f'redis://{_redis_host}:{_redis_port}/{_redis_db_result}',
)
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
CELERY_DEFAULT_QUEUE = 'detailer_queue'
CELERY_TASK_DEFAULT_QUEUE = 'detailer_queue'

# Auth model for the detailer database
AUTH_USER_MODEL = 'main.User'

# Static files configuration
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = [
    BASE_DIR / 'static',
]

# Whitenoise configuration
WHITENOISE_USE_FINDERS = DEBUG



DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Email Configuration (for development)
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
EMAIL_HOST = os.getenv('EMAIL_HOST')
EMAIL_PORT = 587
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD')
EMAIL_USE_TLS = True
EMAIL_USE_SSL = False
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL')

ASGI_APPLICATION = "prisma.asgi.application"


# Ensure log directory exists to prevent FileHandler failures in containers
LOG_DIR = BASE_DIR / 'logs'
os.makedirs(LOG_DIR, exist_ok=True)

SUPPORT_INTERNAL_API_KEY = (os.getenv('SUPPORT_INTERNAL_API_KEY') or '').strip()

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'file': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': BASE_DIR / 'logs' / 'django.log',
            'formatter': 'verbose',
        },
        'error_file': {
            'level': 'ERROR',
            'class': 'logging.FileHandler',
            'filename': BASE_DIR / 'logs' / 'django_error.log',
            'formatter': 'verbose',
        },
        'console': {
            'level': 'DEBUG',
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
        },
    },
    'root': {
        'handlers': ['console', 'file', 'error_file'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['console', 'file', 'error_file'],
            'level': 'INFO',
            'propagate': False,
        },
        'main': {
            'handlers': ['console', 'file', 'error_file'],
            'level': 'DEBUG',
            'propagate': False,
        },
        'main.views.booking': {
            'handlers': ['console', 'file', 'error_file'],
            'level': 'DEBUG',
            'propagate': False,
        },
    },
}