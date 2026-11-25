from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView

from ruido import paginas

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api-auth/', include('rest_framework.urls')),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='docs'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
    path('api/', include('ruido.urls')),
    path('', paginas.inicio, name='inicio'),
    path('zonas/', paginas.zonas, name='zonas'),
    path('mediciones/', paginas.mediciones, name='mediciones'),
    path('reportar/', paginas.reportar, name='reportar'),
]
