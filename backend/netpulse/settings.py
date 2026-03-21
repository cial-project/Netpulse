import os
from pathlib import Path
import dj_database_url
from decouple import config

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = config('SECRET_KEY', default='django-insecure-netpulse-secret-key-change-in-production')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = config('DEBUG', default=True, cast=bool)

ALLOWED_HOSTS = config(
    'ALLOWED_HOSTS',
    default='localhost,127.0.0.1,netpulse-gkcp.onrender.com'
).split(',')

# CORS Configuration (single source of truth)
CORS_ALLOW_ALL_ORIGINS = config('CORS_ALLOW_ALL_ORIGINS', default=True, cast=bool)
CORS_ALLOWED_ORIGINS = (
    config('CORS_ALLOWED_ORIGINS', default='https://cialnetpulse.netlify.app').split(',')
    if config('CORS_ALLOWED_ORIGINS', default='') else []
)
CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = (
    config('CSRF_TRUSTED_ORIGINS', default='https://netpulse-gkcp.onrender.com').split(',')
    if config('CSRF_TRUSTED_ORIGINS', default='') else []
)

# Application definition
INSTALLED_APPS = [
    'daphne',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Third party apps
    'rest_framework',
    'corsheaders',
    'rest_framework_simplejwt',
    'channels',
    
    # Local apps
    'api',
    'devices',
    'alerts',
]

# Tell Django to use our custom User model
AUTH_USER_MODEL = 'api.User'

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
    # Custom middleware
    'api.middleware.InputSanitizationMiddleware',
    'api.middleware.RequestLoggingMiddleware',
    'api.middleware.CentralizedErrorHandlingMiddleware',
]

ROOT_URLCONF = 'netpulse.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

# Database — use Supabase PostgreSQL via DATABASE_URL from .env
_database_url = config('DATABASE_URL', default='')
if _database_url:
    DATABASES = {
        'default': dj_database_url.parse(_database_url, conn_max_age=600)
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

# REST Framework configuration
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,
    'EXCEPTION_HANDLER': 'api.exception_handler.custom_exception_handler',
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100/hour',
        'user': '1000/hour',
    },
}

# Simple JWT settings
from datetime import timedelta

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=1),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
}

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
if not DEBUG:
    STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Media files
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Email backend (for development)
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# WebSocket configuration
ASGI_APPLICATION = 'netpulse.asgi.application'

if os.environ.get('DEV_USE_INMEM', '0') == '1':
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels.layers.InMemoryChannelLayer',
        },
    }
else:
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels_redis.core.RedisChannelLayer',
            'CONFIG': {
                'hosts': [config('REDIS_URL', default='redis://127.0.0.1:6379')],
            },
        },
    }

# ──────────────────────────────────────────────────────────────────────────────
# Logging Configuration — Structured, Rotating
# ──────────────────────────────────────────────────────────────────────────────
LOG_DIR = os.path.join(BASE_DIR, 'logs')
os.makedirs(LOG_DIR, exist_ok=True)

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '%(asctime)s [%(levelname)s] %(name)s (%(filename)s:%(lineno)d): %(message)s',
            'datefmt': '%Y-%m-%d %H:%M:%S',
        },
        'simple': {
            'format': '%(levelname)s %(message)s',
        },
        'json': {
            'format': '%(asctime)s %(levelname)s %(name)s %(message)s',
        },
    },
    'filters': {
        'require_debug_false': {
            '()': 'django.utils.log.RequireDebugFalse',
        },
        'require_debug_true': {
            '()': 'django.utils.log.RequireDebugTrue',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
        'file_app': {
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': os.path.join(LOG_DIR, 'netpulse.log'),
            'maxBytes': 10 * 1024 * 1024,  # 10 MB
            'backupCount': 5,
            'formatter': 'verbose',
            'encoding': 'utf-8',
        },
        'file_error': {
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': os.path.join(LOG_DIR, 'errors.log'),
            'maxBytes': 10 * 1024 * 1024,  # 10 MB
            'backupCount': 5,
            'formatter': 'verbose',
            'level': 'ERROR',
            'encoding': 'utf-8',
        },
        'file_poller': {
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': os.path.join(LOG_DIR, 'poller.log'),
            'maxBytes': 10 * 1024 * 1024,
            'backupCount': 5,
            'formatter': 'verbose',
            'encoding': 'utf-8',
        },
    },
    'loggers': {
        '': {
            'handlers': ['console', 'file_app', 'file_error'],
            'level': 'INFO',
        },
        'netpulse': {
            'handlers': ['console', 'file_app', 'file_error'],
            'level': 'DEBUG' if DEBUG else 'INFO',
            'propagate': False,
        },
        'netpulse.poller': {
            'handlers': ['console', 'file_poller', 'file_error'],
            'level': 'INFO',
            'propagate': False,
        },
        'netpulse.views': {
            'handlers': ['console', 'file_app', 'file_error'],
            'level': 'INFO',
            'propagate': False,
        },
        'netpulse.middleware': {
            'handlers': ['console', 'file_app', 'file_error'],
            'level': 'INFO',
            'propagate': False,
        },
        'django.request': {
            'handlers': ['console', 'file_error'],
            'level': 'ERROR',
            'propagate': False,
        },
    }
}

# Optional SIEM webhook URL
SIEM_WEBHOOK_URL = os.environ.get('SIEM_WEBHOOK_URL', '')

# ──────────────────────────────────────────────────────────────────────────────
# Celery Configuration
# ──────────────────────────────────────────────────────────────────────────────
CELERY_BROKER_URL = config('REDIS_URL', default='redis://localhost:6379/0')
CELERY_RESULT_BACKEND = config('REDIS_URL', default='redis://localhost:6379/0')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_SOFT_TIME_LIMIT = 60   # seconds
CELERY_TASK_TIME_LIMIT = 120       # hard limit

# Celery Beat Schedule
from celery.schedules import crontab
CELERY_BEAT_SCHEDULE = {
    'poll-all-devices-every-30-seconds': {
        'task': 'api.tasks.poll_all_devices',
        'schedule': 30.0,
    },
    'cleanup-old-metrics-daily': {
        'task': 'api.tasks.cleanup_old_metrics',
        'schedule': crontab(hour=2, minute=0),  # 2 AM daily
        'args': (30,),  # Keep 30 days
    },
}