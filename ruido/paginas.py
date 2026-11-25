from django.shortcuts import render
from django.views.decorators.csrf import ensure_csrf_cookie

from .models import MedicionRuido, ZonaUrbana

ICONOS_FUENTE = {
    'trafico': 'car',
    'construccion': 'hard-hat',
    'comercio': 'store',
    'industria': 'factory',
    'evento': 'party-popper',
    'vecindad': 'users',
    'otro': 'ellipsis',
}


def contexto(request, pagina):
    return {
        'pagina': pagina,
        'es_personal': request.user.is_authenticated and request.user.is_staff,
        'distritos': ZonaUrbana.DISTRITOS,
        'tipos_uso': ZonaUrbana.TipoUso.choices,
        'estados': MedicionRuido.Estado.choices,
        'fuentes': [
            {'valor': valor, 'etiqueta': etiqueta, 'icono': ICONOS_FUENTE[valor]}
            for valor, etiqueta in MedicionRuido.Fuente.choices
        ],
    }


@ensure_csrf_cookie
def inicio(request):
    return render(request, 'inicio.html', contexto(request, 'inicio'))


@ensure_csrf_cookie
def zonas(request):
    return render(request, 'zonas.html', contexto(request, 'zonas'))


@ensure_csrf_cookie
def mediciones(request):
    return render(request, 'mediciones.html', contexto(request, 'mediciones'))


@ensure_csrf_cookie
def reportar(request):
    return render(request, 'reportar.html', contexto(request, 'reportar'))