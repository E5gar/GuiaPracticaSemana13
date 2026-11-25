import django_filters
from django.db.models import F

from .models import MedicionRuido, ZonaUrbana


class ZonaUrbanaFilter(django_filters.FilterSet):
    class Meta:
        model = ZonaUrbana
        fields = ('tipo_uso', 'distrito')


class MedicionRuidoFilter(django_filters.FilterSet):
    distrito = django_filters.CharFilter(field_name='zona__distrito', lookup_expr='iexact')
    tipo_uso = django_filters.CharFilter(field_name='zona__tipo_uso')
    desde = django_filters.DateFilter(field_name='registrado_en', lookup_expr='date__gte')
    hasta = django_filters.DateFilter(field_name='registrado_en', lookup_expr='date__lte')
    db_min = django_filters.NumberFilter(field_name='decibeles', lookup_expr='gte')
    db_max = django_filters.NumberFilter(field_name='decibeles', lookup_expr='lte')
    excede_limite = django_filters.BooleanFilter(method='filtrar_excede_limite')

    class Meta:
        model = MedicionRuido
        fields = ('estado_revision', 'fuente', 'zona', 'multa_emitida')

    def filtrar_excede_limite(self, queryset, nombre, valor):
        if valor is None:
            return queryset
        if valor:
            return queryset.filter(decibeles__gt=F('zona__limite_db'))
        return queryset.filter(decibeles__lte=F('zona__limite_db'))