import uuid
from urllib.parse import urlparse

from django.utils import timezone
from django.utils.text import slugify
from rest_framework import serializers

from .models import Club


class ClubSerializer(serializers.ModelSerializer):
    class Meta:
        model = Club
        fields = (
            'id', 'nombre', 'slug', 'descripcion', 'direccion', 'telefono',
            'email_contacto', 'colores', 'logo_url', 'ciudad', 'pais', 'plan',
            'activo', 'creado_en', 'actualizado_en',
        )
        read_only_fields = ('id', 'slug', 'plan', 'activo', 'creado_en', 'actualizado_en')
        extra_kwargs = {
            'nombre': {'required': True, 'allow_blank': False},
            'email_contacto': {'required': True, 'allow_blank': False, 'allow_null': False},
        }

    def validate_nombre(self, value):
        nombre = value.strip()
        if not nombre:
            raise serializers.ValidationError('El nombre del club es obligatorio.')

        queryset = Club.objects.filter(nombre__iexact=nombre)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError('Ya existe un club registrado con ese nombre.')
        return nombre

    def validate_email_contacto(self, value):
        email = value.strip().lower()
        if not email:
            raise serializers.ValidationError('El correo de contacto es obligatorio.')
        return email

    @staticmethod
    def _available_slug(nombre, instance=None):
        base_slug = slugify(nombre)[:230] or 'club'
        slug = base_slug
        while True:
            queryset = Club.objects.filter(slug=slug)
            if instance:
                queryset = queryset.exclude(pk=instance.pk)
            if not queryset.exists():
                break
            slug = f'{base_slug}-{uuid.uuid4().hex[:8]}'
        return slug

    def create(self, validated_data):
        now = timezone.now()
        validated_data.update({
            'id': uuid.uuid4(),
            'slug': self._available_slug(validated_data['nombre']),
            'plan': 'BASICO',
            'activo': True,
            'creado_en': now,
            'actualizado_en': now,
        })
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if 'nombre' in validated_data and validated_data['nombre'] != instance.nombre:
            validated_data['slug'] = self._available_slug(validated_data['nombre'], instance)
        validated_data['actualizado_en'] = timezone.now()
        return super().update(instance, validated_data)


class ClubConfigSerializer(serializers.ModelSerializer):
    logo_url = serializers.URLField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = Club
        fields = (
            'nombre', 'descripcion', 'direccion', 'telefono', 'email_contacto',
            'colores', 'logo_url', 'ciudad', 'pais',
        )
        extra_kwargs = {
            'nombre': {'required': True, 'allow_blank': False},
            'email_contacto': {'required': True, 'allow_blank': False, 'allow_null': False},
        }

    def validate_nombre(self, value):
        nombre = value.strip()
        if not nombre:
            raise serializers.ValidationError('El nombre del club es obligatorio.')
        queryset = Club.objects.filter(nombre__iexact=nombre)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError('Ya existe un club registrado con ese nombre.')
        return nombre

    def validate_email_contacto(self, value):
        email = value.strip().lower()
        if not email:
            raise serializers.ValidationError('El correo de contacto es obligatorio.')
        return email

    def validate_logo_url(self, value):
        if not value:
            return None
        image_extensions = ('.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif')
        if not urlparse(value).path.lower().endswith(image_extensions):
            raise serializers.ValidationError('La URL del logotipo debe apuntar a una imagen válida.')
        return value

    def update(self, instance, validated_data):
        if 'nombre' in validated_data and validated_data['nombre'] != instance.nombre:
            validated_data['slug'] = ClubSerializer._available_slug(validated_data['nombre'], instance)
        validated_data['actualizado_en'] = timezone.now()
        return super().update(instance, validated_data)


class SeleccionarPlanSerializer(serializers.Serializer):
    PLANES_VALIDOS = {'BASICO', 'PRO', 'ELITE'}

    plan = serializers.CharField(required=True)

    def validate_plan(self, value):
        plan = value.strip().upper()
        if plan not in self.PLANES_VALIDOS:
            raise serializers.ValidationError('El plan debe ser BASICO, PRO o ELITE.')
        return plan
