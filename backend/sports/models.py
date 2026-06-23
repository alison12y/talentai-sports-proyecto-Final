from django.db import models
from django.db.models.functions import Lower
from django.utils import timezone
import uuid


class CategoriaDeportiva(models.Model):
    club = models.ForeignKey(
        'clubs.Club',
        models.CASCADE,
        related_name='categorias_deportivas',
    )
    nombre = models.CharField(max_length=100)
    descripcion = models.TextField(null=True, blank=True)
    edad_minima = models.PositiveSmallIntegerField(null=True, blank=True)
    edad_maxima = models.PositiveSmallIntegerField(null=True, blank=True)
    activo = models.BooleanField(default=True)
    predefinida = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'categoria_deportiva'
        ordering = ['nombre']
        constraints = [
            models.UniqueConstraint(
                Lower('nombre'),
                'club',
                name='unique_category_name_per_club_ci',
            ),
        ]

    def __str__(self):
        return self.nombre


class Equipo(models.Model):
    id = models.UUIDField(primary_key=True)
    club = models.ForeignKey(
        'clubs.Club',
        models.DO_NOTHING,
        db_column='club_id',
    )
    nombre = models.CharField(max_length=255)
    categoria = models.CharField(max_length=100)
    temporada = models.CharField(max_length=100)
    descripcion = models.TextField(null=True, blank=True)
    activo = models.BooleanField()
    creado_en = models.DateTimeField()
    actualizado_en = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'equipo'


class EntrenadorEquipo(models.Model):
    id = models.UUIDField(primary_key=True)
    equipo = models.ForeignKey(
        Equipo,
        models.DO_NOTHING,
        db_column='equipo_id',
    )
    usuario = models.ForeignKey(
        'users.Usuario',
        models.DO_NOTHING,
        db_column='usuario_id',
    )
    es_principal = models.BooleanField()
    creado_en = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'entrenador_equipo'


class Jugador(models.Model):
    id = models.UUIDField(primary_key=True)
    club = models.ForeignKey(
        'clubs.Club',
        models.DO_NOTHING,
        db_column='club_id',
    )
    nombre = models.CharField(max_length=255)
    apellido = models.CharField(max_length=255)
    fecha_nacimiento = models.DateField()
    categoria = models.CharField(max_length=100, null=True, blank=True)
    dni = models.CharField(max_length=100, unique=True, null=True, blank=True)
    foto_url = models.TextField(null=True, blank=True)
    posicion_principal = models.CharField(max_length=100, null=True, blank=True)
    posicion_secundaria = models.CharField(max_length=100, null=True, blank=True)
    pie_dominante = models.CharField(max_length=50, null=True, blank=True)
    numero_camiseta = models.IntegerField(null=True, blank=True)
    estado = models.CharField(max_length=100)
    notas = models.TextField(null=True, blank=True)
    creado_en = models.DateTimeField()
    actualizado_en = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'jugador'


class JugadorEquipo(models.Model):
    id = models.UUIDField(primary_key=True)
    jugador = models.ForeignKey(
        Jugador,
        models.DO_NOTHING,
        db_column='jugador_id',
    )
    equipo = models.ForeignKey(
        Equipo,
        models.DO_NOTHING,
        db_column='equipo_id',
    )
    fecha_inicio = models.DateField()
    fecha_fin = models.DateField(null=True, blank=True)
    activo = models.BooleanField()
    creado_en = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'jugador_equipo'


class TutorJugador(models.Model):
    id = models.UUIDField(primary_key=True)
    jugador = models.ForeignKey(
        Jugador,
        models.DO_NOTHING,
        db_column='jugador_id',
    )
    usuario = models.ForeignKey(
        'users.Usuario',
        models.DO_NOTHING,
        db_column='usuario_id',
    )
    parentesco = models.CharField(max_length=100)
    es_contacto_principal = models.BooleanField()
    creado_en = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'tutor_jugador'


class EvolucionFisica(models.Model):
    id = models.UUIDField(primary_key=True)
    jugador = models.ForeignKey(
        Jugador,
        models.DO_NOTHING,
        db_column='jugador_id',
    )
    fecha = models.DateField()
    peso_kg = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    altura_cm = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    velocidad_40m = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    resistencia = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    test_cooper = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    notas = models.TextField(null=True, blank=True)
    creado_en = models.DateTimeField()
    actualizado_en = models.DateTimeField(default=timezone.now)
    activo = models.BooleanField(default=True)

    class Meta:
        managed = False
        db_table = 'evolucion_fisica'


class Evento(models.Model):
    class Tipo(models.TextChoices):
        ENTRENAMIENTO = 'ENTRENAMIENTO', 'Entrenamiento'
        PARTIDO = 'PARTIDO', 'Partido'
        REUNION = 'REUNION', 'Reunión'
        OTRO = 'OTRO', 'Otro'

    class Estado(models.TextChoices):
        PROGRAMADO = 'PROGRAMADO', 'Programado'
        CANCELADO = 'CANCELADO', 'Cancelado'
        FINALIZADO = 'FINALIZADO', 'Finalizado'

    id = models.UUIDField(primary_key=True)
    club = models.ForeignKey(
        'clubs.Club',
        models.DO_NOTHING,
        db_column='club_id',
    )
    equipo = models.ForeignKey(
        Equipo,
        models.DO_NOTHING,
        db_column='equipo_id',
        null=True,
        blank=True,
    )
    tipo = models.CharField(max_length=100, choices=Tipo.choices)
    titulo = models.CharField(max_length=255)
    descripcion = models.TextField(null=True, blank=True)
    rival = models.CharField(max_length=255, null=True, blank=True)
    ubicacion = models.CharField(max_length=255, null=True, blank=True)
    fecha_inicio = models.DateTimeField()
    fecha_fin = models.DateTimeField()
    estado = models.CharField(
        max_length=100,
        choices=Estado.choices,
        default=Estado.PROGRAMADO,
    )
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField()
    actualizado_en = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'evento'


class Convocatoria(models.Model):
    class Estado(models.TextChoices):
        PENDIENTE = 'PENDIENTE', 'Pendiente'
        CONFIRMADO = 'CONFIRMADO', 'Confirmado'
        RECHAZADO = 'RECHAZADO', 'Rechazado'
        NO_CONVOCADO = 'NO_CONVOCADO', 'No convocado'

    id = models.UUIDField(primary_key=True)
    evento = models.ForeignKey(
        Evento,
        models.DO_NOTHING,
        db_column='evento_id',
    )
    jugador = models.ForeignKey(
        Jugador,
        models.DO_NOTHING,
        db_column='jugador_id',
    )
    confirmado = models.BooleanField(null=True, blank=True)
    confirmado_en = models.DateTimeField(null=True, blank=True)
    estado = models.CharField(
        max_length=100,
        choices=Estado.choices,
        default=Estado.PENDIENTE,
    )
    fecha_notificacion = models.DateTimeField(null=True, blank=True)
    notas = models.TextField(null=True, blank=True)
    respuesta = models.CharField(max_length=20, null=True, blank=True)
    motivo_rechazo = models.TextField(null=True, blank=True)
    respondido_en = models.DateTimeField(null=True, blank=True)
    actualizado_en = models.DateTimeField(default=timezone.now)
    creado_en = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'convocatoria'
        constraints = [
            models.UniqueConstraint(
                fields=('evento', 'jugador'),
                name='unique_convocatoria_evento_jugador',
            ),
        ]


class Asistencia(models.Model):
    class Estado(models.TextChoices):
        PRESENTE = 'PRESENTE', 'Presente'
        AUSENTE = 'AUSENTE', 'Ausente'
        JUSTIFICADO = 'JUSTIFICADO', 'Justificado'

    id = models.UUIDField(primary_key=True)
    evento = models.ForeignKey(
        Evento,
        models.DO_NOTHING,
        db_column='evento_id',
    )
    jugador = models.ForeignKey(
        Jugador,
        models.DO_NOTHING,
        db_column='jugador_id',
    )
    # Campos legados conservados para compatibilidad con la tabla existente.
    presente = models.BooleanField(default=False)
    justificado = models.BooleanField(default=False)
    motivo_ausencia = models.TextField(null=True, blank=True)
    creado_en = models.DateTimeField(default=timezone.now)
    estado = models.CharField(
        max_length=20,
        choices=Estado.choices,
        default=Estado.AUSENTE,
    )
    motivo = models.TextField(null=True, blank=True)
    registrado_en = models.DateTimeField(default=timezone.now)
    actualizado_en = models.DateTimeField(default=timezone.now)
    activo = models.BooleanField(default=True)

    class Meta:
        managed = False
        db_table = 'asistencia'


class Partido(models.Model):
    id = models.UUIDField(primary_key=True)
    equipo = models.ForeignKey(
        Equipo,
        models.DO_NOTHING,
        db_column='equipo_id',
    )
    evento = models.ForeignKey(
        Evento,
        models.DO_NOTHING,
        db_column='evento_id',
        unique=True,
        null=True,
        blank=True,
    )
    nombre_rival = models.CharField(max_length=255)
    fecha = models.DateTimeField()
    ubicacion = models.CharField(max_length=255, null=True, blank=True)
    goles_local = models.IntegerField()
    goles_rival = models.IntegerField()
    resultado = models.CharField(max_length=100, null=True, blank=True)
    notas_tacticas = models.TextField(null=True, blank=True)
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField()
    actualizado_en = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'partido'


class EstadisticaPartido(models.Model):
    id = models.UUIDField(primary_key=True)
    partido = models.ForeignKey(
        Partido,
        models.DO_NOTHING,
        db_column='partido_id',
    )
    jugador = models.ForeignKey(
        Jugador,
        models.DO_NOTHING,
        db_column='jugador_id',
    )
    minutos_jugados = models.IntegerField()
    goles = models.IntegerField()
    asistencias = models.IntegerField()
    tarjetas_amarillas = models.IntegerField()
    tarjetas_rojas = models.IntegerField()
    valoracion = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    notas = models.TextField(null=True, blank=True)
    creado_en = models.DateTimeField()
    actualizado_en = models.DateTimeField(default=timezone.now)
    activo = models.BooleanField(default=True)

    class Meta:
        managed = False
        db_table = 'estadistica_partido'

class VideoPartido(models.Model):
    class EstadoAnalisis(models.TextChoices):
        SIN_VIDEO = 'SIN_VIDEO', 'Sin Video'
        PENDIENTE = 'PENDIENTE', 'Pendiente'
        PROCESANDO = 'PROCESANDO', 'Procesando'
        COMPLETADO = 'COMPLETADO', 'Completado'
        ERROR = 'ERROR', 'Error'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    partido = models.OneToOneField(
        Partido,
        on_delete=models.CASCADE,
        related_name='video_analisis'
    )
    video_url = models.URLField(max_length=500, null=True, blank=True)
    video_key = models.CharField(max_length=255, null=True, blank=True)
    video_nombre_original = models.CharField(max_length=255, null=True, blank=True)
    video_tamano = models.BigIntegerField(null=True, blank=True)
    video_content_type = models.CharField(max_length=100, null=True, blank=True)
    analisis_estado = models.CharField(
        max_length=50,
        choices=EstadoAnalisis.choices,
        default=EstadoAnalisis.SIN_VIDEO
    )
    analisis_progreso = models.IntegerField(default=0)
    analisis_error = models.TextField(null=True, blank=True)
    analisis_iniciado_en = models.DateTimeField(null=True, blank=True)
    analisis_finalizado_en = models.DateTimeField(null=True, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'video_partido'

class InformeScouting(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    partido = models.OneToOneField(
        Partido,
        on_delete=models.CASCADE,
        related_name='informe_scouting'
    )
    video = models.ForeignKey(
        VideoPartido,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    resumen = models.TextField(null=True, blank=True)
    metricas_json = models.JSONField(null=True, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'informe_scouting'


class AlertaRiesgoLesion(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    jugador = models.ForeignKey(Jugador, on_delete=models.CASCADE, related_name='alertas_lesion')
    equipo = models.ForeignKey(Equipo, on_delete=models.CASCADE, related_name='alertas_lesion')
    nivel = models.CharField(max_length=20, choices=[('INFO', 'Info'), ('WARNING', 'Warning'), ('CRITICAL', 'Critical')], default='INFO')
    minutos_semana = models.IntegerField(default=0)
    score_riesgo = models.IntegerField(default=0)
    motivo = models.TextField()
    recomendacion = models.TextField()
    estado = models.CharField(max_length=20, choices=[('ACTIVA', 'Activa'), ('VISTA', 'Vista')], default='ACTIVA')
    fecha_generacion = models.DateTimeField(auto_now_add=True)
    vista_en = models.DateTimeField(null=True, blank=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'alerta_riesgo_lesion'
        ordering = ['-fecha_generacion']

class RecomendacionAscenso(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    jugador = models.ForeignKey(Jugador, on_delete=models.CASCADE, related_name='recomendaciones_ascenso')
    equipo_actual = models.ForeignKey(Equipo, on_delete=models.CASCADE, related_name='recomendaciones_ascenso')
    categoria_actual = models.CharField(max_length=100)
    categoria_recomendada = models.CharField(max_length=100)
    score_promedio = models.DecimalField(max_digits=5, decimal_places=2)
    analisis_considerados = models.IntegerField(default=0)
    nivel = models.CharField(max_length=50, choices=[('TALENTO_DESTACADO', 'Talento Destacado'), ('LISTO_PARA_ASCENSO', 'Listo para Ascenso')])
    motivo = models.TextField()
    recomendacion = models.TextField()
    estado = models.CharField(max_length=20, choices=[('ACTIVA', 'Activa'), ('REVISADA', 'Revisada'), ('SEGUIMIENTO', 'Seguimiento')], default='ACTIVA')
    accion_seguimiento = models.TextField(null=True, blank=True)
    fecha_generacion = models.DateTimeField(auto_now_add=True)
    revisada_en = models.DateTimeField(null=True, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'recomendacion_ascenso'
        ordering = ['-fecha_generacion']
