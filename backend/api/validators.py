"""
Input validation utilities for API endpoints.
Provides safe parsing and validation of query parameters and request body.
"""
import ipaddress
import logging

logger = logging.getLogger('netpulse.validators')


def safe_int(value, default=None, min_val=None, max_val=None, param_name='parameter'):
    """Safely parse an integer from a string value with range validation."""
    if value is None or value == '':
        return default
    try:
        result = int(value)
    except (ValueError, TypeError):
        raise ValueError(f"'{param_name}' must be a valid integer, got '{value}'")

    if min_val is not None and result < min_val:
        raise ValueError(f"'{param_name}' must be >= {min_val}, got {result}")
    if max_val is not None and result > max_val:
        raise ValueError(f"'{param_name}' must be <= {max_val}, got {result}")
    return result


def safe_float(value, default=None, min_val=None, max_val=None, param_name='parameter'):
    """Safely parse a float from a string value with range validation."""
    if value is None or value == '':
        return default
    try:
        result = float(value)
    except (ValueError, TypeError):
        raise ValueError(f"'{param_name}' must be a valid number, got '{value}'")

    if min_val is not None and result < min_val:
        raise ValueError(f"'{param_name}' must be >= {min_val}, got {result}")
    if max_val is not None and result > max_val:
        raise ValueError(f"'{param_name}' must be <= {max_val}, got {result}")
    return result


def safe_bool(value, default=None, param_name='parameter'):
    """Safely parse a boolean from a string value."""
    if value is None or value == '':
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        if value.lower() in ('1', 'true', 'yes', 'on'):
            return True
        if value.lower() in ('0', 'false', 'no', 'off'):
            return False
    raise ValueError(f"'{param_name}' must be a boolean value, got '{value}'")


def validate_ip_address(value, param_name='ip_address'):
    """Validate that a string is a valid IPv4 or IPv6 address."""
    if not value:
        raise ValueError(f"'{param_name}' is required")
    try:
        ipaddress.ip_address(value)
        return value
    except (ValueError, TypeError):
        raise ValueError(f"'{param_name}' must be a valid IP address, got '{value}'")


def validate_choice(value, choices, param_name='parameter', allow_empty=False):
    """Validate that value is one of the allowed choices."""
    if not value or value == '':
        if allow_empty:
            return None
        raise ValueError(f"'{param_name}' is required")
    valid = [c[0] if isinstance(c, (list, tuple)) else c for c in choices]
    if value not in valid:
        raise ValueError(f"'{param_name}' must be one of {valid}, got '{value}'")
    return value


def validate_string(value, max_length=None, min_length=None, param_name='parameter', required=False):
    """Validate a string parameter."""
    if value is None or value == '':
        if required:
            raise ValueError(f"'{param_name}' is required")
        return value or ''
    value = str(value).strip()
    if min_length and len(value) < min_length:
        raise ValueError(f"'{param_name}' must be at least {min_length} characters")
    if max_length and len(value) > max_length:
        raise ValueError(f"'{param_name}' must be at most {max_length} characters")
    return value
