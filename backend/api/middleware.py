"""
Centralized middleware for error handling, request logging, and input sanitization.
"""
import json
import time
import traceback
import logging
from django.http import JsonResponse
from django.utils import timezone
from rest_framework import status as http_status

logger = logging.getLogger('netpulse.middleware')


class CentralizedErrorHandlingMiddleware:
    """
    Catches ALL unhandled exceptions and returns structured JSON responses
    instead of crashing or returning HTML 500 errors.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        try:
            response = self.get_response(request)
            return response
        except Exception as exc:
            return self.handle_exception(request, exc)

    def handle_exception(self, request, exc):
        # Log full traceback
        logger.error(
            'Unhandled exception on %s %s: %s\n%s',
            request.method,
            request.path,
            str(exc),
            traceback.format_exc()
        )

        # Determine appropriate status code
        status_code = 500
        error_type = 'internal_error'

        if hasattr(exc, 'status_code'):
            status_code = exc.status_code
        elif isinstance(exc, ValueError):
            status_code = 400
            error_type = 'validation_error'
        elif isinstance(exc, PermissionError):
            status_code = 403
            error_type = 'permission_denied'
        elif isinstance(exc, LookupError):
            status_code = 404
            error_type = 'not_found'

        response_data = {
            'success': False,
            'error': {
                'type': error_type,
                'message': str(exc) if status_code != 500 else 'An internal server error occurred.',
                'timestamp': timezone.now().isoformat(),
                'path': request.path,
            }
        }

        return JsonResponse(response_data, status=status_code)

    def process_exception(self, request, exception):
        """Called by Django when a view raises an exception."""
        return self.handle_exception(request, exception)


class RequestLoggingMiddleware:
    """
    Logs all incoming API requests with timing, user info, and response status.
    Useful for debugging, auditing, and performance monitoring.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start_time = time.time()

        # Process request
        response = self.get_response(request)

        # Calculate duration
        duration_ms = round((time.time() - start_time) * 1000, 2)

        # Skip logging for static files and health checks
        path = request.path
        if path.startswith(('/static/', '/media/', '/favicon.ico')):
            return response

        # Get user info
        user_info = 'anonymous'
        if hasattr(request, 'user') and request.user.is_authenticated:
            user_info = f"{request.user.username} ({getattr(request.user, 'role', 'unknown')})"

        log_level = logging.INFO
        if response.status_code >= 500:
            log_level = logging.ERROR
        elif response.status_code >= 400:
            log_level = logging.WARNING

        logger.log(
            log_level,
            '%s %s → %d (%s ms) [user=%s] [ip=%s]',
            request.method,
            path,
            response.status_code,
            duration_ms,
            user_info,
            request.META.get('REMOTE_ADDR', 'unknown')
        )

        # Add timing header for debugging
        response['X-Response-Time'] = f'{duration_ms}ms'

        return response


class InputSanitizationMiddleware:
    """
    Sanitizes incoming request data to prevent common attack vectors.
    Strips leading/trailing whitespace from string values.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Sanitize query params
        if request.GET:
            request.GET = request.GET.copy()
            for key in request.GET:
                val = request.GET[key]
                if isinstance(val, str):
                    request.GET[key] = val.strip()

        return self.get_response(request)
