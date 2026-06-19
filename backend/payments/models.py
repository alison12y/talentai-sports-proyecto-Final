from django.db import models


class Cuota(models.Model):
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
    tipo = models.CharField(max_length=100, null=True, blank=True)
    monto = models.DecimalField(max_digits=10, decimal_places=2)
    moneda = models.CharField(max_length=10)
    periodo = models.CharField(max_length=100, null=True, blank=True)
    fecha_vencimiento = models.DateField()
    creado_en = models.DateTimeField()
    actualizado_en = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'cuota'


class Pago(models.Model):
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
    estado = models.CharField(max_length=100)
    monto_pagado = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    fecha_pago = models.DateField(null=True, blank=True)
    metodo_pago = models.CharField(max_length=100, null=True, blank=True)
    comprobante_url = models.TextField(null=True, blank=True)
    notas = models.TextField(null=True, blank=True)
    creado_en = models.DateTimeField()
    actualizado_en = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'pago'
