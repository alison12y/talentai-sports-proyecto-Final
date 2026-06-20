import uuid
from datetime import date

from django.db import DataError, IntegrityError, transaction
from django.utils import timezone
from rest_framework import serializers

from clubs.models import Club
from users.models import Usuario
from .models import CategoriaDeportiva, Equipo, Jugador, JugadorEquipo, TutorJugador


class CategoriaDeportivaSerializer(serializers.ModelSerializer):
    class Meta:
        model = CategoriaDeportiva
        fields = (
            'id', 'club', 'nombre', 'descripcion', 'edad_minima',
            'edad_maxima', 'activo', 'predefinida', 'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'club', 'predefinida', 'created_at', 'updated_at')

    def validate_nombre(self, value):
        nombre = value.strip()
        if not nombre:
            raise serializers.ValidationError('El nombre de la categoría es obligatorio.')

        club = self.context.get('club') or getattr(self.instance, 'club', None)
        if club:
            queryset = CategoriaDeportiva.objects.filter(
                club=club,
                nombre__iexact=nombre,
            )
            if self.instance:
                queryset = queryset.exclude(pk=self.instance.pk)
            if queryset.exists():
                raise serializers.ValidationError(
                    'Ya existe una categoría con ese nombre en el club.'
                )
        return nombre

    def validate(self, attrs):
        edad_minima = attrs.get(
            'edad_minima',
            getattr(self.instance, 'edad_minima', None),
        )
        edad_maxima = attrs.get(
            'edad_maxima',
            getattr(self.instance, 'edad_maxima', None),
        )
        if (
            edad_minima is not None
            and edad_maxima is not None
            and edad_minima > edad_maxima
        ):
            raise serializers.ValidationError({
                'edad_maxima': 'La edad máxima debe ser mayor o igual a la edad mínima.'
            })
        return attrs


class EquipoSerializer(serializers.ModelSerializer):
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
        extra_kwargs = {
            'activo': {'required': False, 'default': True},
        }

    def validate_nombre(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError('El nombre no puede estar vacio.')
        return value.strip()

    def validate_categoria(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError('La categoria es obligatoria.')
        return value.strip()

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

        if club and categoria:
            categoria_deportiva = CategoriaDeportiva.objects.filter(
                club=club,
                nombre__iexact=categoria,
            ).first()
            if not categoria_deportiva:
                raise serializers.ValidationError({
                    'categoria': (
                        'La categoria debe existir como CategoriaDeportiva '
                        'del mismo club.'
                    ),
                })
            attrs['categoria'] = categoria_deportiva.nombre

        if club and nombre and temporada:
            queryset = Equipo.objects.filter(
                club=club,
                nombre__iexact=nombre,
                temporada__iexact=temporada,
            )
            if self.instance:
                queryset = queryset.exclude(pk=self.instance.pk)

            if queryset.exists():
                raise serializers.ValidationError({
                    'non_field_errors': (
                        'Ya existe un equipo con el mismo nombre, club y temporada.'
                    ),
                })

        return attrs

    def create(self, validated_data):
        now = timezone.now()
        validated_data.setdefault('id', uuid.uuid4())
        validated_data.setdefault('activo', True)
        validated_data.setdefault('creado_en', now)
        validated_data.setdefault('actualizado_en', now)
        try:
            return super().create(validated_data)
        except DataError as exc:
            raise serializers.ValidationError({
                'categoria': (
                    'La categoria seleccionada no se puede almacenar. '
                    'Verifica que sea una categoria valida del club.'
                ),
            }) from exc
        except IntegrityError as exc:
            raise serializers.ValidationError({
                'non_field_errors': (
                    'No se pudo crear el equipo porque los datos entran '
                    'en conflicto con otro registro.'
                ),
            }) from exc

    def update(self, instance, validated_data):
        validated_data['actualizado_en'] = timezone.now()
        return super().update(instance, validated_data)


class JugadorSerializer(serializers.ModelSerializer):
    categoria = serializers.CharField(required=True, allow_blank=False)
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
    equipo_actual = serializers.SerializerMethodField()
    tutor_contacto = serializers.SerializerMethodField()

    class Meta:
        model = Jugador
        fields = (
            'id',
            'club',
            'club_id',
            'nombre',
            'apellido',
            'fecha_nacimiento',
            'categoria',
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
            'equipo_actual',
            'tutor_contacto',
        )
        read_only_fields = ('id', 'club', 'creado_en', 'actualizado_en')
        extra_kwargs = {
            'estado': {'required': False, 'default': 'ACTIVO'},
        }

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

    def validate_categoria(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError('La categoria es obligatoria.')
        return value.strip()

    def get_equipo_actual(self, jugador):
        relacion = JugadorEquipo.objects.filter(
            jugador=jugador,
            activo=True,
        ).select_related('equipo').first()
        if not relacion:
            return None
        return {
            'id': relacion.equipo_id,
            'nombre': relacion.equipo.nombre,
            'categoria': relacion.equipo.categoria,
        }

    def get_tutor_contacto(self, jugador):
        relacion = TutorJugador.objects.filter(
            jugador=jugador,
            es_contacto_principal=True,
        ).select_related('usuario').first()
        if not relacion:
            return None
        return {
            'id': relacion.id,
            'usuario_id': relacion.usuario_id,
            'nombre': relacion.usuario.nombre,
            'apellido': relacion.usuario.apellido,
            'telefono': relacion.usuario.telefono,
            'correo': relacion.usuario.email,
            'parentesco': relacion.parentesco,
        }

    def validate(self, attrs):
        club = attrs.get('club', getattr(self.instance, 'club', None))
        nombre = attrs.get('nombre', getattr(self.instance, 'nombre', None))
        apellido = attrs.get('apellido', getattr(self.instance, 'apellido', None))
        fecha_nacimiento = attrs.get(
            'fecha_nacimiento',
            getattr(self.instance, 'fecha_nacimiento', None),
        )
        categoria = attrs.get('categoria', getattr(self.instance, 'categoria', None))
        equipo = attrs.get('equipo_id')
        tutor_usuario = attrs.get('tutor_usuario_id')
        parentesco = attrs.get('parentesco')

        if not club:
            raise serializers.ValidationError({'club_id': 'El club_id es obligatorio.'})

        if not fecha_nacimiento:
            raise serializers.ValidationError({
                'fecha_nacimiento': 'La fecha_nacimiento es obligatoria.'
            })

        if fecha_nacimiento > timezone.localdate():
            raise serializers.ValidationError({
                'fecha_nacimiento': 'La fecha de nacimiento no puede ser futura.'
            })

        if not categoria:
            raise serializers.ValidationError({'categoria': 'La categoria es obligatoria.'})

        categoria_deportiva = CategoriaDeportiva.objects.filter(
            club=club,
            nombre__iexact=categoria,
        ).first()
        if not categoria_deportiva:
            raise serializers.ValidationError({
                'categoria': 'La categoria debe existir en el mismo club.'
            })
        attrs['categoria'] = categoria_deportiva.nombre

        edad = self.calcular_edad(fecha_nacimiento)
        if (
            categoria_deportiva.edad_minima is not None
            and edad < categoria_deportiva.edad_minima
        ):
            raise serializers.ValidationError({
                'categoria': 'El jugador no alcanza la edad minima de la categoria.'
            })
        if (
            categoria_deportiva.edad_maxima is not None
            and edad > categoria_deportiva.edad_maxima
        ):
            raise serializers.ValidationError({
                'categoria': 'El jugador supera la edad maxima de la categoria.'
            })

        if equipo and equipo.club_id != club.pk:
            raise serializers.ValidationError({
                'equipo_id': 'El equipo debe pertenecer al mismo club que el jugador.'
            })

        duplicados = Jugador.objects.filter(
            club=club,
            nombre__iexact=nombre,
            apellido__iexact=apellido,
            fecha_nacimiento=fecha_nacimiento,
        )
        if self.instance:
            duplicados = duplicados.exclude(pk=self.instance.pk)
        if duplicados.exists():
            raise serializers.ValidationError({
                'non_field_errors': (
                    'Ya existe un jugador con el mismo nombre, apellido y '
                    'fecha de nacimiento en el club.'
                ),
            })

        if (tutor_usuario and not parentesco) or (parentesco and not tutor_usuario):
            raise serializers.ValidationError({
                'tutor_usuario_id': 'Para crear tutor debes enviar tutor_usuario_id y parentesco.',
                'parentesco': 'Para crear tutor debes enviar tutor_usuario_id y parentesco.',
            })

        if tutor_usuario:
            if not tutor_usuario.nombre.strip():
                raise serializers.ValidationError({
                    'tutor_usuario_id': 'El tutor debe tener nombre.'
                })
            if not (tutor_usuario.telefono or '').strip() and not tutor_usuario.email:
                raise serializers.ValidationError({
                    'tutor_usuario_id': 'El tutor debe tener telefono o correo.'
                })
        elif not self.instance:
            raise serializers.ValidationError({
                'tutor_usuario_id': 'Debe indicar un tutor o contacto responsable.'
            })
        elif not TutorJugador.objects.filter(jugador=self.instance).exists():
            raise serializers.ValidationError({
                'tutor_usuario_id': 'El jugador debe conservar un tutor responsable.'
            })

        return attrs

    @staticmethod
    def calcular_edad(fecha_nacimiento):
        hoy = date.today()
        return hoy.year - fecha_nacimiento.year - (
            (hoy.month, hoy.day) < (fecha_nacimiento.month, fecha_nacimiento.day)
        )

    @transaction.atomic
    def create(self, validated_data):
        equipo = validated_data.pop('equipo_id', None)
        tutor_usuario = validated_data.pop('tutor_usuario_id', None)
        parentesco = validated_data.pop('parentesco', None)
        now = timezone.now()

        validated_data.setdefault('id', uuid.uuid4())
        validated_data.setdefault('estado', 'ACTIVO')
        validated_data.setdefault('creado_en', now)
        validated_data.setdefault('actualizado_en', now)

        try:
            jugador = super().create(validated_data)
            self.sync_relations(jugador, equipo, tutor_usuario, parentesco, now)
            return jugador
        except IntegrityError as exc:
            raise serializers.ValidationError({
                'non_field_errors': 'No se pudo crear el jugador por datos duplicados.'
            }) from exc

    @transaction.atomic
    def update(self, instance, validated_data):
        equipo = validated_data.pop('equipo_id', None)
        tutor_usuario = validated_data.pop('tutor_usuario_id', None)
        parentesco = validated_data.pop('parentesco', None)
        now = timezone.now()

        validated_data['actualizado_en'] = now
        try:
            jugador = super().update(instance, validated_data)
            self.sync_relations(jugador, equipo, tutor_usuario, parentesco, now)
            return jugador
        except IntegrityError as exc:
            raise serializers.ValidationError({
                'non_field_errors': 'No se pudo actualizar el jugador por datos duplicados.'
            }) from exc

    def sync_relations(self, jugador, equipo, tutor_usuario, parentesco, now):
        if equipo:
            JugadorEquipo.objects.filter(
                jugador=jugador,
                activo=True,
            ).exclude(equipo=equipo).update(
                activo=False,
                fecha_fin=timezone.localdate(),
            )
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
