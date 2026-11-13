import os

import dj_database_url
from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F403

DEBUG = False

# Fail at startup instead of running with insecure or missing configuration.
if not os.getenv("SECRET_KEY") or SECRET_KEY.startswith("django-insecure"):  # noqa: F405
    raise ImproperlyConfigured("Set a strong SECRET_KEY environment variable for production.")
if not os.getenv("DATABASE_URL"):
    raise ImproperlyConfigured(
        "Set DATABASE_URL for production, e.g. postgres://user:pass@host:5432/fabrilink"
    )
if "*" in ALLOWED_HOSTS:  # noqa: F405
    raise ImproperlyConfigured("Don't use '*' in ALLOWED_HOSTS in production.")

# Render sets this to the service's public hostname (e.g. fabrilink-backend.onrender.com).
RENDER_EXTERNAL_HOSTNAME = os.getenv("RENDER_EXTERNAL_HOSTNAME")
if RENDER_EXTERNAL_HOSTNAME:
    ALLOWED_HOSTS.append(RENDER_EXTERNAL_HOSTNAME)  # noqa: F405
    CSRF_TRUSTED_ORIGINS.append(f"https://{RENDER_EXTERNAL_HOSTNAME}")  # noqa: F405

# Serve the admin and API-docs static files from the app server itself.
MIDDLEWARE.insert(  # noqa: F405
    MIDDLEWARE.index("django.middleware.security.SecurityMiddleware") + 1,  # noqa: F405
    "whitenoise.middleware.WhiteNoiseMiddleware",
)
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
}

DATABASES = {
    "default": dj_database_url.parse(
        os.environ["DATABASE_URL"],
        conn_max_age=600,
        conn_health_checks=True,
    )
}

# Production Security
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = os.getenv("SECURE_SSL_REDIRECT", "True").lower() in ("true", "1")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SECURE_HSTS_SECONDS = int(os.getenv("SECURE_HSTS_SECONDS", "0"))
SECURE_HSTS_INCLUDE_SUBDOMAINS = SECURE_HSTS_SECONDS > 0

# S3 Storage if enabled
if os.getenv("USE_S3", "False").lower() in ("true", "1"):
    STORAGES = {
        "default": {
            "BACKEND": "storages.backends.s3.S3Storage",
            "OPTIONS": {
                "access_key": os.getenv("AWS_ACCESS_KEY_ID"),  # noqa: F405
                "secret_key": os.getenv("AWS_SECRET_ACCESS_KEY"),  # noqa: F405
                "bucket_name": os.getenv("AWS_STORAGE_BUCKET_NAME"),  # noqa: F405
                "region_name": os.getenv("AWS_S3_REGION_NAME", "ap-south-1"),  # noqa: F405
            },
        },
        "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
    }
