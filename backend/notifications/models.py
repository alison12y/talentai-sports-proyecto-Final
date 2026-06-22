from django.db import models


import uuid
from django.utils import timezone

class Notificacion(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    usuario = models.ForeignKey(
        'users.Usuario',
        models.CASCADE,
        db_column='usuario_id',
        null=True,
        blank=True,
    )
    club = models.ForeignKey(
        'clubs.Club',
        models.CASCADE,
        db_column='club_id',
        null=True,
        blank=True,
    )
    tipo = models.CharField(max_length=100)
    titulo = models.CharField(max_length=255)
    cuerpo = models.TextField(null=True, blank=True)
    data_extra = models.JSONField(null=True, blank=True)
    leida = models.BooleanField(default=False)
    enviada_push = models.BooleanField(default=False)
    fecha_lectura = models.DateTimeField(null=True, blank=True)
    creado_en = models.DateTimeField(default=timezone.now)
    actualizado_en = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'notificacion'
        ordering = ['-creado_en']
