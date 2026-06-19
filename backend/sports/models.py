from django.db import models


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
    notas = models.TextField(null=True, blank=True)
    creado_en = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'evolucion_fisica'


class Evento(models.Model):
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
    tipo = models.CharField(max_length=100)
    titulo = models.CharField(max_length=255)
    descripcion = models.TextField(null=True, blank=True)
    ubicacion = models.CharField(max_length=255, null=True, blank=True)
    fecha_inicio = models.DateTimeField()
    fecha_fin = models.DateTimeField()
    creado_en = models.DateTimeField()
    actualizado_en = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'evento'


class Convocatoria(models.Model):
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
    notas = models.TextField(null=True, blank=True)
    creado_en = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'convocatoria'


class Asistencia(models.Model):
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
    presente = models.BooleanField()
    justificado = models.BooleanField()
    motivo_ausencia = models.TextField(null=True, blank=True)
    creado_en = models.DateTimeField()

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

    class Meta:
        managed = False
        db_table = 'estadistica_partido'
