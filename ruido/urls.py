from rest_framework.routers import DefaultRouter

from .views import MedicionRuidoViewSet, ZonaUrbanaViewSet

router = DefaultRouter()
router.register('zonas', ZonaUrbanaViewSet, basename='zona')
router.register('mediciones', MedicionRuidoViewSet, basename='medicion')

urlpatterns = router.urls