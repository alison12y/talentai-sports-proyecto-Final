import uuid

from django.utils import timezone
from rest_framework import serializers

from clubs.models import Club
from users.models import Usuario
from .models import Equipo, Jugador, JugadorEquipo, TutorJugador


class EquipoSerializer(serializers.ModelSerializer):
    CATEGORIAS_VALIDAS = {
        'PREBENJAMIN',
        'BENJAMIN',
        'ALEVIN',
        'INFANTIL',
        'CADETE',
        'JUVENIL',
        'SENIOR',
    }

    club_id = serializers.PrimaryKeyRelatedField(
        source='club',
        queryset=Club.objects.all(),
        write_only=True,
        required=True,
    )

    class Meta:
        model = Equipo
        fields = (
            'id',
            'club',
            'club_id',
            'nombre',
            'categoria',
            'temporada',
            'descripcion',
            'activo',
            'creado_en',
            'actualizado_en',
        )
        read_only_fields = ('id', 'club', 'creado_en', 'actualizado_en')

    def validate_nombre(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError('El nombre no puede estar vacio.')
        return value.strip()

    def validate_categoria(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError('La categoria es obligatoria.')

        categoria = value.strip().upper()
        if categoria not in self.CATEGORIAS_VALIDAS:
            raise serializers.ValidationError('La categoria no es valida.')

        return categoria

    def validate_temporada(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError('La temporada es obligatoria.')
        return value.strip()

    def validate(self, attrs):
        club = attrs.get('club', getattr(self.instance, 'club', None))
        nombre = attrs.get('nombre', getattr(self.instance, 'nombre', None))
        categoria = attrs.get('categoria', getattr(self.instance, 'categoria', None))
        temporada = attrs.get('temporada', getattr(self.instance, 'temporada', None))

        if not club:
            raise serializers.ValidationError({'club_id': 'El club_id es obligatorio.'})

        if nombre and categoria and temporada:
            queryset = Equipo.objects.filter(
                club=club,
                nombre=nombre,
                categoria=categoria,
                temporada=temporada,
            )
            if self.instance:
                queryset = queryset.exclude(pk=self.instance.pk)

            if queryset.exists():
                raise serializers.ValidationError(
                    'Ya existe un equipo con el mismo nombre, club, categoria y temporada.'
                )

        return attrs

    def create(self, validated_data):
        now = timezone.now()
        validated_data.setdefault('id', uuid.uuid4())
        validated_data.setdefault('activo', True)
        validated_data.setdefault('creado_en', now)
        validated_data.setdefault('actualizado_en', now)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data['actualizado_en'] = timezone.now()
        return super().update(instance, validated_data)


class JugadorSerializer(serializers.ModelSerializer):
    club_id = serializers.PrimaryKeyRelatedField(
        source='club',
        queryset=Club.objects.all(),
        write_only=True,
        required=True,
    )
    equipo_id = serializers.PrimaryKeyRelatedField(
        queryset=Equipo.objects.all(),
        write_only=True,
        required=False,
    )
    tutor_usuario_id = serializers.PrimaryKeyRelatedField(
        queryset=Usuario.objects.all(),
        write_only=True,
        required=False,
    )
    parentesco = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = Jugador
        fields = (
            'id',
            'club',
            'club_id',
            'nombre',
            'apellido',
            'fecha_nacimiento',
            'dni',
            'foto_url',
            'posicion_principal',
            'posicion_secundaria',
            'pie_dominante',
            'numero_camiseta',
            'estado',
            'notas',
            'creado_en',
            'actualizado_en',
            'equipo_id',
            'tutor_usuario_id',
            'parentesco',
        )
        read_only_fields = ('id', 'club', 'creado_en', 'actualizado_en')

    def validate_nombre(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError('El nombre no puede estar vacio.')
        return value.strip()

    def validate_apellido(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError('El apellido no puede estar vacio.')
        return value.strip()

    def validate_dni(self, value):
        if value is None:
            return value

        dni = value.strip()
        if not dni:
            return None

        queryset = Jugador.objects.filter(dni=dni)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)

        if queryset.exists():
            raise serializers.ValidationError('Ya existe un jugador con este dni.')

        return dni

    def validate_parentesco(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError('El parentesco no puede estar vacio.')
        return value.strip()

    def validate(self, attrs):
        club = attrs.get('club', getattr(self.instance, 'club', None))
        tutor_usuario = attrs.get('tutor_usuario_id')
        parentesco = attrs.get('parentesco')

        if not club:
            raise serializers.ValidationError({'club_id': 'El club_id es obligatorio.'})

        if not self.instance and not attrs.get('fecha_nacimiento'):
            raise serializers.ValidationError({
                'fecha_nacimiento': 'La fecha_nacimiento es obligatoria.'
            })

        if (tutor_usuario and not parentesco) or (parentesco and not tutor_usuario):
            raise serializers.ValidationError({
                'tutor_usuario_id': 'Para crear tutor debes enviar tutor_usuario_id y parentesco.',
                'parentesco': 'Para crear tutor debes enviar tutor_usuario_id y parentesco.',
            })

        return attrs

    def create(self, validated_data):
        equipo = validated_data.pop('equipo_id', None)
        tutor_usuario = validated_data.pop('tutor_usuario_id', None)
        parentesco = validated_data.pop('parentesco', None)
        now = timezone.now()

        validated_data.setdefault('id', uuid.uuid4())
        validated_data.setdefault('estado', 'ACTIVO')
        validated_data.setdefault('creado_en', now)
        validated_data.setdefault('actualizado_en', now)

        jugador = super().create(validated_data)
        self.sync_relations(jugador, equipo, tutor_usuario, parentesco, now)
        return jugador

    def update(self, instance, validated_data):
        equipo = validated_data.pop('equipo_id', None)
        tutor_usuario = validated_data.pop('tutor_usuario_id', None)
        parentesco = validated_data.pop('parentesco', None)
        now = timezone.now()

        validated_data['actualizado_en'] = now
        jugador = super().update(instance, validated_data)
        self.sync_relations(jugador, equipo, tutor_usuario, parentesco, now)
        return jugador

    def sync_relations(self, jugador, equipo, tutor_usuario, parentesco, now):
        if equipo:
            jugador_equipo, created = JugadorEquipo.objects.get_or_create(
                jugador=jugador,
                equipo=equipo,
                defaults={
                    'id': uuid.uuid4(),
                    'fecha_inicio': timezone.localdate(),
                    'activo': True,
                    'creado_en': now,
                },
            )
            if not created:
                jugador_equipo.activo = True
                jugador_equipo.fecha_fin = None
                jugador_equipo.save(update_fields=['activo', 'fecha_fin'])

        if tutor_usuario and parentesco:
            tutor_jugador, created = TutorJugador.objects.get_or_create(
                jugador=jugador,
                usuario=tutor_usuario,
                defaults={
                    'id': uuid.uuid4(),
                    'parentesco': parentesco,
                    'es_contacto_principal': True,
                    'creado_en': now,
                },
            )
            if not created:
                tutor_jugador.parentesco = parentesco
                tutor_jugador.es_contacto_principal = True
                tutor_jugador.save(update_fields=['parentesco', 'es_contacto_principal'])
