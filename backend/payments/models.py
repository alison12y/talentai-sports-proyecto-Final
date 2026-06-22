from django.db import models
from django.db.models import Q
from django.utils import timezone


class PlanSaaS(models.Model):
    codigo = models.CharField(max_length=20, unique=True)
    nombre = models.CharField(max_length=100, unique=True)
    descripcion = models.TextField()
    precio_mensual = models.DecimalField(max_digits=10, decimal_places=2)
    limite_jugadores = models.PositiveIntegerField(null=True, blank=True)
    limite_equipos = models.PositiveIntegerField(null=True, blank=True)
    incluye_ia = models.BooleanField(default=False)
    incluye_reportes = models.BooleanField(default=False)
    soporte = models.CharField(max_length=100)
    caracteristicas = models.JSONField(default=list, blank=True)
    activo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'plan_saas'
        ordering = ['precio_mensual', 'id']

    def __str__(self):
        return self.nombre


class ClubPlan(models.Model):
    class Estado(models.TextChoices):
        ACTIVA = 'ACTIVA', 'Activa'
        CANCELADA = 'CANCELADA', 'Cancelada'
        VENCIDA = 'VENCIDA', 'Vencida'

    club = models.ForeignKey(
        'clubs.Club',
        models.DO_NOTHING,
        related_name='suscripciones_saas',
    )
    plan = models.ForeignKey(
        PlanSaaS,
        models.PROTECT,
        related_name='suscripciones',
    )
    activo = models.BooleanField(default=True)
    fecha_inicio = models.DateTimeField(default=timezone.now)
    fecha_fin = models.DateTimeField(null=True, blank=True)
    estado = models.CharField(max_length=20, choices=Estado.choices, default=Estado.ACTIVA)
    metodo_pago = models.CharField(max_length=50, null=True, blank=True)
    referencia = models.CharField(max_length=100, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'club_plan'
        ordering = ['-fecha_inicio']
        constraints = [
            models.UniqueConstraint(
                fields=['club'],
                condition=Q(activo=True),
                name='unique_active_plan_per_club',
            ),
        ]


class Cuota(models.Model):
    class Estado(models.TextChoices):
        ACTIVA = 'ACTIVA', 'Activa'
        INACTIVA = 'INACTIVA', 'Inactiva'

    id = models.UUIDField(primary_key=True)
    club = models.ForeignKey(
        'clubs.Club',
        models.DO_NOTHING,
        db_column='club_id',
    )
    equipo = models.ForeignKey(
        'sports.Equipo',
        models.DO_NOTHING,
        db_column='equipo_id',
        null=True,
        blank=True,
    )
    concepto = models.CharField(max_length=255)
    descripcion = models.TextField(null=True, blank=True)
    tipo = models.CharField(max_length=100, null=True, blank=True)
    monto = models.DecimalField(max_digits=10, decimal_places=2)
    moneda = models.CharField(max_length=10)
    periodo = models.CharField(max_length=100, null=True, blank=True)
    fecha_vencimiento = models.DateField()
    estado = models.CharField(
        max_length=20,
        choices=Estado.choices,
        default=Estado.ACTIVA,
    )
    creado_en = models.DateTimeField()
    actualizado_en = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'cuota'


class Pago(models.Model):
    class Estado(models.TextChoices):
        PENDIENTE = 'PENDIENTE', 'Pendiente'
        PAGADO = 'PAGADO', 'Pagado'
        VENCIDO = 'VENCIDO', 'Vencido'
        CANCELADO = 'CANCELADO', 'Cancelado'

    id = models.UUIDField(primary_key=True)
    cuota = models.ForeignKey(
        Cuota,
        models.DO_NOTHING,
        db_column='cuota_id',
    )
    jugador = models.ForeignKey(
        'sports.Jugador',
        models.DO_NOTHING,
        db_column='jugador_id',
    )
    monto = models.DecimalField(max_digits=10, decimal_places=2)
    moneda = models.CharField(max_length=10, default='BOB')
    estado = models.CharField(
        max_length=100,
        choices=Estado.choices,
        default=Estado.PENDIENTE,
    )
    monto_pagado = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    fecha_pago = models.DateField(null=True, blank=True)
    metodo_pago = models.CharField(max_length=100, null=True, blank=True)
    fecha_vencimiento = models.DateField()
    referencia = models.CharField(max_length=255, null=True, blank=True)
    observaciones = models.TextField(null=True, blank=True)
    comprobante_url = models.TextField(null=True, blank=True)
    notas = models.TextField(null=True, blank=True)
    creado_en = models.DateTimeField()
    actualizado_en = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'pago'
        constraints = [
            models.UniqueConstraint(
                fields=('cuota', 'jugador'),
                name='unique_pago_cuota_jugador',
            ),
        ]
