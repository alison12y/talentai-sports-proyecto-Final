import uuid
from datetime import date, timedelta
from decimal import Decimal

from django.db import DataError, IntegrityError, transaction
from django.utils import timezone
from rest_framework import serializers

from clubs.models import Club
from users.models import Usuario
from .models import (
    Asistencia,
    CategoriaDeportiva,
    Convocatoria,
    Equipo,
    EstadisticaPartido,
    Evento,
    EvolucionFisica,
    Jugador,
    JugadorEquipo,
    Partido,
    TutorJugador,
)


def generar_convocatorias_evento(evento, exigir_equipo=True):
    if evento.estado in (Evento.Estado.CANCELADO, Evento.Estado.FINALIZADO):
        raise serializers.ValidationError({
            'evento': 'No se pueden generar convocatorias para un evento cancelado o finalizado.',
        })

    if not evento.equipo_id:
        if exigir_equipo:
            raise serializers.ValidationError({
                'equipo': 'El evento debe tener un equipo para generar convocatorias automáticas.',
            })
        return 0

    jugador_ids = set(JugadorEquipo.objects.filter(
        equipo_id=evento.equipo_id,
        activo=True,
        jugador__estado='ACTIVO',
        jugador__club_id=evento.club_id,
    ).values_list('jugador_id', flat=True).distinct())
    existentes = set(Convocatoria.objects.filter(
        evento=evento,
        jugador_id__in=jugador_ids,
    ).values_list('jugador_id', flat=True))
    nuevos_ids = jugador_ids - existentes
    now = timezone.now()
    convocatorias = [
        Convocatoria(
            id=uuid.uuid4(),
            evento_id=evento.pk,
            jugador_id=jugador_id,
            estado=Convocatoria.Estado.PENDIENTE,
            confirmado=None,
            confirmado_en=None,
            fecha_notificacion=now,
            creado_en=now,
        )
        for jugador_id in nuevos_ids
    ]
    Convocatoria.objects.bulk_create(convocatorias, ignore_conflicts=True)
    return len(convocatorias)


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


class EventoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Evento
        fields = (
            'id', 'club', 'equipo', 'titulo', 'descripcion', 'tipo', 'rival',
            'fecha_inicio', 'fecha_fin', 'ubicacion', 'estado', 'activo',
            'creado_en', 'actualizado_en',
        )
        read_only_fields = (
            'id', 'estado', 'activo', 'creado_en', 'actualizado_en',
        )

    def validate_titulo(self, value):
        titulo = value.strip()
        if not titulo:
            raise serializers.ValidationError('El título es obligatorio.')
        return titulo

    def validate_rival(self, value):
        if value is None:
            return None
        return value.strip() or None

    def validate_ubicacion(self, value):
        if value is None:
            return None
        return value.strip() or None

    def validate(self, attrs):
        club = attrs.get('club', getattr(self.instance, 'club', None))
        equipo = attrs.get('equipo', getattr(self.instance, 'equipo', None))
        titulo = attrs.get('titulo', getattr(self.instance, 'titulo', None))
        tipo = attrs.get('tipo', getattr(self.instance, 'tipo', None))
        rival = attrs.get('rival', getattr(self.instance, 'rival', None))
        fecha_inicio = attrs.get(
            'fecha_inicio', getattr(self.instance, 'fecha_inicio', None),
        )
        fecha_fin = attrs.get(
            'fecha_fin', getattr(self.instance, 'fecha_fin', None),
        )

        if fecha_inicio and fecha_fin and fecha_fin <= fecha_inicio:
            raise serializers.ValidationError({
                'fecha_fin': 'La fecha_fin debe ser mayor que la fecha_inicio.',
            })

        if equipo and club and equipo.club_id != club.pk:
            raise serializers.ValidationError({
                'equipo': 'El equipo debe pertenecer al mismo club del evento.',
            })

        if tipo == Evento.Tipo.PARTIDO and not rival:
            raise serializers.ValidationError({
                'rival': 'El rival es obligatorio para eventos de tipo PARTIDO.',
            })

        if club and titulo and fecha_inicio:
            duplicados = Evento.objects.filter(
                club=club,
                titulo__iexact=titulo,
                fecha_inicio=fecha_inicio,
            )
            if equipo is None:
                duplicados = duplicados.filter(equipo__isnull=True)
            else:
                duplicados = duplicados.filter(equipo=equipo)
            if self.instance:
                duplicados = duplicados.exclude(pk=self.instance.pk)
            if duplicados.exists():
                raise serializers.ValidationError({
                    'non_field_errors': (
                        'Ya existe un evento con el mismo club, equipo, '
                        'título y fecha_inicio.'
                    ),
                })

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        now = timezone.now()
        validated_data.setdefault('id', uuid.uuid4())
        validated_data.setdefault('estado', Evento.Estado.PROGRAMADO)
        validated_data.setdefault('activo', True)
        validated_data.setdefault('creado_en', now)
        validated_data.setdefault('actualizado_en', now)
        try:
            evento = super().create(validated_data)
            generar_convocatorias_evento(evento, exigir_equipo=False)
            return evento
        except (DataError, IntegrityError) as exc:
            raise serializers.ValidationError({
                'non_field_errors': 'No se pudo crear el evento con los datos enviados.',
            }) from exc

    def update(self, instance, validated_data):
        validated_data['actualizado_en'] = timezone.now()
        try:
            return super().update(instance, validated_data)
        except (DataError, IntegrityError) as exc:
            raise serializers.ValidationError({
                'non_field_errors': 'No se pudo actualizar el evento con los datos enviados.',
            }) from exc


class PartidoSerializer(serializers.ModelSerializer):
    evento = serializers.PrimaryKeyRelatedField(queryset=Evento.objects.all())
    equipo = serializers.PrimaryKeyRelatedField(queryset=Equipo.objects.all())
    rival = serializers.CharField(source='nombre_rival', required=True, allow_blank=False)
    goles_equipo = serializers.IntegerField(source='goles_local', required=True, min_value=0)
    goles_rival = serializers.IntegerField(required=True, min_value=0)
    notas_tecnicas = serializers.CharField(
        source='notas_tacticas',
        required=False,
        allow_blank=True,
        allow_null=True,
    )

    class Meta:
        model = Partido
        fields = (
            'id', 'evento', 'equipo', 'rival', 'goles_equipo',
            'goles_rival', 'notas_tecnicas', 'resultado', 'activo',
            'creado_en', 'actualizado_en',
        )
        read_only_fields = (
            'id', 'resultado', 'activo', 'creado_en', 'actualizado_en',
        )
        validators = []

    def validate_rival(self, value):
        rival = value.strip()
        if not rival:
            raise serializers.ValidationError('El rival es obligatorio.')
        return rival

    def validate(self, attrs):
        evento = attrs.get('evento', getattr(self.instance, 'evento', None))
        equipo = attrs.get('equipo', getattr(self.instance, 'equipo', None))

        if not evento or not equipo:
            return attrs
        if evento.tipo != Evento.Tipo.PARTIDO:
            raise serializers.ValidationError({
                'evento': 'El evento debe ser de tipo PARTIDO.',
            })
        if evento.estado == Evento.Estado.CANCELADO:
            raise serializers.ValidationError({
                'evento': 'No se puede registrar un partido para un evento CANCELADO.',
            })
        if evento.club_id != equipo.club_id:
            raise serializers.ValidationError({
                'equipo': 'El equipo debe pertenecer al mismo club del evento.',
            })
        if evento.equipo_id and evento.equipo_id != equipo.pk:
            raise serializers.ValidationError({
                'equipo': 'El equipo debe coincidir con el equipo asignado al evento.',
            })

        duplicados = Partido.objects.filter(evento=evento)
        if self.instance:
            duplicados = duplicados.exclude(pk=self.instance.pk)
        if duplicados.exists():
            raise serializers.ValidationError({
                'evento': 'Ya existe un partido registrado para este evento.',
            })
        return attrs

    @staticmethod
    def _resultado(goles_equipo, goles_rival):
        if goles_equipo > goles_rival:
            return 'VICTORIA'
        if goles_equipo < goles_rival:
            return 'DERROTA'
        return 'EMPATE'

    def create(self, validated_data):
        now = timezone.now()
        evento = validated_data['evento']
        validated_data.update(
            id=uuid.uuid4(),
            fecha=evento.fecha_inicio,
            ubicacion=evento.ubicacion,
            resultado=self._resultado(
                validated_data['goles_local'],
                validated_data['goles_rival'],
            ),
            activo=True,
            creado_en=now,
            actualizado_en=now,
        )
        try:
            return super().create(validated_data)
        except (DataError, IntegrityError) as exc:
            raise serializers.ValidationError({
                'non_field_errors': 'No se pudo registrar el partido con los datos enviados.',
            }) from exc

    def update(self, instance, validated_data):
        evento = validated_data.get('evento', instance.evento)
        goles_equipo = validated_data.get('goles_local', instance.goles_local)
        goles_rival = validated_data.get('goles_rival', instance.goles_rival)
        validated_data.update(
            fecha=evento.fecha_inicio,
            ubicacion=evento.ubicacion,
            resultado=self._resultado(goles_equipo, goles_rival),
            actualizado_en=timezone.now(),
            activo=True,
        )
        try:
            return super().update(instance, validated_data)
        except (DataError, IntegrityError) as exc:
            raise serializers.ValidationError({
                'non_field_errors': 'No se pudo actualizar el partido con los datos enviados.',
            }) from exc


class EstadisticaPartidoSerializer(serializers.ModelSerializer):
    partido = serializers.PrimaryKeyRelatedField(queryset=Partido.objects.all())
    jugador = serializers.PrimaryKeyRelatedField(queryset=Jugador.objects.all())
    minutos_jugados = serializers.IntegerField(required=True, min_value=0)
    goles = serializers.IntegerField(required=True, min_value=0)
    asistencias = serializers.IntegerField(required=True, min_value=0)
    tarjetas_amarillas = serializers.IntegerField(required=True, min_value=0)
    tarjetas_rojas = serializers.IntegerField(required=True, min_value=0)
    valoracion = serializers.DecimalField(
        max_digits=4,
        decimal_places=2,
        min_value=0,
        max_value=10,
        required=False,
        allow_null=True,
    )
    observaciones = serializers.CharField(
        source='notas',
        required=False,
        allow_blank=True,
        allow_null=True,
    )

    class Meta:
        model = EstadisticaPartido
        fields = (
            'id', 'partido', 'jugador', 'minutos_jugados', 'goles',
            'asistencias', 'tarjetas_amarillas', 'tarjetas_rojas',
            'valoracion', 'observaciones', 'creado_en', 'actualizado_en',
        )
        read_only_fields = ('id', 'creado_en', 'actualizado_en')
        validators = []

    def validate(self, attrs):
        partido = attrs.get('partido', getattr(self.instance, 'partido', None))
        jugador = attrs.get('jugador', getattr(self.instance, 'jugador', None))

        if self.instance:
            if 'partido' in attrs and attrs['partido'].pk != self.instance.partido_id:
                raise serializers.ValidationError({
                    'partido': 'El partido de una estadística no puede modificarse.',
                })
            if 'jugador' in attrs and attrs['jugador'].pk != self.instance.jugador_id:
                raise serializers.ValidationError({
                    'jugador': 'El jugador de una estadística no puede modificarse.',
                })

        if partido and jugador and not JugadorEquipo.objects.filter(
            jugador=jugador,
            equipo_id=partido.equipo_id,
            activo=True,
        ).exists():
            raise serializers.ValidationError({
                'jugador': 'El jugador debe pertenecer al equipo del partido.',
            })
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        now = timezone.now()
        partido = validated_data.pop('partido')
        jugador = validated_data.pop('jugador')
        defaults = {
            **validated_data,
            'actualizado_en': now,
            'activo': True,
        }
        try:
            estadistica, created = EstadisticaPartido.objects.update_or_create(
                partido=partido,
                jugador=jugador,
                defaults=defaults,
                create_defaults={
                    **defaults,
                    'id': uuid.uuid4(),
                    'creado_en': now,
                },
            )
        except (DataError, IntegrityError) as exc:
            raise serializers.ValidationError({
                'non_field_errors': (
                    'No se pudieron guardar las estadísticas con los datos enviados.'
                ),
            }) from exc
        self.context['estadistica_creada'] = created
        return estadistica

    def update(self, instance, validated_data):
        validated_data.update(actualizado_en=timezone.now(), activo=True)
        try:
            return super().update(instance, validated_data)
        except (DataError, IntegrityError) as exc:
            raise serializers.ValidationError({
                'non_field_errors': (
                    'No se pudieron actualizar las estadísticas con los datos enviados.'
                ),
            }) from exc


class EvolucionFisicaSerializer(serializers.ModelSerializer):
    jugador = serializers.PrimaryKeyRelatedField(queryset=Jugador.objects.all())
    fecha_medicion = serializers.DateField(source='fecha', required=True)
    peso = serializers.DecimalField(
        source='peso_kg', max_digits=5, decimal_places=2, required=True,
    )
    altura = serializers.DecimalField(
        source='altura_cm', max_digits=5, decimal_places=2, required=True,
    )
    velocidad_40m = serializers.DecimalField(
        max_digits=4, decimal_places=2, required=True,
    )
    test_cooper = serializers.DecimalField(
        max_digits=8, decimal_places=2, required=True,
    )
    observaciones = serializers.CharField(
        source='notas', required=False, allow_blank=True, allow_null=True,
    )

    class Meta:
        model = EvolucionFisica
        fields = (
            'id', 'jugador', 'fecha_medicion', 'peso', 'altura',
            'velocidad_40m', 'test_cooper', 'observaciones',
            'creado_en', 'actualizado_en',
        )
        read_only_fields = ('id', 'creado_en', 'actualizado_en')
        validators = []

    def validate_fecha_medicion(self, value):
        if value > timezone.localdate():
            raise serializers.ValidationError(
                'La fecha de medición no puede ser futura.'
            )
        return value

    @staticmethod
    def _positivo(value, campo):
        if value <= Decimal('0'):
            raise serializers.ValidationError(f'{campo} debe ser mayor que 0.')
        return value

    def validate_peso(self, value):
        return self._positivo(value, 'El peso')

    def validate_altura(self, value):
        return self._positivo(value, 'La altura')

    def validate_velocidad_40m(self, value):
        return self._positivo(value, 'La velocidad 40m')

    def validate_test_cooper(self, value):
        return self._positivo(value, 'El test de Cooper')

    def validate(self, attrs):
        jugador = attrs.get('jugador', getattr(self.instance, 'jugador', None))
        fecha = attrs.get('fecha', getattr(self.instance, 'fecha', None))
        if not jugador or not fecha:
            return attrs

        inicio_semana = fecha - timedelta(days=fecha.weekday())
        fin_semana = inicio_semana + timedelta(days=6)
        duplicados = EvolucionFisica.objects.filter(
            jugador=jugador,
            fecha__range=(inicio_semana, fin_semana),
            activo=True,
        )
        if self.instance:
            duplicados = duplicados.exclude(pk=self.instance.pk)
        if duplicados.exists():
            raise serializers.ValidationError({
                'fecha_medicion': (
                    'Ya existe una medición para este jugador en la misma semana.'
                ),
            })
        return attrs

    def create(self, validated_data):
        now = timezone.now()
        validated_data.update(
            id=uuid.uuid4(),
            creado_en=now,
            actualizado_en=now,
            activo=True,
        )
        try:
            return super().create(validated_data)
        except (DataError, IntegrityError) as exc:
            raise serializers.ValidationError({
                'non_field_errors': (
                    'No se pudo registrar la evolución física con los datos enviados.'
                ),
            }) from exc

    def update(self, instance, validated_data):
        validated_data.update(actualizado_en=timezone.now(), activo=True)
        try:
            return super().update(instance, validated_data)
        except (DataError, IntegrityError) as exc:
            raise serializers.ValidationError({
                'non_field_errors': (
                    'No se pudo actualizar la evolución física con los datos enviados.'
                ),
            }) from exc


class AsistenciaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Asistencia
        fields = (
            'id', 'evento', 'jugador', 'estado', 'motivo',
            'registrado_en', 'actualizado_en',
        )
        read_only_fields = ('id', 'registrado_en', 'actualizado_en')
        validators = []

    def validate_motivo(self, value):
        if value is None:
            return ''
        return value.strip()

    def validate(self, attrs):
        evento = attrs.get('evento', getattr(self.instance, 'evento', None))
        jugador = attrs.get('jugador', getattr(self.instance, 'jugador', None))
        estado = attrs.get('estado', getattr(self.instance, 'estado', None))
        motivo = attrs.get('motivo', getattr(self.instance, 'motivo', '') or '')

        if self.instance:
            if 'evento' in attrs and attrs['evento'].pk != self.instance.evento_id:
                raise serializers.ValidationError({
                    'evento': 'El evento de una asistencia no puede modificarse.',
                })
            if 'jugador' in attrs and attrs['jugador'].pk != self.instance.jugador_id:
                raise serializers.ValidationError({
                    'jugador': 'El jugador de una asistencia no puede modificarse.',
                })

        if not evento or not jugador or not estado:
            return attrs

        if evento.tipo != Evento.Tipo.ENTRENAMIENTO:
            raise serializers.ValidationError({
                'evento': 'Solo se registra asistencia en eventos de tipo ENTRENAMIENTO.',
            })
        if evento.estado == Evento.Estado.CANCELADO:
            raise serializers.ValidationError({
                'evento': 'No se registra asistencia en eventos CANCELADOS.',
            })

        fecha_evento = timezone.localdate(evento.fecha_inicio)
        hoy = timezone.localdate()
        if hoy not in (fecha_evento, fecha_evento + timedelta(days=1)):
            raise serializers.ValidationError({
                'evento': (
                    'La asistencia solo puede registrarse el día del evento '
                    'o el día siguiente.'
                ),
            })

        if estado == Asistencia.Estado.JUSTIFICADO and not motivo:
            raise serializers.ValidationError({
                'motivo': 'El motivo es obligatorio para una asistencia JUSTIFICADA.',
            })

        pertenece = bool(evento.equipo_id) and JugadorEquipo.objects.filter(
            jugador=jugador,
            equipo_id=evento.equipo_id,
            activo=True,
        ).exists()
        convocado = Convocatoria.objects.filter(
            evento=evento,
            jugador=jugador,
        ).exists()
        if not pertenece and not convocado:
            raise serializers.ValidationError({
                'jugador': (
                    'El jugador debe pertenecer al equipo del evento '
                    'o estar convocado al evento.'
                ),
            })
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        now = timezone.now()
        estado = validated_data['estado']
        motivo = validated_data.get('motivo', '')
        defaults = {
            'estado': estado,
            'motivo': motivo,
            'presente': estado == Asistencia.Estado.PRESENTE,
            'justificado': estado == Asistencia.Estado.JUSTIFICADO,
            'motivo_ausencia': motivo or None,
            'actualizado_en': now,
            'activo': True,
        }
        asistencia, created = Asistencia.objects.update_or_create(
            evento=validated_data['evento'],
            jugador=validated_data['jugador'],
            defaults=defaults,
            create_defaults={
                **defaults,
                'id': uuid.uuid4(),
                'registrado_en': now,
                'creado_en': now,
            },
        )
        self.context['asistencia_creada'] = created
        return asistencia

    def update(self, instance, validated_data):
        estado = validated_data.get('estado', instance.estado)
        motivo = validated_data.get('motivo', instance.motivo or '')
        validated_data.update(
            presente=estado == Asistencia.Estado.PRESENTE,
            justificado=estado == Asistencia.Estado.JUSTIFICADO,
            motivo_ausencia=motivo or None,
            actualizado_en=timezone.now(),
            activo=True,
        )
        return super().update(instance, validated_data)


class ConvocatoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Convocatoria
        fields = (
            'id', 'evento', 'jugador', 'estado', 'confirmado',
            'confirmado_en', 'respuesta', 'motivo_rechazo', 'respondido_en',
            'notas', 'fecha_notificacion', 'creado_en', 'actualizado_en',
        )
        read_only_fields = (
            'id', 'confirmado', 'confirmado_en', 'fecha_notificacion',
            'respuesta', 'motivo_rechazo', 'respondido_en', 'creado_en',
            'actualizado_en',
        )
        extra_kwargs = {
            'estado': {'required': False},
        }

    def validate(self, attrs):
        evento = attrs.get('evento', getattr(self.instance, 'evento', None))
        jugador = attrs.get('jugador', getattr(self.instance, 'jugador', None))

        if self.instance:
            if 'evento' in attrs and attrs['evento'].pk != self.instance.evento_id:
                raise serializers.ValidationError({
                    'evento': 'El evento de una convocatoria no puede modificarse.',
                })
            if 'jugador' in attrs and attrs['jugador'].pk != self.instance.jugador_id:
                raise serializers.ValidationError({
                    'jugador': 'El jugador de una convocatoria no puede modificarse.',
                })

        if not evento or not jugador:
            return attrs

        if self.instance is None:
            if evento.estado in (Evento.Estado.CANCELADO, Evento.Estado.FINALIZADO):
                raise serializers.ValidationError({
                    'evento': 'No se pueden agregar convocatorias a un evento cancelado o finalizado.',
                })
            if jugador.estado != 'ACTIVO':
                raise serializers.ValidationError({
                    'jugador': 'Solo se pueden convocar jugadores activos.',
                })
            if jugador.club_id != evento.club_id:
                raise serializers.ValidationError({
                    'jugador': 'El jugador debe pertenecer al mismo club del evento.',
                })
            if evento.equipo_id and not JugadorEquipo.objects.filter(
                jugador=jugador,
                equipo_id=evento.equipo_id,
                activo=True,
            ).exists():
                raise serializers.ValidationError({
                    'jugador': 'El jugador debe pertenecer activamente al equipo del evento.',
                })
            if Convocatoria.objects.filter(evento=evento, jugador=jugador).exists():
                raise serializers.ValidationError({
                    'non_field_errors': 'El jugador ya tiene una convocatoria para este evento.',
                })

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        now = timezone.now()
        estado = validated_data.setdefault('estado', Convocatoria.Estado.PENDIENTE)
        validated_data.setdefault('id', uuid.uuid4())
        validated_data.setdefault('fecha_notificacion', now)
        validated_data.setdefault('creado_en', now)
        self._sincronizar_confirmacion(validated_data, estado, now)
        try:
            return super().create(validated_data)
        except IntegrityError as exc:
            raise serializers.ValidationError({
                'non_field_errors': 'El jugador ya tiene una convocatoria para este evento.',
            }) from exc

    def update(self, instance, validated_data):
        estado = validated_data.get('estado', instance.estado)
        self._sincronizar_confirmacion(validated_data, estado, timezone.now())
        return super().update(instance, validated_data)

    @staticmethod
    def _sincronizar_confirmacion(validated_data, estado, now):
        if estado == Convocatoria.Estado.PENDIENTE:
            validated_data.update(
                confirmado=None,
                confirmado_en=None,
                respuesta=None,
                motivo_rechazo=None,
                respondido_en=None,
                actualizado_en=now,
            )
        elif estado == Convocatoria.Estado.CONFIRMADO:
            validated_data.update(
                confirmado=True,
                confirmado_en=now,
                respuesta=Convocatoria.Estado.CONFIRMADO,
                motivo_rechazo=None,
                respondido_en=now,
                actualizado_en=now,
            )
        elif estado == Convocatoria.Estado.RECHAZADO:
            validated_data.update(
                confirmado=False,
                confirmado_en=now,
                respuesta=Convocatoria.Estado.RECHAZADO,
                respondido_en=now,
                actualizado_en=now,
            )
        else:
            validated_data.update(
                confirmado=False,
                confirmado_en=None,
                respuesta=None,
                motivo_rechazo=None,
                respondido_en=None,
                actualizado_en=now,
            )


class ConvocatoriaRespuestaSerializer(serializers.Serializer):
    respuesta = serializers.ChoiceField(choices=(
        Convocatoria.Estado.CONFIRMADO,
        Convocatoria.Estado.RECHAZADO,
    ))
    motivo_rechazo = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
    )

    def validate_motivo_rechazo(self, value):
        return value.strip() if value else None

    def validate(self, attrs):
        convocatoria = self.instance
        respuesta_esperada = self.context.get('respuesta_esperada')
        respuesta = attrs.get('respuesta')

        if respuesta_esperada and respuesta != respuesta_esperada:
            raise serializers.ValidationError({
                'respuesta': f'La respuesta debe ser {respuesta_esperada}.',
            })
        if convocatoria.estado == Convocatoria.Estado.NO_CONVOCADO:
            raise serializers.ValidationError({
                'estado': 'No se puede responder una convocatoria NO_CONVOCADO.',
            })
        if convocatoria.evento.estado == Evento.Estado.CANCELADO:
            raise serializers.ValidationError({
                'evento': 'No se puede responder una convocatoria de un evento CANCELADO.',
            })
        if convocatoria.estado == respuesta:
            raise serializers.ValidationError({
                'respuesta': f'La convocatoria ya fue respondida como {respuesta}.',
            })
        return attrs

    def update(self, instance, validated_data):
        now = timezone.now()
        respuesta = validated_data['respuesta']
        instance.estado = respuesta
        instance.respuesta = respuesta
        instance.motivo_rechazo = (
            validated_data.get('motivo_rechazo')
            if respuesta == Convocatoria.Estado.RECHAZADO
            else None
        )
        instance.respondido_en = now
        instance.actualizado_en = now
        instance.confirmado = respuesta == Convocatoria.Estado.CONFIRMADO
        instance.confirmado_en = now
        instance.save(update_fields=[
            'estado', 'respuesta', 'motivo_rechazo', 'respondido_en',
            'actualizado_en', 'confirmado', 'confirmado_en',
        ])
        return instance

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
