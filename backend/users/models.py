from django.db import models


class Usuario(models.Model):
    id = models.UUIDField(primary_key=True)
    email = models.EmailField(max_length=254, unique=True)
    password_hash = models.CharField(max_length=255)
    nombre = models.CharField(max_length=255)
    apellido = models.CharField(max_length=255)
    telefono = models.CharField(max_length=50, null=True, blank=True)
    avatar_url = models.TextField(null=True, blank=True)
    fecha_nacimiento = models.DateField(null=True, blank=True)
    activo = models.BooleanField()
    email_verificado = models.BooleanField()
    firebase_token = models.TextField(null=True, blank=True)
    ultimo_acceso = models.DateTimeField(null=True, blank=True)
    creado_en = models.DateTimeField()
    actualizado_en = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'usuario'


class UsuarioClub(models.Model):
    id = models.UUIDField(primary_key=True)
    usuario = models.ForeignKey(
        Usuario,
        models.DO_NOTHING,
        db_column='usuario_id',
    )
    club = models.ForeignKey(
        'clubs.Club',
        models.DO_NOTHING,
        db_column='club_id',
    )
    rol = models.CharField(max_length=100)
    estado = models.CharField(max_length=100)
    creado_en = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'usuario_club'
