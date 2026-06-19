from django.db import models


class Video(models.Model):
    id = models.UUIDField(primary_key=True)
    club = models.ForeignKey(
        'clubs.Club',
        models.DO_NOTHING,
        db_column='club_id',
    )
    partido = models.ForeignKey(
        'sports.Partido',
        models.DO_NOTHING,
        db_column='partido_id',
        null=True,
        blank=True,
    )
    usuario = models.ForeignKey(
        'users.Usuario',
        models.DO_NOTHING,
        db_column='usuario_id',
        null=True,
        blank=True,
    )
    nombre_archivo = models.CharField(max_length=255)
    r2_key = models.CharField(max_length=255)
    r2_url = models.TextField()
    duracion_seg = models.IntegerField(null=True, blank=True)
    tamanio_bytes = models.BigIntegerField(null=True, blank=True)
    estado_analisis = models.CharField(max_length=100)
    celery_task_id = models.CharField(max_length=255, null=True, blank=True)
    error_mensaje = models.TextField(null=True, blank=True)
    creado_en = models.DateTimeField()
    actualizado_en = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'video'


class AnalisisIa(models.Model):
    id = models.UUIDField(primary_key=True)
    video = models.OneToOneField(
        Video,
        models.DO_NOTHING,
        db_column='video_id',
    )
    resumen_tactico = models.TextField(null=True, blank=True)
    recomendaciones = models.TextField(null=True, blank=True)
    metadata_modelo = models.JSONField(null=True, blank=True)
    completado_en = models.DateTimeField(null=True, blank=True)
    creado_en = models.DateTimeField()
    actualizado_en = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'analisis_ia'


class MetricaIaJugador(models.Model):
    id = models.UUIDField(primary_key=True)
    analisis = models.ForeignKey(
        AnalisisIa,
        models.DO_NOTHING,
        db_column='analisis_id',
    )
    jugador = models.ForeignKey(
        'sports.Jugador',
        models.DO_NOTHING,
        db_column='jugador_id',
    )
    pases_completados = models.IntegerField()
    pases_fallidos = models.IntegerField()
    duelos_ganados = models.IntegerField()
    duelos_perdidos = models.IntegerField()
    distancia_recorrida_m = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    sprints = models.IntegerField()
    heatmap_url = models.TextField(null=True, blank=True)
    score_rendimiento = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    perfil_sugerido = models.CharField(max_length=255, null=True, blank=True)
    compatibilidad_pct = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    notas_ia = models.TextField(null=True, blank=True)
    creado_en = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'metrica_ia_jugador'


class AlertaIa(models.Model):
    id = models.UUIDField(primary_key=True)
    analisis = models.ForeignKey(
        AnalisisIa,
        models.DO_NOTHING,
        db_column='analisis_id',
    )
    club = models.ForeignKey(
        'clubs.Club',
        models.DO_NOTHING,
        db_column='club_id',
    )
    jugador = models.ForeignKey(
        'sports.Jugador',
        models.DO_NOTHING,
        db_column='jugador_id',
        null=True,
        blank=True,
    )
    tipo = models.CharField(max_length=100)
    descripcion = models.TextField(null=True, blank=True)
    nivel = models.CharField(max_length=100, null=True, blank=True)
    vista = models.BooleanField()
    creado_en = models.DateTimeField()
    actualizado_en = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'alerta_ia'
