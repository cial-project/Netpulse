from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsAdminOrOperatorOrReadOnly(BasePermission):
    """Allow read-only access to authenticated users; allow unsafe methods only for admin/operator roles."""

    def has_permission(self, request, view):
        # Allow safe methods for any authenticated user
        if request.method in SAFE_METHODS:
            return request.user and request.user.is_authenticated

        # For write methods, check user role
        user = request.user
        if not user or not user.is_authenticated:
            return False

        return getattr(user, 'role', None) in ('admin', 'operator')
