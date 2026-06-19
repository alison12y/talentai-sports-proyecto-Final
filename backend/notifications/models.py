from django.db import models


class Notificacion(models.Model):
    id = models.UUIDField(primary_key=True)
    usuario = models.ForeignKey(
        'users.Usuario',
        models.DO_NOTHING,
        db_column='usuario_id',
    )
    club = models.ForeignKey(
        'clubs.Club',
        models.DO_NOTHING,
        db_column='club_id',
        null=True,
        blank=True,
    )
    tipo = models.CharField(max_length=100)
    titulo = models.CharField(max_length=255)
    cuerpo = models.TextField(null=True, blank=True)
    data_extra = models.JSONField(null=True, blank=True)
    leida = models.BooleanField()
    enviada_push = models.BooleanField()
    creado_en = models.DateTimeField()
    actualizado_en = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'notificacion'
