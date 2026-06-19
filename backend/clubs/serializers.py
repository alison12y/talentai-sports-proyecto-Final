import uuid

from django.utils import timezone
from rest_framework import serializers

from .models import Club


class ClubSerializer(serializers.ModelSerializer):
    class Meta:
        model = Club
        fields = '__all__'
        read_only_fields = ('id', 'creado_en', 'actualizado_en')

    def validate_nombre(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError('El nombre no puede estar vacio.')
        return value.strip()

    def validate_slug(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError('El slug no puede estar vacio.')

        slug = value.strip()
        queryset = Club.objects.filter(slug=slug)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)

        if queryset.exists():
            raise serializers.ValidationError('Ya existe un club con este slug.')

        return slug

    def create(self, validated_data):
        now = timezone.now()
        validated_data.setdefault('id', uuid.uuid4())
        validated_data.setdefault('plan', 'BASICO')
        validated_data.setdefault('activo', True)
        validated_data.setdefault('creado_en', now)
        validated_data.setdefault('actualizado_en', now)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data['actualizado_en'] = timezone.now()
        return super().update(instance, validated_data)


class ClubConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = Club
        fields = (
            'nombre',
            'descripcion',
            'logo_url',
            'ciudad',
            'pais',
            'email_contacto',
            'telefono',
        )

    def validate_nombre(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError('El nombre no puede estar vacio.')
        return value.strip()

    def update(self, instance, validated_data):
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
