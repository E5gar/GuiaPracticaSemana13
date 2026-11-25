from datetime import timedelta

from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers
from rest_framework.reverse import reverse

from .models import MedicionRuido, ZonaUrbana


class ZonaUrbanaSerializer(serializers.HyperlinkedModelSerializer):
    total_mediciones = serializers.SerializerMethodField()
    enlaces = serializers.SerializerMethodField()

    class Meta:
        model = ZonaUrbana
        fields = ('url', 'id', 'nombre', 'distrito', 'tipo_uso', 'limite_db', 'total_mediciones', 'enlaces')
        extra_kwargs = {'url': {'view_name': 'zona-detail'}}

    def get_total_mediciones(self, obj) -> int:
        total = getattr(obj, 'total_mediciones', None)
        return obj.mediciones.count() if total is None else total

    @extend_schema_field(OpenApiTypes.OBJECT)
    def get_enlaces(self, obj):
        request = self.context.get('request')
        return {
            'promedio_ruido': reverse('zona-promedio-ruido', args=[obj.pk], request=request),
            'mediciones': f"{reverse('medicion-list', request=request)}?zona={obj.pk}",
        }


class MedicionRuidoSerializer(serializers.HyperlinkedModelSerializer):
    zona = serializers.HyperlinkedRelatedField(view_name='zona-detail', queryset=ZonaUrbana.objects.all())
    zona_nombre = serializers.ReadOnlyField(source='zona.nombre')
    zona_distrito = serializers.ReadOnlyField(source='zona.distrito')
    zona_tipo_uso = serializers.ReadOnlyField(source='zona.tipo_uso')
    limite_db = serializers.ReadOnlyField(source='zona.limite_db')
    excede_limite = serializers.SerializerMethodField()
    exceso_db = serializers.SerializerMethodField()
    enlaces = serializers.SerializerMethodField()

    class Meta:
        model = MedicionRuido
        fields = (
            'url', 'id', 'zona', 'zona_nombre', 'zona_distrito', 'zona_tipo_uso', 'limite_db',
            'decibeles', 'fuente', 'estado_revision', 'excede_limite', 'exceso_db',
            'multa_emitida', 'multa_monto', 'registrado_en', 'enlaces',
        )
        read_only_fields = ('multa_emitida', 'multa_monto', 'registrado_en')
        extra_kwargs = {'url': {'view_name': 'medicion-detail'}}

    @extend_schema_field(OpenApiTypes.BOOL)
    def get_excede_limite(self, obj):
        return obj.excede_limite

    @extend_schema_field(OpenApiTypes.FLOAT)
    def get_exceso_db(self, obj):
        return float(obj.exceso_db)

    @extend_schema_field(OpenApiTypes.OBJECT)
    def get_enlaces(self, obj):
        request = self.context.get('request')
        enlaces = {'zona': reverse('zona-detail', args=[obj.zona_id], request=request)}
        if (
            obj.estado_revision == MedicionRuido.Estado.VALIDADA
            and obj.excede_limite
            and not obj.multa_emitida
        ):
            enlaces['emitir_multa'] = reverse('medicion-emitir-multa', args=[obj.pk], request=request)
        return enlaces

    def validate_estado_revision(self, valor):
        request = self.context.get('request')
        es_personal = bool(request and request.user and request.user.is_staff)
        if valor != MedicionRuido.Estado.PENDIENTE and not es_personal:
            raise serializers.ValidationError(
                'Solo el personal autorizado puede cambiar el estado de revisión.'
            )
        return valor

    def validate(self, attrs):
        if self.instance is None:
            ventana = timezone.now() - timedelta(minutes=2)
            repetida = MedicionRuido.objects.filter(
                zona=attrs['zona'],
                decibeles=attrs['decibeles'],
                fuente=attrs['fuente'],
                registrado_en__gte=ventana,
            ).exists()
            if repetida:
                raise serializers.ValidationError(
                    'Ya se registró una medición idéntica para esta zona hace menos de 2 minutos.'
                )
        return attrs


class FranjaSerializer(serializers.Serializer):
    franja = serializers.CharField()
    promedio = serializers.FloatField(allow_null=True)
    total = serializers.IntegerField()


class PromedioRuidoSerializer(serializers.Serializer):
    zona = serializers.CharField()
    distrito = serializers.CharField()
    tipo_uso = serializers.CharField()
    limite_db = serializers.IntegerField()
    total = serializers.IntegerField()
    promedio = serializers.FloatField(allow_null=True)
    maximo = serializers.FloatField(allow_null=True)
    minimo = serializers.FloatField(allow_null=True)
    excedidas = serializers.IntegerField()
    por_franja = FranjaSerializer(many=True)


class MultaSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    zona = serializers.CharField()
    decibeles = serializers.FloatField()
    limite_db = serializers.IntegerField()
    exceso_db = serializers.FloatField()
    monto = serializers.DecimalField(max_digits=8, decimal_places=2)
    moneda = serializers.CharField()