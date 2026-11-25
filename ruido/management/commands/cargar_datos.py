import random
from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from ruido.models import MedicionRuido, ZonaUrbana

ZONAS = [
    ('Plaza Constitución', 'Huancayo', 'comercial'),
    ('Calle Real', 'Huancayo', 'comercial'),
    ('Feria Dominical', 'Huancayo', 'comercial'),
    ('Barrio San Carlos', 'Huancayo', 'residencial'),
    ('Urbanización Palián', 'Huancayo', 'residencial'),
    ('Hospital Daniel Alcides Carrión', 'Huancayo', 'hospital'),
    ('Mercado Modelo', 'El Tambo', 'comercial'),
    ('Avenida Mariscal Castilla', 'El Tambo', 'comercial'),
    ('Urbanización Santa Rosa', 'El Tambo', 'residencial'),
    ('Hospital Ramiro Prialé Prialé', 'El Tambo', 'hospital'),
    ('Avenida Leoncio Prado', 'Chilca', 'comercial'),
    ('Asentamiento Ocopilla', 'Chilca', 'residencial'),
    ('Hospital El Carmen', 'Chilca', 'hospital'),
    ('Plaza de Pilcomayo', 'Pilcomayo', 'residencial'),
    ('Plaza de San Agustín de Cajas', 'San Agustín de Cajas', 'comercial'),
    ('Centro de Sapallanga', 'Sapallanga', 'residencial'),
    ('Plaza de Hualhuas', 'Hualhuas', 'comercial'),
    ('Plaza de Sicaya', 'Sicaya', 'residencial'),
    ('Centro de Huancán', 'Huancán', 'residencial'),
    ('Plaza de Quilcas', 'Quilcas', 'residencial'),
    ('Plaza de Viques', 'Viques', 'residencial'),
]

LIMITES = {'residencial': 60, 'comercial': 70, 'hospital': 50}

FUENTES_POR_TIPO = {
    'comercial': ['trafico', 'comercio', 'evento', 'construccion'],
    'residencial': ['vecindad', 'trafico', 'construccion', 'evento'],
    'hospital': ['trafico', 'construccion', 'otro'],
}

PESOS_HORA = [1, 1, 1, 1, 1, 2, 4, 7, 8, 6, 5, 5, 6, 6, 5, 5, 6, 8, 9, 8, 6, 4, 2, 1]


class Command(BaseCommand):
    help = 'Carga zonas urbanas y mediciones de ejemplo de la provincia de Huancayo'

    def add_arguments(self, parser):
        parser.add_argument('--mediciones', type=int, default=360)
        parser.add_argument('--limpiar', action='store_true')

    def handle(self, *args, **opciones):
        random.seed(2026)
        if opciones['limpiar']:
            MedicionRuido.objects.all().delete()
            ZonaUrbana.objects.all().delete()

        zonas = []
        for nombre, distrito, tipo in ZONAS:
            zona, _ = ZonaUrbana.objects.get_or_create(
                nombre=nombre,
                distrito=distrito,
                defaults={'tipo_uso': tipo, 'limite_db': LIMITES[tipo]},
            )
            zonas.append(zona)

        ahora = timezone.localtime(timezone.now())
        objetos = []
        fechas = []
        for _ in range(opciones['mediciones']):
            zona = random.choice(zonas)
            valor = min(max(random.gauss(zona.limite_db + 4, 9), 32), 118)
            estado = random.choices(['pendiente', 'validada', 'rechazada'], weights=[45, 40, 15])[0]
            objetos.append(
                MedicionRuido(
                    zona=zona,
                    decibeles=Decimal(str(round(valor, 1))),
                    fuente=random.choice(FUENTES_POR_TIPO[zona.tipo_uso]),
                    estado_revision=estado,
                )
            )
            hora = random.choices(range(24), weights=PESOS_HORA)[0]
            momento = (ahora - timedelta(days=random.randint(0, 30))).replace(
                hour=hora, minute=random.randint(0, 59), second=0, microsecond=0
            )
            if momento > ahora:
                momento -= timedelta(days=1)
            fechas.append(momento)

        creadas = MedicionRuido.objects.bulk_create(objetos)
        for objeto, fecha in zip(creadas, fechas):
            objeto.registrado_en = fecha
        MedicionRuido.objects.bulk_update(creadas, ['registrado_en'])

        self.stdout.write(
            self.style.SUCCESS(f'{len(zonas)} zonas y {len(creadas)} mediciones cargadas.')
        )