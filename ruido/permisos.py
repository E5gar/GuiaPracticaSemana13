from rest_framework.permissions import SAFE_METHODS, BasePermission


class SoloPersonalEscribe(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_authenticated and request.user.is_staff)


class LecturaPublicaReporteCiudadano(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        if getattr(view, 'action', None) == 'create':
            return True
        return bool(request.user and request.user.is_authenticated and request.user.is_staff)