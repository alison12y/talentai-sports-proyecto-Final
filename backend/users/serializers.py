import uuid

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from clubs.models import Club
from clubs.serializers import ClubSerializer
from payments.models import PlanSaaS
from payments.serializers import SeleccionarPlanSaaSSerializer

from .models import Usuario, UsuarioClub


class UsuarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Usuario
        fields = '__all__'


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(required=True, trim_whitespace=False)

    def validate_password(self, value):
        if not value:
            raise serializers.ValidationError('La password es obligatoria.')
        return value


class RecoverPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)


class OnboardingAdminSerializer(serializers.Serializer):
    nombre = serializers.CharField(required=True, allow_blank=False)
    apellido = serializers.CharField(required=True, allow_blank=False)
    telefono = serializers.CharField(required=True, allow_blank=False)
    correo = serializers.EmailField(required=True, allow_blank=False)
    password = serializers.CharField(
        required=True,
        allow_blank=False,
        min_length=6,
        trim_whitespace=False,
        write_only=True,
        error_messages={
            'min_length': 'La contraseña debe tener al menos 6 caracteres',
        },
    )

    def validate_correo(self, value):
        correo = value.strip().lower()
        if Usuario.objects.filter(email__iexact=correo).exists():
            raise serializers.ValidationError('Ya existe un usuario con ese correo')
        return correo

    def validate_password(self, value):
        if value.strip().lower() == 'admin':
            raise serializers.ValidationError('La contraseña no puede ser "admin"')
        return value


class OnboardingClubSerializer(serializers.Serializer):
    nombre = serializers.CharField(required=True, allow_blank=False)
    ciudad = serializers.CharField(required=True, allow_blank=False)
    telefono = serializers.CharField(required=True, allow_blank=False)
    correo = serializers.EmailField(required=True, allow_blank=False)
    direccion = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_nombre(self, value):
        nombre = value.strip()
        if Club.objects.filter(nombre__iexact=nombre).exists():
            raise serializers.ValidationError('Ya existe un club registrado con ese nombre')
        return nombre

    def validate_correo(self, value):
        return value.strip().lower()


class OnboardingUsuarioResponseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Usuario
        fields = ('id', 'email', 'nombre', 'apellido', 'telefono', 'activo')
        read_only_fields = fields


class OnboardingCompleteSerializer(serializers.Serializer):
    admin = OnboardingAdminSerializer()
    club = OnboardingClubSerializer()
    plan_id = serializers.IntegerField(required=True, min_value=1)

    def validate_plan_id(self, value):
        try:
            plan = PlanSaaS.objects.get(pk=value)
        except PlanSaaS.DoesNotExist:
            raise serializers.ValidationError('El plan seleccionado no existe')
        if not plan.activo:
            raise serializers.ValidationError('El plan seleccionado no está activo')
        return plan

    def create(self, validated_data):
        admin_data = validated_data['admin']
        club_data = validated_data['club']
        plan = validated_data['plan_id']
        now = timezone.now()

        with transaction.atomic():
            usuario = Usuario.objects.create(
                id=uuid.uuid4(),
                email=admin_data['correo'],
                password_hash=admin_data['password'],
                nombre=admin_data['nombre'].strip(),
                apellido=admin_data['apellido'].strip(),
                telefono=admin_data['telefono'].strip(),
                activo=True,
                email_verificado=False,
                creado_en=now,
                actualizado_en=now,
            )

            club_serializer = ClubSerializer(data={
                'nombre': club_data['nombre'],
                'ciudad': club_data['ciudad'].strip(),
                'telefono': club_data['telefono'].strip(),
                'email_contacto': club_data['correo'],
                'direccion': club_data['direccion'].strip(),
            })
            club_serializer.is_valid(raise_exception=True)
            club = club_serializer.save()

            usuario_club = UsuarioClub.objects.create(
                id=uuid.uuid4(),
                usuario=usuario,
                club=club,
                rol='COORDINADOR',
                estado='ACTIVO',
                creado_en=now,
            )

            plan_serializer = SeleccionarPlanSaaSSerializer(data={'plan_id': plan.pk})
            plan_serializer.is_valid(raise_exception=True)
            suscripcion = plan_serializer.save(club=club)

        return {
            'usuario': usuario,
            'usuario_club': usuario_club,
            'club': club,
            'plan': suscripcion.plan,
        }
