from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class ZonaUrbana(models.Model):
    class TipoUso(models.TextChoices):
        RESIDENCIAL = 'residencial', 'Residencial'
        COMERCIAL = 'comercial', 'Comercial'
        HOSPITAL = 'hospital', 'Hospital'

    DISTRITOS = [
        'Huancayo', 'Carhuacallanga', 'Chacapampa', 'Chicche', 'Chilca', 'Chongos Alto',
        'Chupuro', 'Colca', 'Cullhuas', 'El Tambo', 'Huacrapuquio', 'Hualhuas', 'Huancán',
        'Huasicancha', 'Huayucachi', 'Ingenio', 'Pariahuanca', 'Pilcomayo', 'Pucará',
        'Quichuay', 'Quilcas', 'San Agustín de Cajas', 'San Jerónimo de Tunán', 'Saño',
        'Sapallanga', 'Sicaya', 'Santo Domingo de Acobamba', 'Viques',
    ]

    nombre = models.CharField(max_length=120)
    distrito = models.CharField(max_length=40, choices=[(d, d) for d in DISTRITOS], default='Huancayo')
    tipo_uso = models.CharField(max_length=20, choices=TipoUso.choices, default=TipoUso.RESIDENCIAL)
    limite_db = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(30), MaxValueValidator(120)],
        help_text='Límite referencial en decibeles para la zona.',
    )

    class Meta:
        ordering = ('distrito', 'nombre')
        verbose_name = 'zona urbana'
        verbose_name_plural = 'zonas urbanas'
        constraints = [
            models.UniqueConstraint(fields=['nombre', 'distrito'], name='zona_unica_por_distrito'),
        ]

    def __str__(self):
        return f'{self.nombre} ({self.distrito})'


class MedicionRuido(models.Model):
    class Fuente(models.TextChoices):
        TRAFICO = 'trafico', 'Tráfico vehicular'
        CONSTRUCCION = 'construccion', 'Construcción'
        COMERCIO = 'comercio', 'Comercio ambulante'
        INDUSTRIA = 'industria', 'Industria'
        EVENTO = 'evento', 'Eventos y fiestas'
        VECINDAD = 'vecindad', 'Vecindad'
        OTRO = 'otro', 'Otra fuente'

    class Estado(models.TextChoices):
        PENDIENTE = 'pendiente', 'Pendiente'
        VALIDADA = 'validada', 'Validada'
        RECHAZADA = 'rechazada', 'Rechazada'

    TARIFA_POR_DB = Decimal('25.00')

    zona = models.ForeignKey(ZonaUrbana, on_delete=models.CASCADE, related_name='mediciones')
    decibeles = models.DecimalField(
        max_digits=5,
        decimal_places=1,
        validators=[MinValueValidator(Decimal('20')), MaxValueValidator(Decimal('140'))],
    )
    fuente = models.CharField(max_length=20, choices=Fuente.choices)
    estado_revision = models.CharField(
        max_length=20, choices=Estado.choices, default=Estado.PENDIENTE, db_index=True
    )
    registrado_en = models.DateTimeField(auto_now_add=True, db_index=True)
    multa_emitida = models.BooleanField(default=False)
    multa_monto = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)

    class Meta:
        ordering = ('-registrado_en',)
        verbose_name = 'medición de ruido'
        verbose_name_plural = 'mediciones de ruido'
        indexes = [
            models.Index(fields=['estado_revision', 'registrado_en'], name='med_estado_fecha_idx'),
            models.Index(fields=['zona', 'registrado_en'], name='med_zona_fecha_idx'),
        ]

    def __str__(self):
        return f'{self.zona.nombre}: {self.decibeles} dB'

    @property
    def exceso_db(self):
        diferencia = Decimal(str(self.decibeles)) - Decimal(self.zona.limite_db)
        return max(diferencia, Decimal('0'))

    @property
    def excede_limite(self):
        return self.exceso_db > 0

    def calcular_multa(self):
        return (self.exceso_db * self.TARIFA_POR_DB).quantize(Decimal('0.01'))