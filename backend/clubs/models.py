from django.db import models


class Club(models.Model):
    id = models.UUIDField(primary_key=True)
    nombre = models.CharField(max_length=255)
    slug = models.CharField(max_length=255, unique=True)
    descripcion = models.TextField(null=True, blank=True)
    logo_url = models.TextField(null=True, blank=True)
    direccion = models.TextField(null=True, blank=True)
    colores = models.CharField(max_length=255, null=True, blank=True)
    ciudad = models.CharField(max_length=255, null=True, blank=True)
    pais = models.CharField(max_length=255, null=True, blank=True)
    email_contacto = models.EmailField(max_length=254, null=True, blank=True)
    telefono = models.CharField(max_length=50, null=True, blank=True)
    plan = models.CharField(max_length=50, default='BASICO')
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField()
    actualizado_en = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'club'
