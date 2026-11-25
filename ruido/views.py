from django.db.models import Avg, Case, CharField, Count, F, Max, Min, Q, Value, When
from django.db.models.functions import ExtractHour
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .filters import MedicionRuidoFilter, ZonaUrbanaFilter
from .models import MedicionRuido, ZonaUrbana
from .permisos import LecturaPublicaReporteCiudadano
from .serializers import (
    MedicionRuidoSerializer,
    MultaSerializer,
    PromedioRuidoSerializer,
    ZonaUrbanaSerializer,
)

FRANJAS = ('madrugada', 'manana', 'tarde', 'noche')


def redondear(valor):
    return None if valor is None else round(float(valor), 1)


def resumen_por_franja(queryset):
    filas = (
        queryset.order_by()
        .annotate(hora=ExtractHour('registrado_en'))
        .annotate(
            franja=Case(
                When(hora__lt=6, then=Value('madrugada')),
                When(hora__lt=12, then=Value('manana')),
                When(hora__lt=18, then=Value('tarde')),
                default=Value('noche'),
                output_field=CharField(),
            )
        )
        .values('franja')
        .annotate(promedio=Avg('decibeles'), total=Count('id'))
    )
    datos = {fila['franja']: fila for fila in filas}
    return [
        {
            'franja': nombre,
            'promedio': redondear(datos[nombre]['promedio']) if nombre in datos else None,
            'total': datos[nombre]['total'] if nombre in datos else 0,
        }
        for nombre in FRANJAS
    ]


class ZonaUrbanaViewSet(viewsets.ModelViewSet):
    queryset = ZonaUrbana.objects.annotate(total_mediciones=Count('mediciones')).order_by('distrito', 'nombre')
    serializer_class = ZonaUrbanaSerializer
    filterset_class = ZonaUrbanaFilter
    search_fields = ('nombre', 'distrito')
    ordering_fields = ('nombre', 'distrito', 'limite_db', 'total_mediciones')

    @extend_schema(
        responses=PromedioRuidoSerializer,
        parameters=[
            OpenApiParameter(
                'estado_revision',
                str,
                description='Si se omite, se excluyen las mediciones rechazadas.',
            )
        ],
    )
    @action(detail=True, methods=['get'], url_path='promedio-ruido')
    def promedio_ruido(self, request, pk=None):
        zona = self.get_object()
        mediciones = zona.mediciones.all()
        estado = request.query_params.get('estado_revision')
        if estado:
            mediciones = mediciones.filter(estado_revision=estado)
        else:
            mediciones = mediciones.exclude(estado_revision=MedicionRuido.Estado.RECHAZADA)
        agregados = mediciones.aggregate(
            promedio=Avg('decibeles'),
            maximo=Max('decibeles'),
            minimo=Min('decibeles'),
            total=Count('id'),
            excedidas=Count('id', filter=Q(decibeles__gt=zona.limite_db)),
        )
        return Response({
            'zona': zona.nombre,
            'distrito': zona.distrito,
            'tipo_uso': zona.tipo_uso,
            'limite_db': zona.limite_db,
            'total': agregados['total'],
            'promedio': redondear(agregados['promedio']),
            'maximo': redondear(agregados['maximo']),
            'minimo': redondear(agregados['minimo']),
            'excedidas': agregados['excedidas'],
            'por_franja': resumen_por_franja(mediciones),
        })


class MedicionRuidoViewSet(viewsets.ModelViewSet):
    queryset = MedicionRuido.objects.select_related('zona')
    serializer_class = MedicionRuidoSerializer
    permission_classes = [LecturaPublicaReporteCiudadano]
    filterset_class = MedicionRuidoFilter
    search_fields = ('zona__nombre', 'zona__distrito')
    ordering_fields = ('registrado_en', 'decibeles')
    ordering = ('-registrado_en',)

    @extend_schema(request=None, responses={200: MultaSerializer})
    @action(detail=True, methods=['post'], url_path='emitir-multa')
    def emitir_multa(self, request, pk=None):
        medicion = self.get_object()
        if medicion.estado_revision != MedicionRuido.Estado.VALIDADA:
            return Response(
                {'detalle': 'Solo se puede multar una medición validada.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not medicion.excede_limite:
            return Response(
                {'detalle': 'La medición no supera el límite de la zona.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if medicion.multa_emitida:
            return Response(
                {'detalle': 'Esta medición ya tiene una multa emitida.'},
                status=status.HTTP_409_CONFLICT,
            )
        medicion.multa_monto = medicion.calcular_multa()
        medicion.multa_emitida = True
        medicion.save(update_fields=['multa_emitida', 'multa_monto'])
        return Response(MultaSerializer({
            'id': medicion.pk,
            'zona': medicion.zona.nombre,
            'decibeles': float(medicion.decibeles),
            'limite_db': medicion.zona.limite_db,
            'exceso_db': float(medicion.exceso_db),
            'monto': medicion.multa_monto,
            'moneda': 'PEN',
        }).data)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    @action(detail=False, methods=['get'])
    def resumen(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        base = queryset.aggregate(
            total=Count('id'),
            promedio=Avg('decibeles'),
            maximo=Max('decibeles'),
            pendientes=Count('id', filter=Q(estado_revision=MedicionRuido.Estado.PENDIENTE)),
            excedidas=Count('id', filter=Q(decibeles__gt=F('zona__limite_db'))),
        )
        zonas = (
            queryset.order_by()
            .values('zona_id', 'zona__nombre', 'zona__distrito', 'zona__limite_db')
            .annotate(promedio=Avg('decibeles'), total=Count('id'))
            .order_by('-promedio')[:5]
        )
        fuentes = (
            queryset.order_by()
            .values('fuente')
            .annotate(total=Count('id'))
            .order_by('-total')
        )
        return Response({
            'total': base['total'],
            'promedio': redondear(base['promedio']),
            'maximo': redondear(base['maximo']),
            'pendientes': base['pendientes'],
            'excedidas': base['excedidas'],
            'por_franja': resumen_por_franja(queryset),
            'por_fuente': list(fuentes),
            'top_zonas': [
                {
                    'zona_id': fila['zona_id'],
                    'nombre': fila['zona__nombre'],
                    'distrito': fila['zona__distrito'],
                    'limite_db': fila['zona__limite_db'],
                    'promedio': redondear(fila['promedio']),
                    'total': fila['total'],
                }
                for fila in zonas
            ],
        })