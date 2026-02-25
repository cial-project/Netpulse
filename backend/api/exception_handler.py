"""
Custom DRF exception handler that provides consistent, structured error responses.
"""
import logging
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from django.http import Http404
from django.core.exceptions import ValidationError as DjangoValidationError

logger = logging.getLogger('netpulse.views')


def custom_exception_handler(exc, context):
    """
    Custom exception handler for Django REST Framework.
    Provides consistent error response format across all endpoints.
    """
    # Call DRF's default handler first
    response = exception_handler(exc, context)

    if response is not None:
        # Restructure the response for consistency
        custom_data = {
            'success': False,
            'error': {
                'status_code': response.status_code,
                'detail': _extract_detail(response.data),
            }
        }
        response.data = custom_data
        return response

    # Handle exceptions that DRF doesn't catch
    if isinstance(exc, Http404):
        return Response({
            'success': False,
            'error': {
                'status_code': 404,
                'detail': 'Resource not found.',
            }
        }, status=status.HTTP_404_NOT_FOUND)

    if isinstance(exc, DjangoValidationError):
        return Response({
            'success': False,
            'error': {
                'status_code': 400,
                'detail': exc.messages if hasattr(exc, 'messages') else str(exc),
            }
        }, status=status.HTTP_400_BAD_REQUEST)

    if isinstance(exc, ValueError):
        return Response({
            'success': False,
            'error': {
                'status_code': 400,
                'detail': str(exc),
            }
        }, status=status.HTTP_400_BAD_REQUEST)

    if isinstance(exc, PermissionError):
        return Response({
            'success': False,
            'error': {
                'status_code': 403,
                'detail': 'You do not have permission to perform this action.',
            }
        }, status=status.HTTP_403_FORBIDDEN)

    # Log unexpected errors
    view = context.get('view')
    logger.exception(
        'Unhandled exception in %s: %s',
        view.__class__.__name__ if view else 'unknown',
        str(exc)
    )

    return Response({
        'success': False,
        'error': {
            'status_code': 500,
            'detail': 'An internal server error occurred.',
        }
    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def _extract_detail(data):
    """Extract a human-readable detail from DRF error response data."""
    if isinstance(data, str):
        return data
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        if 'detail' in data:
            return str(data['detail'])
        # Flatten field errors
        errors = {}
        for field, messages in data.items():
            if isinstance(messages, list):
                errors[field] = [str(m) for m in messages]
            else:
                errors[field] = str(messages)
        return errors
    return str(data)
