from django.contrib import admin

from .models import MedicionRuido, ZonaUrbana


@admin.register(ZonaUrbana)
class ZonaUrbanaAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'distrito', 'tipo_uso', 'limite_db')
    list_filter = ('tipo_uso', 'distrito')
    search_fields = ('nombre', 'distrito')


@admin.register(MedicionRuido)
class MedicionRuidoAdmin(admin.ModelAdmin):
    list_display = ('id', 'zona', 'decibeles', 'fuente', 'estado_revision', 'multa_emitida', 'registrado_en')
    list_filter = ('estado_revision', 'fuente', 'multa_emitida', 'zona__tipo_uso')
    search_fields = ('zona__nombre', 'zona__distrito')
    list_select_related = ('zona',)
    date_hierarchy = 'registrado_en'
    actions = ('marcar_validadas', 'marcar_rechazadas')

    @admin.action(description='Marcar como validadas')
    def marcar_validadas(self, request, queryset):
        queryset.update(estado_revision=MedicionRuido.Estado.VALIDADA)

    @admin.action(description='Marcar como rechazadas')
    def marcar_rechazadas(self, request, queryset):
        queryset.update(estado_revision=MedicionRuido.Estado.RECHAZADA)