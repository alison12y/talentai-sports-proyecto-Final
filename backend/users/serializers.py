import uuid

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import serializers

from clubs.models import Club
from clubs.serializers import ClubSerializer
from payments.models import PlanSaaS
from payments.serializers import SeleccionarPlanSaaSSerializer

from .models import EstadoUsuarioClub, RolUsuario, Usuario, UsuarioClub
from .passwords import make_usuario_password


USUARIO_PUBLIC_FIELDS = (
    'id',
    'email',
    'nombre',
    'apellido',
    'telefono',
    'avatar_url',
    'fecha_nacimiento',
    'activo',
    'email_verificado',
    'ultimo_acceso',
    'creado_en',
    'actualizado_en',
)


class UsuarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Usuario
        fields = USUARIO_PUBLIC_FIELDS
        read_only_fields = fields


class UsuarioCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        required=True,
        min_length=6,
        trim_whitespace=False,
    )

    class Meta:
        model = Usuario
        fields = USUARIO_PUBLIC_FIELDS + ('password',)
        read_only_fields = (
            'id', 'activo', 'email_verificado', 'ultimo_acceso',
            'creado_en', 'actualizado_en',
        )
        extra_kwargs = {
            'email': {'validators': []},
        }

    def validate_email(self, value):
        email = value.strip().lower()
        if Usuario.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError('Ya existe un usuario con ese email.')
        return email

    def validate_nombre(self, value):
        nombre = value.strip()
        if not nombre:
            raise serializers.ValidationError('El nombre es obligatorio.')
        return nombre

    def validate_apellido(self, value):
        apellido = value.strip()
        if not apellido:
            raise serializers.ValidationError('El apellido es obligatorio.')
        return apellido

    def create(self, validated_data):
        password = validated_data.pop('password')
        now = timezone.now()
        validated_data.update(
            id=uuid.uuid4(),
            password_hash=make_usuario_password(password),
            activo=True,
            email_verificado=False,
            creado_en=now,
            actualizado_en=now,
        )
        try:
            return Usuario.objects.create(**validated_data)
        except IntegrityError as exc:
            raise serializers.ValidationError({
                'email': 'Ya existe un usuario con ese email.',
            }) from exc


class UsuarioUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Usuario
        fields = (
            'email', 'nombre', 'apellido', 'telefono', 'avatar_url',
            'fecha_nacimiento',
        )
        extra_kwargs = {
            'email': {'validators': []},
        }

    def validate_email(self, value):
        email = value.strip().lower()
        queryset = Usuario.objects.filter(email__iexact=email)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError('Ya existe un usuario con ese email.')
        return email

    def validate_nombre(self, value):
        nombre = value.strip()
        if not nombre:
            raise serializers.ValidationError('El nombre es obligatorio.')
        return nombre

    def validate_apellido(self, value):
        apellido = value.strip()
        if not apellido:
            raise serializers.ValidationError('El apellido es obligatorio.')
        return apellido

    def validate(self, attrs):
        if 'password' in self.initial_data or 'password_hash' in self.initial_data:
            raise serializers.ValidationError({
                'password': 'Use el endpoint cambiar-password para modificar la contraseña.',
            })
        return attrs

    def update(self, instance, validated_data):
        validated_data['actualizado_en'] = timezone.now()
        return super().update(instance, validated_data)


class UsuarioPasswordSerializer(serializers.Serializer):
    password = serializers.CharField(
        write_only=True,
        required=True,
        min_length=6,
        trim_whitespace=False,
    )


class LoginClubSerializer(serializers.ModelSerializer):
    class Meta:
        model = Club
        fields = ('id', 'nombre')
        read_only_fields = fields


class LoginMembershipSerializer(serializers.ModelSerializer):
    club = LoginClubSerializer(read_only=True)
    rol = serializers.ChoiceField(choices=RolUsuario.choices, read_only=True)
    estado = serializers.ChoiceField(
        choices=EstadoUsuarioClub.choices,
        read_only=True,
    )

    class Meta:
        model = UsuarioClub
        fields = ('club', 'rol', 'estado')
        read_only_fields = fields


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
                password_hash=make_usuario_password(admin_data['password']),
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
                rol=RolUsuario.COORDINADOR,
                estado=EstadoUsuarioClub.ACTIVO,
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


class UsuarioClubSerializer(serializers.ModelSerializer):
    usuario = serializers.PrimaryKeyRelatedField(queryset=Usuario.objects.all())
    club = serializers.PrimaryKeyRelatedField(queryset=Club.objects.all())
    rol = serializers.ChoiceField(choices=RolUsuario.choices)
    estado = serializers.ChoiceField(
        choices=EstadoUsuarioClub.choices,
        default=EstadoUsuarioClub.ACTIVO,
        required=False,
    )

    class Meta:
        model = UsuarioClub
        fields = ('id', 'usuario', 'club', 'rol', 'estado', 'creado_en')
        read_only_fields = ('id', 'creado_en')

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        rep['usuario'] = {
            'id': instance.usuario.id,
            'email': instance.usuario.email,
            'nombre': instance.usuario.nombre,
            'apellido': instance.usuario.apellido,
        }
        rep['club'] = {
            'id': instance.club.id,
            'nombre': instance.club.nombre,
        }
        return rep

    def validate_rol(self, value):
        if value not in RolUsuario.values:
            raise serializers.ValidationError("Rol inválido.")
        if value in ('ADMINISTRADOR', 'TUTOR'):
            raise serializers.ValidationError("Rol no permitido.")
        return value

    def validate(self, attrs):
        usuario = attrs.get('usuario')
        club = attrs.get('club')
        rol = attrs.get('rol')
        estado = attrs.get('estado', EstadoUsuarioClub.ACTIVO)

        if not self.instance:
            if UsuarioClub.objects.filter(
                usuario=usuario,
                club=club,
                rol=rol,
                estado=EstadoUsuarioClub.ACTIVO
            ).exists() and estado == EstadoUsuarioClub.ACTIVO:
                raise serializers.ValidationError(
                    "Ya existe una membresía activa para este usuario, club y rol."
                )
        else:
            usuario = attrs.get('usuario', self.instance.usuario)
            club = attrs.get('club', self.instance.club)
            rol = attrs.get('rol', self.instance.rol)
            estado = attrs.get('estado', self.instance.estado)

            if UsuarioClub.objects.filter(
                usuario=usuario,
                club=club,
                rol=rol,
                estado=EstadoUsuarioClub.ACTIVO
            ).exclude(pk=self.instance.pk).exists() and estado == EstadoUsuarioClub.ACTIVO:
                raise serializers.ValidationError(
                    "Ya existe una membresía activa para este usuario, club y rol."
                )
        return attrs

    def create(self, validated_data):
        validated_data.update(
            id=uuid.uuid4(),
            creado_en=timezone.now(),
            estado=validated_data.get('estado', EstadoUsuarioClub.ACTIVO),
        )
        return super().create(validated_data)
