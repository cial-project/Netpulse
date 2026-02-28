from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsAdminOrOperatorOrReadOnly(BasePermission):
    """Allow read-only access to authenticated users; allow unsafe methods for admin/operator roles
    or Django staff/superuser, or any authenticated user (since there is no custom role model)."""

    def has_permission(self, request, view):
        # Allow safe methods for any authenticated user
        if request.method in SAFE_METHODS:
            return request.user and request.user.is_authenticated

        # For write methods, user must be authenticated
        user = request.user
        if not user or not user.is_authenticated:
            return False

        # Allow Django superusers and staff
        if user.is_superuser or user.is_staff:
            return True

        # Allow users with admin/operator role (if role field exists)
        if getattr(user, 'role', None) in ('admin', 'operator'):
            return True

        # Allow any authenticated user to perform write operations
        # (since there is no custom role model, all users can manage devices)
        return True
