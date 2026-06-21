import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.db import DataError, IntegrityError
from django.test import SimpleTestCase
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.test import APIRequestFactory

from users.models import EstadoUsuarioClub, RolUsuario
from payments.models import Cuota, Pago

from .models import (
    Asistencia,
    Convocatoria,
    EstadisticaPartido,
    Evento,
    EvolucionFisica,
    Jugador,
    JugadorEquipo,
    Partido,
)
from .serializers import (
    AsistenciaSerializer,
    CategoriaDeportivaSerializer,
    ConvocatoriaSerializer,
    CuotaSerializer,
    EquipoSerializer,
    EstadisticaPartidoSerializer,
    EventoSerializer,
    EvolucionFisicaSerializer,
    JugadorSerializer,
    PartidoSerializer,
    PAGO_PENDIENTE_INSERT_SQL,
    generar_convocatorias_evento,
    generar_pagos_cuota,
)
from .views import (
    AsistenciaViewSet,
    CATEGORIAS_PREDEFINIDAS,
    CategoriaClubListCreateView,
    CategoriaDeportivaViewSet,
    CategoriaPredefinidasView,
    ConvocatoriaViewSet,
    CuotaViewSet,
    EquipoViewSet,
    EstadisticaPartidoViewSet,
    EventoViewSet,
    EvolucionFisicaViewSet,
    JugadorViewSet,
    PartidoViewSet,
)


class AsistenciaSerializerTests(SimpleTestCase):
    def setUp(self):
        self.evento = SimpleNamespace(
            pk=uuid.uuid4(),
            tipo=Evento.Tipo.ENTRENAMIENTO,
            estado=Evento.Estado.PROGRAMADO,
            equipo_id=uuid.uuid4(),
            fecha_inicio=datetime.now(timezone.utc),
        )
        self.jugador = SimpleNamespace(pk=uuid.uuid4())

    def validate(self, estado, motivo=''):
        with (
            patch('sports.serializers.JugadorEquipo.objects.filter') as equipo_filter,
            patch('sports.serializers.Convocatoria.objects.filter') as convocatoria_filter,
        ):
            equipo_filter.return_value.exists.return_value = True
            convocatoria_filter.return_value.exists.return_value = False
            return AsistenciaSerializer().validate({
                'evento': self.evento,
                'jugador': self.jugador,
                'estado': estado,
                'motivo': motivo,
            })

    def test_registrar_presente(self):
        attrs = self.validate(Asistencia.Estado.PRESENTE)
        self.assertEqual(attrs['estado'], Asistencia.Estado.PRESENTE)

    def test_registrar_ausente(self):
        attrs = self.validate(Asistencia.Estado.AUSENTE)
        self.assertEqual(attrs['estado'], Asistencia.Estado.AUSENTE)

    def test_registrar_justificado_con_motivo(self):
        attrs = self.validate(Asistencia.Estado.JUSTIFICADO, 'Enfermedad')
        self.assertEqual(attrs['motivo'], 'Enfermedad')

    def test_justificado_sin_motivo_devuelve_error(self):
        with self.assertRaises(serializers.ValidationError) as context:
            self.validate(Asistencia.Estado.JUSTIFICADO)
        self.assertIn('motivo', context.exception.detail)

    def test_evento_no_entrenamiento_devuelve_error(self):
        self.evento.tipo = Evento.Tipo.REUNION
        with self.assertRaises(serializers.ValidationError) as context:
            self.validate(Asistencia.Estado.PRESENTE)
        self.assertIn('evento', context.exception.detail)

    def test_evento_cancelado_devuelve_error(self):
        self.evento.estado = Evento.Estado.CANCELADO
        with self.assertRaises(serializers.ValidationError) as context:
            self.validate(Asistencia.Estado.PRESENTE)
        self.assertIn('evento', context.exception.detail)

    @patch('sports.serializers.Convocatoria.objects.filter')
    @patch('sports.serializers.JugadorEquipo.objects.filter')
    def test_jugador_fuera_del_equipo_y_no_convocado_devuelve_error(
        self, equipo_filter, convocatoria_filter,
    ):
        equipo_filter.return_value.exists.return_value = False
        convocatoria_filter.return_value.exists.return_value = False
        with self.assertRaises(serializers.ValidationError) as context:
            AsistenciaSerializer().validate({
                'evento': self.evento,
                'jugador': self.jugador,
                'estado': Asistencia.Estado.AUSENTE,
                'motivo': '',
            })
        self.assertIn('jugador', context.exception.detail)

    def test_bloquea_registro_fuera_del_plazo(self):
        self.evento.fecha_inicio = datetime.now(timezone.utc) - timedelta(days=2)
        with self.assertRaises(serializers.ValidationError) as context:
            self.validate(Asistencia.Estado.PRESENTE)
        self.assertIn('d\u00eda siguiente', str(context.exception.detail))

    @patch('sports.serializers.Asistencia.objects.update_or_create')
    def test_duplicado_actualiza_registro_existente(self, update_or_create):
        existente = SimpleNamespace(estado=Asistencia.Estado.AUSENTE)
        update_or_create.return_value = (existente, False)
        serializer = AsistenciaSerializer(context={})

        resultado = AsistenciaSerializer.create.__wrapped__(serializer, {
            'evento': self.evento,
            'jugador': self.jugador,
            'estado': Asistencia.Estado.PRESENTE,
            'motivo': '',
        })

        self.assertIs(resultado, existente)
        self.assertFalse(serializer.context['asistencia_creada'])
        update_or_create.assert_called_once()


class AsistenciaViewSetTests(SimpleTestCase):
    @patch('sports.views.AsistenciaSerializer')
    @patch('sports.views.Asistencia.objects.select_related')
    def test_consultar_asistencias_por_evento(self, select_related, serializer_class):
        evento = SimpleNamespace(pk=uuid.uuid4())
        queryset = MagicMock()
        select_related.return_value.filter.return_value = queryset
        serializer_class.return_value.data = [{'estado': Asistencia.Estado.PRESENTE}]
        view = EventoViewSet()
        view.get_object = MagicMock(return_value=evento)

        response = view.asistencias(MagicMock(), pk=str(evento.pk))

        select_related.return_value.filter.assert_called_once_with(
            evento=evento,
            activo=True,
        )
        serializer_class.assert_called_once_with(queryset, many=True)
        self.assertEqual(response.status_code, 200)

    @patch('sports.views.AsistenciaSerializer')
    def test_registrar_asistencia_masiva(self, serializer_class):
        evento = SimpleNamespace(pk=uuid.uuid4())
        primera = MagicMock()
        segunda = MagicMock()
        salida = MagicMock(data=[{'estado': 'PRESENTE'}, {'estado': 'AUSENTE'}])
        primera.is_valid.return_value = True
        segunda.is_valid.return_value = True
        primera.save.return_value = MagicMock()
        segunda.save.return_value = MagicMock()
        serializer_class.side_effect = [primera, segunda, salida]
        view = EventoViewSet()
        view.get_object = MagicMock(return_value=evento)
        request = SimpleNamespace(data={'asistencias': [
            {'jugador': str(uuid.uuid4()), 'estado': 'PRESENTE', 'motivo': ''},
            {'jugador': str(uuid.uuid4()), 'estado': 'AUSENTE', 'motivo': ''},
        ]})

        response = EventoViewSet.registrar_asistencias.__wrapped__(
            view, request, pk=str(evento.pk),
        )

        self.assertEqual(response.status_code, 200)
        primera.save.assert_called_once_with()
        segunda.save.assert_called_once_with()

    @patch('sports.views.Asistencia.objects.filter')
    def test_resumen_asistencia_por_jugador(self, filter_mock):
        jugador = SimpleNamespace(pk=uuid.uuid4())
        filter_mock.return_value.values.return_value.annotate.return_value = [
            {'estado': Asistencia.Estado.PRESENTE, 'total': 3},
            {'estado': Asistencia.Estado.AUSENTE, 'total': 1},
            {'estado': Asistencia.Estado.JUSTIFICADO, 'total': 1},
        ]
        view = JugadorViewSet()
        view.get_object = MagicMock(return_value=jugador)

        response = view.resumen_asistencia(MagicMock(), pk=str(jugador.pk))

        self.assertEqual(response.data['total'], 5)
        self.assertEqual(response.data['presentes'], 3)
        self.assertEqual(response.data['porcentaje_asistencia'], 60.0)

    def test_delete_realiza_baja_logica(self):
        asistencia = SimpleNamespace(
            activo=True,
            actualizado_en=None,
            save=MagicMock(),
            delete=MagicMock(),
        )
        view = AsistenciaViewSet()
        view.get_object = MagicMock(return_value=asistencia)

        response = view.destroy(MagicMock(), pk='asistencia-1')

        self.assertFalse(asistencia.activo)
        asistencia.save.assert_called_once_with(update_fields=['activo', 'actualizado_en'])
        asistencia.delete.assert_not_called()
        self.assertEqual(response.status_code, 204)


class PartidoSerializerTests(SimpleTestCase):
    def setUp(self):
        self.club_id = uuid.uuid4()
        self.equipo = SimpleNamespace(pk=uuid.uuid4(), club_id=self.club_id)
        self.evento = SimpleNamespace(
            pk=uuid.uuid4(),
            tipo=Evento.Tipo.PARTIDO,
            estado=Evento.Estado.PROGRAMADO,
            club_id=self.club_id,
            equipo_id=self.equipo.pk,
            fecha_inicio=datetime.now(timezone.utc),
            ubicacion='Cancha principal',
        )

    @patch('sports.serializers.Partido.objects.filter')
    def test_crear_partido_valido(self, filter_mock):
        filter_mock.return_value.exists.return_value = False

        attrs = PartidoSerializer().validate({
            'evento': self.evento,
            'equipo': self.equipo,
            'nombre_rival': 'Tigres FC',
            'goles_local': 3,
            'goles_rival': 1,
        })

        self.assertEqual(attrs['goles_local'], 3)
        self.assertEqual(attrs['goles_rival'], 1)

    def test_evento_no_partido_devuelve_400(self):
        self.evento.tipo = Evento.Tipo.ENTRENAMIENTO
        with self.assertRaises(serializers.ValidationError) as context:
            PartidoSerializer().validate({
                'evento': self.evento,
                'equipo': self.equipo,
            })
        self.assertIn('evento', context.exception.detail)

    def test_evento_cancelado_devuelve_400(self):
        self.evento.estado = Evento.Estado.CANCELADO
        with self.assertRaises(serializers.ValidationError) as context:
            PartidoSerializer().validate({
                'evento': self.evento,
                'equipo': self.equipo,
            })
        self.assertIn('evento', context.exception.detail)

    def test_rival_obligatorio(self):
        with self.assertRaises(serializers.ValidationError):
            PartidoSerializer().validate_rival('   ')

    def test_goles_negativos_devuelven_400(self):
        field = PartidoSerializer().fields['goles_equipo']
        with self.assertRaises(serializers.ValidationError):
            field.run_validation(-1)

    def test_goles_no_enteros_devuelven_400(self):
        field = PartidoSerializer().fields['goles_rival']
        with self.assertRaises(serializers.ValidationError):
            field.run_validation('1.5')

    @patch('rest_framework.serializers.ModelSerializer.update')
    def test_editar_resultado_recalcula_resultado(self, model_update):
        instance = SimpleNamespace(
            evento=self.evento,
            evento_id=self.evento.pk,
            equipo=self.equipo,
            equipo_id=self.equipo.pk,
            goles_local=0,
            goles_rival=0,
            activo=True,
            save=MagicMock(),
        )

        def apply_update(obj, values):
            for field, value in values.items():
                setattr(obj, field, value)
            return obj

        model_update.side_effect = apply_update
        resultado = PartidoSerializer().update(instance, {
            'goles_local': 1,
            'goles_rival': 2,
        })

        self.assertIs(resultado, instance)
        self.assertEqual(instance.goles_local, 1)
        self.assertEqual(instance.goles_rival, 2)
        self.assertEqual(instance.resultado, 'DERROTA')

    @patch('rest_framework.serializers.ModelSerializer.create')
    def test_error_esperado_de_base_de_datos_no_devuelve_500(self, create_mock):
        create_mock.side_effect = IntegrityError('duplicado')
        serializer = PartidoSerializer()
        with self.assertRaises(serializers.ValidationError) as context:
            serializer.create({
                'evento': self.evento,
                'equipo': self.equipo,
                'nombre_rival': 'Tigres FC',
                'goles_local': 2,
                'goles_rival': 2,
            })
        self.assertIn('non_field_errors', context.exception.detail)


class PartidoViewSetTests(SimpleTestCase):
    @patch('sports.views.PartidoSerializer')
    @patch('sports.views.Partido.objects.select_related')
    def test_consultar_partidos_por_equipo(self, select_related, serializer_class):
        equipo = SimpleNamespace(pk=uuid.uuid4())
        queryset = MagicMock()
        select_related.return_value.filter.return_value.order_by.return_value = queryset
        serializer_class.return_value.data = [{'rival': 'Tigres FC'}]
        view = EquipoViewSet()
        view.get_object = MagicMock(return_value=equipo)

        response = view.partidos(MagicMock(), pk=str(equipo.pk))

        select_related.return_value.filter.assert_called_once_with(
            equipo=equipo,
            activo=True,
        )
        serializer_class.assert_called_once_with(queryset, many=True)
        self.assertEqual(response.status_code, 200)

    def test_delete_no_elimina_fisicamente(self):
        partido = SimpleNamespace(
            activo=True,
            actualizado_en=None,
            save=MagicMock(),
            delete=MagicMock(),
        )
        view = PartidoViewSet()
        view.get_object = MagicMock(return_value=partido)

        response = view.destroy(MagicMock(), pk='partido-1')

        self.assertFalse(partido.activo)
        partido.save.assert_called_once_with(update_fields=['activo', 'actualizado_en'])
        partido.delete.assert_not_called()
        self.assertEqual(response.status_code, 204)


class EstadisticaPartidoSerializerTests(SimpleTestCase):
    def setUp(self):
        self.equipo_id = uuid.uuid4()
        self.partido = SimpleNamespace(pk=uuid.uuid4(), equipo_id=self.equipo_id)
        self.jugador = SimpleNamespace(pk=uuid.uuid4())

    @patch('sports.serializers.JugadorEquipo.objects.filter')
    def test_crear_estadisticas_validas(self, filter_mock):
        filter_mock.return_value.exists.return_value = True
        attrs = EstadisticaPartidoSerializer().validate({
            'partido': self.partido,
            'jugador': self.jugador,
            'minutos_jugados': 60,
            'goles': 1,
            'asistencias': 0,
            'tarjetas_amarillas': 1,
            'tarjetas_rojas': 0,
            'valoracion': 8,
        })
        self.assertEqual(attrs['minutos_jugados'], 60)

    @patch('sports.serializers.JugadorEquipo.objects.filter')
    def test_jugador_fuera_del_equipo_devuelve_400(self, filter_mock):
        filter_mock.return_value.exists.return_value = False
        with self.assertRaises(serializers.ValidationError) as context:
            EstadisticaPartidoSerializer().validate({
                'partido': self.partido,
                'jugador': self.jugador,
            })
        self.assertIn('jugador', context.exception.detail)

    def test_valores_negativos_devuelven_400(self):
        serializer = EstadisticaPartidoSerializer()
        for field_name in (
            'minutos_jugados', 'goles', 'asistencias',
            'tarjetas_amarillas', 'tarjetas_rojas',
        ):
            with self.subTest(field=field_name):
                with self.assertRaises(serializers.ValidationError):
                    serializer.fields[field_name].run_validation(-1)

    def test_valoracion_menor_a_cero_devuelve_400(self):
        with self.assertRaises(serializers.ValidationError):
            EstadisticaPartidoSerializer().fields['valoracion'].run_validation(-0.1)

    def test_valoracion_mayor_a_diez_devuelve_400(self):
        with self.assertRaises(serializers.ValidationError):
            EstadisticaPartidoSerializer().fields['valoracion'].run_validation(10.1)

    @patch('sports.serializers.EstadisticaPartido.objects.update_or_create')
    def test_duplicado_actualiza_registro_existente(self, update_or_create):
        existente = SimpleNamespace(pk=uuid.uuid4())
        update_or_create.return_value = (existente, False)
        serializer = EstadisticaPartidoSerializer(context={})

        resultado = EstadisticaPartidoSerializer.create.__wrapped__(serializer, {
            'partido': self.partido,
            'jugador': self.jugador,
            'minutos_jugados': 60,
            'goles': 1,
            'asistencias': 0,
            'tarjetas_amarillas': 0,
            'tarjetas_rojas': 0,
            'valoracion': 8,
            'notas': 'Buen desempeño',
        })

        self.assertIs(resultado, existente)
        self.assertFalse(serializer.context['estadistica_creada'])
        update_or_create.assert_called_once()

    @patch('sports.serializers.EstadisticaPartido.objects.update_or_create')
    def test_error_esperado_no_devuelve_500(self, update_or_create):
        update_or_create.side_effect = IntegrityError('datos inválidos')
        serializer = EstadisticaPartidoSerializer(context={})
        with self.assertRaises(serializers.ValidationError) as context:
            EstadisticaPartidoSerializer.create.__wrapped__(serializer, {
                'partido': self.partido,
                'jugador': self.jugador,
                'minutos_jugados': 60,
                'goles': 0,
                'asistencias': 0,
                'tarjetas_amarillas': 0,
                'tarjetas_rojas': 0,
            })
        self.assertIn('non_field_errors', context.exception.detail)


class EstadisticaPartidoViewSetTests(SimpleTestCase):
    @patch('sports.views.EstadisticaPartidoSerializer')
    @patch('sports.views.EstadisticaPartido.objects.select_related')
    def test_consultar_estadisticas_por_partido(self, select_related, serializer_class):
        partido = SimpleNamespace(pk=uuid.uuid4())
        queryset = MagicMock()
        select_related.return_value.filter.return_value = queryset
        serializer_class.return_value.data = [{'goles': 1}]
        view = PartidoViewSet()
        view.get_object = MagicMock(return_value=partido)

        response = view.estadisticas(MagicMock(), pk=str(partido.pk))

        select_related.return_value.filter.assert_called_once_with(
            partido=partido,
            activo=True,
        )
        serializer_class.assert_called_once_with(queryset, many=True)
        self.assertEqual(response.status_code, 200)

    @patch('sports.views.EstadisticaPartidoSerializer')
    def test_registrar_estadisticas_masivas(self, serializer_class):
        partido = SimpleNamespace(pk=uuid.uuid4())
        entrada = MagicMock()
        salida = MagicMock(data=[{'goles': 1}])
        entrada.is_valid.return_value = True
        entrada.save.return_value = MagicMock()
        serializer_class.side_effect = [entrada, salida]
        view = PartidoViewSet()
        view.get_object = MagicMock(return_value=partido)
        request = SimpleNamespace(data={'estadisticas': [{
            'jugador': str(uuid.uuid4()),
            'minutos_jugados': 60,
            'goles': 1,
            'asistencias': 0,
            'tarjetas_amarillas': 0,
            'tarjetas_rojas': 0,
            'valoracion': 8,
            'observaciones': 'Buen desempeño',
        }]})

        response = PartidoViewSet.registrar_estadisticas.__wrapped__(
            view, request, pk=str(partido.pk),
        )

        self.assertEqual(response.status_code, 200)
        entrada.save.assert_called_once_with()

    @patch('sports.views.EstadisticaPartidoSerializer')
    @patch('sports.views.EstadisticaPartido.objects.select_related')
    def test_consultar_estadisticas_por_jugador(self, select_related, serializer_class):
        jugador = SimpleNamespace(pk=uuid.uuid4())
        queryset = MagicMock()
        select_related.return_value.filter.return_value.order_by.return_value = queryset
        serializer_class.return_value.data = [{'minutos_jugados': 60}]
        view = JugadorViewSet()
        view.get_object = MagicMock(return_value=jugador)

        response = view.estadisticas(MagicMock(), pk=str(jugador.pk))

        select_related.return_value.filter.assert_called_once_with(
            jugador=jugador,
            activo=True,
        )
        serializer_class.assert_called_once_with(queryset, many=True)
        self.assertEqual(response.status_code, 200)

    def test_delete_realiza_baja_logica(self):
        estadistica = SimpleNamespace(
            activo=True,
            actualizado_en=None,
            save=MagicMock(),
            delete=MagicMock(),
        )
        view = EstadisticaPartidoViewSet()
        view.get_object = MagicMock(return_value=estadistica)

        response = view.destroy(MagicMock(), pk='estadistica-1')

        self.assertFalse(estadistica.activo)
        estadistica.save.assert_called_once_with(update_fields=['activo', 'actualizado_en'])
        estadistica.delete.assert_not_called()
        self.assertEqual(response.status_code, 204)


class EvolucionFisicaSerializerTests(SimpleTestCase):
    def setUp(self):
        self.jugador = SimpleNamespace(pk=uuid.uuid4())
        self.hoy = date.today()

    @patch('sports.serializers.EvolucionFisica.objects.filter')
    def test_crear_evolucion_fisica_valida(self, filter_mock):
        filter_mock.return_value.exists.return_value = False
        serializer = EvolucionFisicaSerializer()
        attrs = serializer.validate({
            'jugador': self.jugador,
            'fecha': self.hoy,
            'peso_kg': serializer.validate_peso(Decimal('48.5')),
            'altura_cm': serializer.validate_altura(Decimal('1.55')),
            'velocidad_40m': serializer.validate_velocidad_40m(Decimal('6.8')),
            'test_cooper': serializer.validate_test_cooper(Decimal('2100')),
        })
        self.assertEqual(attrs['test_cooper'], Decimal('2100'))

    def test_peso_negativo_devuelve_400(self):
        with self.assertRaises(serializers.ValidationError):
            EvolucionFisicaSerializer().validate_peso(Decimal('-1'))

    def test_altura_negativa_devuelve_400(self):
        with self.assertRaises(serializers.ValidationError):
            EvolucionFisicaSerializer().validate_altura(Decimal('-1'))

    def test_velocidad_40m_negativa_devuelve_400(self):
        with self.assertRaises(serializers.ValidationError):
            EvolucionFisicaSerializer().validate_velocidad_40m(Decimal('-1'))

    def test_cooper_negativo_devuelve_400(self):
        with self.assertRaises(serializers.ValidationError):
            EvolucionFisicaSerializer().validate_test_cooper(Decimal('-1'))

    def test_fecha_futura_devuelve_400(self):
        with self.assertRaises(serializers.ValidationError):
            EvolucionFisicaSerializer().validate_fecha_medicion(
                self.hoy + timedelta(days=1),
            )

    @patch('sports.serializers.EvolucionFisica.objects.filter')
    def test_segunda_medicion_misma_semana_devuelve_400(self, filter_mock):
        filter_mock.return_value.exists.return_value = True
        with self.assertRaises(serializers.ValidationError) as context:
            EvolucionFisicaSerializer().validate({
                'jugador': self.jugador,
                'fecha': self.hoy,
            })
        self.assertIn('fecha_medicion', context.exception.detail)

    @patch('rest_framework.serializers.ModelSerializer.update')
    @patch('sports.serializers.EvolucionFisica.objects.filter')
    def test_editar_medicion_valida(self, filter_mock, model_update):
        filter_mock.return_value.exclude.return_value.exists.return_value = False
        instance = SimpleNamespace(
            pk=uuid.uuid4(),
            jugador=self.jugador,
            fecha=self.hoy,
        )
        serializer = EvolucionFisicaSerializer(instance=instance)
        attrs = serializer.validate({'peso_kg': Decimal('49.2')})
        model_update.return_value = instance

        resultado = serializer.update(instance, attrs)

        self.assertIs(resultado, instance)
        model_update.assert_called_once()

    @patch('rest_framework.serializers.ModelSerializer.create')
    def test_error_esperado_no_devuelve_500(self, create_mock):
        create_mock.side_effect = IntegrityError('datos inválidos')
        with self.assertRaises(serializers.ValidationError) as context:
            EvolucionFisicaSerializer().create({
                'jugador': self.jugador,
                'fecha': self.hoy,
                'peso_kg': Decimal('48.5'),
                'altura_cm': Decimal('1.55'),
                'velocidad_40m': Decimal('6.8'),
                'test_cooper': Decimal('2100'),
            })
        self.assertIn('non_field_errors', context.exception.detail)


class EvolucionFisicaViewSetTests(SimpleTestCase):
    @patch('sports.views.EvolucionFisicaSerializer')
    @patch('sports.views.EvolucionFisica.objects.filter')
    def test_consultar_historial_por_jugador(self, filter_mock, serializer_class):
        jugador = SimpleNamespace(pk=uuid.uuid4())
        queryset = MagicMock()
        filter_mock.return_value.order_by.return_value = queryset
        serializer_class.return_value.data = [{'peso': '48.50'}]
        view = JugadorViewSet()
        view.get_object = MagicMock(return_value=jugador)

        response = view.evolucion_fisica(MagicMock(), pk=str(jugador.pk))

        filter_mock.assert_called_once_with(jugador=jugador, activo=True)
        serializer_class.assert_called_once_with(queryset, many=True)
        self.assertEqual(response.status_code, 200)

    @patch('sports.views.EvolucionFisicaSerializer')
    @patch('sports.views.EvolucionFisica.objects.filter')
    def test_consultar_ultimos_12_registros(self, filter_mock, serializer_class):
        jugador = SimpleNamespace(pk=uuid.uuid4())
        ordered = MagicMock()
        last_twelve = MagicMock()
        filter_mock.return_value.order_by.return_value = ordered
        ordered.__getitem__.return_value = last_twelve
        serializer_class.return_value.data = []
        view = JugadorViewSet()
        view.get_object = MagicMock(return_value=jugador)

        response = view.ultimos_12_evolucion_fisica(
            MagicMock(), pk=str(jugador.pk),
        )

        ordered.__getitem__.assert_called_once_with(slice(None, 12, None))
        serializer_class.assert_called_once_with(last_twelve, many=True)
        self.assertEqual(response.status_code, 200)

    def test_delete_realiza_baja_logica(self):
        evolucion = SimpleNamespace(
            activo=True,
            actualizado_en=None,
            save=MagicMock(),
            delete=MagicMock(),
        )
        view = EvolucionFisicaViewSet()
        view.get_object = MagicMock(return_value=evolucion)

        response = view.destroy(MagicMock(), pk='evolucion-1')

        self.assertFalse(evolucion.activo)
        evolucion.save.assert_called_once_with(update_fields=['activo', 'actualizado_en'])
        evolucion.delete.assert_not_called()
        self.assertEqual(response.status_code, 204)


class EventoSerializerTests(SimpleTestCase):
    def setUp(self):
        self.inicio = datetime(2026, 7, 1, 14, 0, tzinfo=timezone.utc)
        self.club = SimpleNamespace(pk=uuid.uuid4())

    def test_rechaza_campos_obligatorios_ausentes(self):
        serializer = EventoSerializer(data={})

        self.assertFalse(serializer.is_valid())
        for campo in ('club', 'titulo', 'tipo', 'fecha_inicio', 'fecha_fin'):
            self.assertIn(campo, serializer.errors)

    def test_rechaza_fecha_fin_igual_o_anterior_al_inicio(self):
        serializer = EventoSerializer()

        with self.assertRaises(serializers.ValidationError) as context:
            serializer.validate({
                'fecha_inicio': self.inicio,
                'fecha_fin': self.inicio,
            })

        self.assertIn('fecha_fin', context.exception.detail)

    def test_partido_exige_rival(self):
        serializer = EventoSerializer()

        with self.assertRaises(serializers.ValidationError) as context:
            serializer.validate({'tipo': Evento.Tipo.PARTIDO, 'rival': None})

        self.assertIn('rival', context.exception.detail)

    def test_entrenamiento_permite_ubicacion_vacia(self):
        serializer = EventoSerializer()

        attrs = serializer.validate({
            'tipo': Evento.Tipo.ENTRENAMIENTO,
            'ubicacion': None,
        })

        self.assertIsNone(attrs['ubicacion'])

    def test_rechaza_equipo_de_otro_club(self):
        serializer = EventoSerializer()
        equipo = SimpleNamespace(club_id=uuid.uuid4())

        with self.assertRaises(serializers.ValidationError) as context:
            serializer.validate({'club': self.club, 'equipo': equipo})

        self.assertIn('equipo', context.exception.detail)

    @patch('sports.serializers.Evento.objects.filter')
    def test_rechaza_evento_duplicado(self, filter_mock):
        filter_mock.return_value.filter.return_value.exists.return_value = True
        serializer = EventoSerializer()
        equipo = SimpleNamespace(pk=uuid.uuid4(), club_id=self.club.pk)

        with self.assertRaises(serializers.ValidationError) as context:
            serializer.validate({
                'club': self.club,
                'equipo': equipo,
                'titulo': 'Entrenamiento táctico',
                'fecha_inicio': self.inicio,
                'fecha_fin': self.inicio + timedelta(hours=2),
            })

        self.assertIn('non_field_errors', context.exception.detail)
        filter_mock.assert_called_once_with(
            club=self.club,
            titulo__iexact='Entrenamiento táctico',
            fecha_inicio=self.inicio,
        )
        filter_mock.return_value.filter.assert_called_once_with(equipo=equipo)


class EventoViewSetTests(SimpleTestCase):
    @patch('sports.views.UsuarioClub.objects.filter')
    def test_usuario_anonimo_puede_crear_hasta_integrar_autenticacion(self, filter_mock):
        club = SimpleNamespace(pk=uuid.uuid4())
        serializer = MagicMock(validated_data={'club': club})
        view = EventoViewSet()
        view.request = SimpleNamespace(user=SimpleNamespace(pk=None))

        view.perform_create(serializer)

        filter_mock.assert_not_called()
        serializer.save.assert_called_once_with()

    @patch('sports.views.UsuarioClub.objects.filter')
    def test_creacion_exige_entrenador_o_administrador_activo(self, filter_mock):
        filter_mock.return_value.exists.return_value = False
        club = SimpleNamespace(pk=uuid.uuid4())
        serializer = MagicMock(validated_data={'club': club})
        view = EventoViewSet()
        view.request = SimpleNamespace(user=SimpleNamespace(pk=uuid.uuid4()))

        with self.assertRaises(PermissionDenied) as context:
            view.perform_create(serializer)

        self.assertEqual(context.exception.status_code, 403)
        serializer.save.assert_not_called()

    @patch('sports.views.UsuarioClub.objects.filter')
    def test_entrenador_activo_puede_crear_evento(self, filter_mock):
        filter_mock.return_value.exists.return_value = True
        club = SimpleNamespace(pk=uuid.uuid4())
        usuario_id = uuid.uuid4()
        serializer = MagicMock(validated_data={'club': club})
        view = EventoViewSet()
        view.request = SimpleNamespace(user=SimpleNamespace(pk=usuario_id))

        view.perform_create(serializer)

        filter_mock.assert_called_once_with(
            usuario_id=usuario_id,
            club=club,
            rol__in=(RolUsuario.ENTRENADOR, RolUsuario.COORDINADOR),
            estado=EstadoUsuarioClub.ACTIVO,
        )
        serializer.save.assert_called_once_with()

    def test_eliminar_evento_realiza_baja_logica(self):
        evento = SimpleNamespace(
            activo=True,
            actualizado_en=None,
            save=MagicMock(),
            delete=MagicMock(),
        )
        view = EventoViewSet()
        view.get_object = MagicMock(return_value=evento)

        response = view.destroy(MagicMock(), pk='evento-1')

        self.assertFalse(evento.activo)
        evento.save.assert_called_once_with(
            update_fields=['activo', 'actualizado_en'],
        )
        evento.delete.assert_not_called()
        self.assertEqual(response.status_code, 204)

    def test_no_finaliza_evento_cancelado(self):
        evento = SimpleNamespace(
            estado=Evento.Estado.CANCELADO,
            save=MagicMock(),
        )
        view = EventoViewSet()
        view.get_object = MagicMock(return_value=evento)

        response = view.finalizar(MagicMock(), pk='evento-1')

        evento.save.assert_not_called()
        self.assertEqual(response.status_code, 400)

    def test_no_cancela_evento_finalizado(self):
        evento = SimpleNamespace(
            estado=Evento.Estado.FINALIZADO,
            save=MagicMock(),
        )
        view = EventoViewSet()
        view.get_object = MagicMock(return_value=evento)

        response = view.cancelar(MagicMock(), pk='evento-1')

        evento.save.assert_not_called()
        self.assertEqual(response.status_code, 400)

    @patch('sports.views.EventoSerializer')
    def test_finaliza_evento_programado(self, serializer_mock):
        evento = SimpleNamespace(
            estado=Evento.Estado.PROGRAMADO,
            actualizado_en=None,
            save=MagicMock(),
        )
        serializer_mock.return_value.data = {'estado': Evento.Estado.FINALIZADO}
        view = EventoViewSet()
        view.get_object = MagicMock(return_value=evento)
        view.get_serializer = serializer_mock

        response = view.finalizar(MagicMock(), pk='evento-1')

        self.assertEqual(evento.estado, Evento.Estado.FINALIZADO)
        evento.save.assert_called_once_with(
            update_fields=['estado', 'actualizado_en'],
        )
        self.assertEqual(response.status_code, 200)


class GeneracionConvocatoriasTests(SimpleTestCase):
    def setUp(self):
        self.evento = SimpleNamespace(
            pk=uuid.uuid4(),
            club_id=uuid.uuid4(),
            equipo_id=uuid.uuid4(),
            estado=Evento.Estado.PROGRAMADO,
        )

    @patch('sports.serializers.Convocatoria.objects.bulk_create')
    @patch('sports.serializers.Convocatoria.objects.filter')
    @patch('sports.serializers.JugadorEquipo.objects.filter')
    def test_genera_convocatorias_de_jugadores_activos_del_equipo(
        self, relaciones_filter, convocatorias_filter, bulk_create,
    ):
        jugadores = [uuid.uuid4(), uuid.uuid4()]
        relaciones_filter.return_value.values_list.return_value.distinct.return_value = jugadores
        convocatorias_filter.return_value.values_list.return_value = []

        creadas = generar_convocatorias_evento(self.evento)

        self.assertEqual(creadas, 2)
        relaciones_filter.assert_called_once_with(
            equipo_id=self.evento.equipo_id,
            activo=True,
            jugador__estado='ACTIVO',
            jugador__club_id=self.evento.club_id,
        )
        objetos = bulk_create.call_args.args[0]
        self.assertEqual({item.jugador_id for item in objetos}, set(jugadores))
        self.assertTrue(all(item.estado == Convocatoria.Estado.PENDIENTE for item in objetos))
        bulk_create.assert_called_once_with(objetos, ignore_conflicts=True)

    @patch('sports.serializers.Convocatoria.objects.bulk_create')
    @patch('sports.serializers.Convocatoria.objects.filter')
    @patch('sports.serializers.JugadorEquipo.objects.filter')
    def test_no_duplica_convocatorias_existentes(
        self, relaciones_filter, convocatorias_filter, bulk_create,
    ):
        existente = uuid.uuid4()
        nuevo = uuid.uuid4()
        relaciones_filter.return_value.values_list.return_value.distinct.return_value = [existente, nuevo]
        convocatorias_filter.return_value.values_list.return_value = [existente]

        creadas = generar_convocatorias_evento(self.evento)

        self.assertEqual(creadas, 1)
        objetos = bulk_create.call_args.args[0]
        self.assertEqual([item.jugador_id for item in objetos], [nuevo])

    @patch('sports.serializers.JugadorEquipo.objects.filter')
    def test_evento_sin_equipo_no_rompe_creacion_automatica(self, relaciones_filter):
        self.evento.equipo_id = None

        creadas = generar_convocatorias_evento(self.evento, exigir_equipo=False)

        self.assertEqual(creadas, 0)
        relaciones_filter.assert_not_called()

    def test_generacion_manual_exige_equipo(self):
        self.evento.equipo_id = None

        with self.assertRaises(serializers.ValidationError) as context:
            generar_convocatorias_evento(self.evento)

        self.assertIn('equipo', context.exception.detail)

    def test_evento_cancelado_o_finalizado_no_permite_generar(self):
        for estado in (Evento.Estado.CANCELADO, Evento.Estado.FINALIZADO):
            with self.subTest(estado=estado):
                self.evento.estado = estado
                with self.assertRaises(serializers.ValidationError) as context:
                    generar_convocatorias_evento(self.evento)
                self.assertIn('evento', context.exception.detail)

    @patch('sports.serializers.generar_convocatorias_evento')
    @patch('rest_framework.serializers.ModelSerializer.create')
    def test_crear_evento_con_equipo_genera_convocatorias(
        self, model_create, generar_mock,
    ):
        model_create.return_value = self.evento
        serializer = EventoSerializer()

        resultado = EventoSerializer.create.__wrapped__(serializer, {})

        self.assertIs(resultado, self.evento)
        generar_mock.assert_called_once_with(self.evento, exigir_equipo=False)


class ConvocatoriaSerializerTests(SimpleTestCase):
    @patch('sports.serializers.Convocatoria.objects.filter')
    def test_rechaza_convocatoria_duplicada(self, filter_mock):
        club_id = uuid.uuid4()
        evento = SimpleNamespace(
            club_id=club_id,
            equipo_id=None,
            estado=Evento.Estado.PROGRAMADO,
        )
        jugador = SimpleNamespace(club_id=club_id, estado='ACTIVO')
        filter_mock.return_value.exists.return_value = True

        with self.assertRaises(serializers.ValidationError) as context:
            ConvocatoriaSerializer().validate({'evento': evento, 'jugador': jugador})

        self.assertIn('non_field_errors', context.exception.detail)

    def test_rechaza_agregar_a_evento_cerrado(self):
        club_id = uuid.uuid4()
        jugador = SimpleNamespace(club_id=club_id, estado='ACTIVO')
        for estado in (Evento.Estado.CANCELADO, Evento.Estado.FINALIZADO):
            evento = SimpleNamespace(club_id=club_id, equipo_id=None, estado=estado)
            with self.subTest(estado=estado):
                with self.assertRaises(serializers.ValidationError) as context:
                    ConvocatoriaSerializer().validate({
                        'evento': evento,
                        'jugador': jugador,
                    })
                self.assertIn('evento', context.exception.detail)


class ConvocatoriaViewSetTests(SimpleTestCase):
    def test_quitar_convocatoria_marca_no_convocado(self):
        convocatoria = SimpleNamespace(
            estado=Convocatoria.Estado.PENDIENTE,
            confirmado=None,
            confirmado_en=None,
            save=MagicMock(),
            delete=MagicMock(),
        )
        view = ConvocatoriaViewSet()
        view.get_object = MagicMock(return_value=convocatoria)

        response = view.destroy(MagicMock(), pk='convocatoria-1')

        self.assertEqual(convocatoria.estado, Convocatoria.Estado.NO_CONVOCADO)
        convocatoria.save.assert_called_once_with(
            update_fields=[
                'estado', 'confirmado', 'confirmado_en', 'respuesta',
                'motivo_rechazo', 'respondido_en', 'actualizado_en',
            ],
        )
        convocatoria.delete.assert_not_called()
        self.assertEqual(response.status_code, 204)

    @patch('sports.views.Convocatoria.objects.filter')
    @patch('sports.views.generar_convocatorias_evento')
    def test_generacion_manual_devuelve_cantidad(self, generar_mock, filter_mock):
        evento = SimpleNamespace(pk=uuid.uuid4())
        generar_mock.return_value = 3
        filter_mock.return_value.count.return_value = 5
        view = EventoViewSet()
        view.get_object = MagicMock(return_value=evento)

        response = EventoViewSet.generar_convocatorias.__wrapped__(
            view,
            MagicMock(),
            pk=str(evento.pk),
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['convocatorias_creadas'], 3)
        self.assertEqual(response.data['total'], 5)

    @patch('sports.views.Convocatoria.objects.filter')
    def test_resumen_devuelve_contadores(self, filter_mock):
        evento = SimpleNamespace(pk=uuid.uuid4())
        filter_mock.return_value.values.return_value.annotate.return_value = [
            {'estado': Convocatoria.Estado.PENDIENTE, 'total': 2},
            {'estado': Convocatoria.Estado.CONFIRMADO, 'total': 3},
            {'estado': Convocatoria.Estado.RECHAZADO, 'total': 1},
            {'estado': Convocatoria.Estado.NO_CONVOCADO, 'total': 4},
        ]
        view = EventoViewSet()
        view.get_object = MagicMock(return_value=evento)

        response = view.resumen_convocatorias(MagicMock(), pk=str(evento.pk))

        self.assertEqual(response.data, {
            'evento': str(evento.pk),
            'total': 10,
            'pendientes': 2,
            'confirmados': 3,
            'rechazados': 1,
            'no_convocados': 4,
        })


class RespuestaConvocatoriaTests(SimpleTestCase):
    def build_convocatoria(self, **overrides):
        values = {
            'pk': uuid.uuid4(),
            'estado': Convocatoria.Estado.PENDIENTE,
            'evento': SimpleNamespace(estado=Evento.Estado.PROGRAMADO),
            'respuesta': None,
            'motivo_rechazo': None,
            'respondido_en': None,
            'actualizado_en': None,
            'confirmado': None,
            'confirmado_en': None,
            'save': MagicMock(),
        }
        values.update(overrides)
        return SimpleNamespace(**values)

    def build_view(self, convocatoria):
        view = ConvocatoriaViewSet()
        view.get_object = MagicMock(return_value=convocatoria)
        response_serializer = MagicMock()
        response_serializer.data = {'estado': convocatoria.estado}
        view.get_serializer = MagicMock(return_value=response_serializer)
        return view

    def test_confirmar_convocatoria_valida(self):
        convocatoria = self.build_convocatoria()
        view = self.build_view(convocatoria)

        response = view.confirmar(
            SimpleNamespace(data={}),
            pk=str(convocatoria.pk),
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(convocatoria.estado, Convocatoria.Estado.CONFIRMADO)
        self.assertTrue(convocatoria.confirmado)

    def test_rechazar_convocatoria_valida(self):
        convocatoria = self.build_convocatoria()
        view = self.build_view(convocatoria)

        response = view.rechazar(SimpleNamespace(data={
            'respuesta': Convocatoria.Estado.RECHAZADO,
        }), pk=str(convocatoria.pk))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(convocatoria.estado, Convocatoria.Estado.RECHAZADO)
        self.assertFalse(convocatoria.confirmado)

    def test_rechazar_convocatoria_guarda_motivo(self):
        convocatoria = self.build_convocatoria()
        view = self.build_view(convocatoria)

        view.rechazar(SimpleNamespace(data={
            'motivo_rechazo': 'Motivo familiar',
        }), pk=str(convocatoria.pk))

        self.assertEqual(convocatoria.motivo_rechazo, 'Motivo familiar')

    def test_no_confirma_convocatoria_no_convocado(self):
        convocatoria = self.build_convocatoria(
            estado=Convocatoria.Estado.NO_CONVOCADO,
        )
        view = self.build_view(convocatoria)
        with self.assertRaises(serializers.ValidationError) as context:
            view.confirmar(SimpleNamespace(data={
                'respuesta': Convocatoria.Estado.CONFIRMADO,
            }), pk=str(convocatoria.pk))
        self.assertIn('estado', context.exception.detail)

    def test_no_responde_evento_cancelado(self):
        convocatoria = self.build_convocatoria(
            evento=SimpleNamespace(estado=Evento.Estado.CANCELADO),
        )
        view = self.build_view(convocatoria)
        with self.assertRaises(serializers.ValidationError) as context:
            view.rechazar(SimpleNamespace(data={
                'respuesta': Convocatoria.Estado.RECHAZADO,
            }), pk=str(convocatoria.pk))
        self.assertIn('evento', context.exception.detail)

    def test_registra_respondido_en(self):
        convocatoria = self.build_convocatoria()
        view = self.build_view(convocatoria)

        view.confirmar(SimpleNamespace(data={
            'respuesta': Convocatoria.Estado.CONFIRMADO,
        }), pk=str(convocatoria.pk))

        self.assertIsNotNone(convocatoria.respondido_en)
        convocatoria.save.assert_called_once()

    @patch('sports.views.ConvocatoriaSerializer')
    @patch('sports.views.Convocatoria.objects.select_related')
    def test_consultar_convocatorias_por_jugador(
        self, select_related, serializer_class,
    ):
        jugador = SimpleNamespace(pk=uuid.uuid4())
        queryset = MagicMock()
        select_related.return_value.filter.return_value.order_by.return_value = queryset
        serializer_class.return_value.data = []
        view = JugadorViewSet()
        view.get_object = MagicMock(return_value=jugador)

        response = view.convocatorias(MagicMock(), pk=str(jugador.pk))

        select_related.return_value.filter.assert_called_once_with(jugador=jugador)
        serializer_class.assert_called_once_with(queryset, many=True)
        self.assertEqual(response.status_code, 200)

    @patch('sports.views.TutorJugador.objects.filter')
    def test_consultar_pendientes_padre_como_anonimo(self, tutor_filter):
        initial = MagicMock()
        pending = MagicMock()
        final = MagicMock()
        initial.filter.return_value = pending
        pending.exclude.return_value = final
        view = ConvocatoriaViewSet()
        view.get_queryset = MagicMock(return_value=initial)
        output = MagicMock(data=[])
        view.get_serializer = MagicMock(return_value=output)
        request = SimpleNamespace(user=SimpleNamespace(pk=None))

        response = view.pendientes_padre(request)

        initial.filter.assert_called_once_with(estado=Convocatoria.Estado.PENDIENTE)
        pending.exclude.assert_called_once_with(evento__estado=Evento.Estado.CANCELADO)
        tutor_filter.assert_not_called()
        self.assertEqual(response.status_code, 200)

    def test_respuesta_duplicada_devuelve_400_y_no_500(self):
        convocatoria = self.build_convocatoria(
            estado=Convocatoria.Estado.CONFIRMADO,
            respuesta=Convocatoria.Estado.CONFIRMADO,
        )
        view = self.build_view(convocatoria)
        with self.assertRaises(serializers.ValidationError) as context:
            view.confirmar(SimpleNamespace(data={
                'respuesta': Convocatoria.Estado.CONFIRMADO,
            }), pk=str(convocatoria.pk))
        self.assertIn('respuesta', context.exception.detail)
        convocatoria.save.assert_not_called()


class JugadorSerializerTests(SimpleTestCase):
    def setUp(self):
        self.club_id = uuid.uuid4()
        self.club = SimpleNamespace(pk=self.club_id)
        self.equipo = SimpleNamespace(pk=uuid.uuid4(), club_id=self.club_id)
        self.tutor = SimpleNamespace(
            pk=uuid.uuid4(),
            nombre='Maria',
            apellido='Perez',
            telefono='70000000',
            email='maria@example.com',
        )
        hoy = date.today()
        try:
            self.fecha_nacimiento = hoy.replace(year=hoy.year - 12)
        except ValueError:
            self.fecha_nacimiento = date(hoy.year - 12, 2, 28)

    def build_serializer(self, **overrides):
        data = {
            'club_id': str(self.club_id),
            'nombre': 'Ana',
            'apellido': 'Lopez',
            'fecha_nacimiento': self.fecha_nacimiento.isoformat(),
            'categoria': 'sub 12',
            'equipo_id': str(self.equipo.pk),
            'tutor_usuario_id': str(self.tutor.pk),
            'parentesco': 'Madre',
        }
        data.update(overrides)
        serializer = JugadorSerializer(data=data)
        serializer.fields['club_id'].queryset = MagicMock()
        serializer.fields['club_id'].queryset.get.return_value = self.club
        serializer.fields['equipo_id'].queryset = MagicMock()
        serializer.fields['equipo_id'].queryset.get.return_value = self.equipo
        serializer.fields['tutor_usuario_id'].queryset = MagicMock()
        serializer.fields['tutor_usuario_id'].queryset.get.return_value = self.tutor
        return serializer

    def test_rechaza_campos_obligatorios_ausentes(self):
        serializer = JugadorSerializer(data={})

        self.assertFalse(serializer.is_valid())
        for field in ('club_id', 'nombre', 'apellido', 'fecha_nacimiento', 'categoria'):
            self.assertIn(field, serializer.errors)

    @patch('sports.serializers.Jugador.objects.filter')
    @patch('sports.serializers.CategoriaDeportiva.objects.filter')
    def test_acepta_datos_validos_y_normaliza_categoria(
        self, categoria_filter_mock, jugador_filter_mock,
    ):
        categoria_filter_mock.return_value.first.return_value = SimpleNamespace(
            nombre='Sub 12', edad_minima=10, edad_maxima=15,
        )
        jugador_filter_mock.return_value.exists.return_value = False
        serializer = self.build_serializer()

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data['categoria'], 'Sub 12')

    @patch('sports.serializers.Jugador.objects.filter')
    @patch('sports.serializers.CategoriaDeportiva.objects.filter')
    def test_rechaza_equipo_de_otro_club(
        self, categoria_filter_mock, jugador_filter_mock,
    ):
        categoria_filter_mock.return_value.first.return_value = SimpleNamespace(
            nombre='Sub 12', edad_minima=None, edad_maxima=None,
        )
        jugador_filter_mock.return_value.exists.return_value = False
        self.equipo.club_id = uuid.uuid4()
        serializer = self.build_serializer()

        self.assertFalse(serializer.is_valid())
        self.assertIn('equipo_id', serializer.errors)

    @patch('sports.serializers.Jugador.objects.filter')
    @patch('sports.serializers.CategoriaDeportiva.objects.filter')
    def test_rechaza_edad_fuera_de_categoria(
        self, categoria_filter_mock, jugador_filter_mock,
    ):
        categoria_filter_mock.return_value.first.return_value = SimpleNamespace(
            nombre='Sub 12', edad_minima=13, edad_maxima=15,
        )
        jugador_filter_mock.return_value.exists.return_value = False
        serializer = self.build_serializer()

        self.assertFalse(serializer.is_valid())
        self.assertIn('categoria', serializer.errors)

    @patch('sports.serializers.Jugador.objects.filter')
    @patch('sports.serializers.CategoriaDeportiva.objects.filter')
    def test_rechaza_jugador_duplicado_en_club(
        self, categoria_filter_mock, jugador_filter_mock,
    ):
        categoria_filter_mock.return_value.first.return_value = SimpleNamespace(
            nombre='Sub 12', edad_minima=None, edad_maxima=None,
        )
        jugador_filter_mock.return_value.exists.return_value = True
        serializer = self.build_serializer()

        self.assertFalse(serializer.is_valid())
        self.assertIn('non_field_errors', serializer.errors)

    @patch('sports.serializers.Jugador.objects.filter')
    @patch('sports.serializers.CategoriaDeportiva.objects.filter')
    def test_exige_tutor_responsable(
        self, categoria_filter_mock, jugador_filter_mock,
    ):
        categoria_filter_mock.return_value.first.return_value = SimpleNamespace(
            nombre='Sub 12', edad_minima=None, edad_maxima=None,
        )
        jugador_filter_mock.return_value.exists.return_value = False
        serializer = self.build_serializer(
            tutor_usuario_id=None,
            parentesco=None,
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn('tutor_usuario_id', serializer.errors)


class JugadorViewSetTests(SimpleTestCase):
    @patch('sports.views.JugadorSerializer')
    def test_desactiva_jugador(self, serializer_mock):
        jugador = SimpleNamespace(
            estado='ACTIVO', actualizado_en=None, save=MagicMock(),
        )
        serializer_mock.return_value.data = {'estado': 'INACTIVO'}
        view = JugadorViewSet()
        view.get_object = MagicMock(return_value=jugador)
        view.get_serializer = serializer_mock

        response = view.desactivar(MagicMock(), pk='jugador-1')

        self.assertEqual(jugador.estado, 'INACTIVO')
        jugador.save.assert_called_once_with(
            update_fields=['estado', 'actualizado_en'],
        )
        self.assertEqual(response.status_code, 200)

    @patch('sports.views.JugadorSerializer')
    def test_activa_jugador(self, serializer_mock):
        jugador = SimpleNamespace(
            estado='INACTIVO', actualizado_en=None, save=MagicMock(),
        )
        serializer_mock.return_value.data = {'estado': 'ACTIVO'}
        view = JugadorViewSet()
        view.get_object = MagicMock(return_value=jugador)
        view.get_serializer = serializer_mock

        response = view.activar(MagicMock(), pk='jugador-1')

        self.assertEqual(jugador.estado, 'ACTIVO')
        jugador.save.assert_called_once_with(
            update_fields=['estado', 'actualizado_en'],
        )
        self.assertEqual(response.status_code, 200)

    def test_eliminar_jugador_realiza_baja_logica(self):
        jugador = SimpleNamespace(
            estado='ACTIVO', actualizado_en=None,
            save=MagicMock(), delete=MagicMock(),
        )
        view = JugadorViewSet()
        view.get_object = MagicMock(return_value=jugador)

        response = view.destroy(MagicMock(), pk='jugador-1')

        self.assertEqual(jugador.estado, 'INACTIVO')
        jugador.save.assert_called_once_with(
            update_fields=['estado', 'actualizado_en'],
        )
        jugador.delete.assert_not_called()
        self.assertEqual(response.status_code, 204)


class EquipoSerializerTests(SimpleTestCase):
    def setUp(self):
        self.club_id = uuid.uuid4()
        self.club = SimpleNamespace(pk=self.club_id)

    def build_serializer(self, data):
        serializer = EquipoSerializer(data=data)
        serializer.fields['club_id'].queryset = MagicMock()
        serializer.fields['club_id'].queryset.get.return_value = self.club
        return serializer

    def test_rechaza_campos_obligatorios_ausentes(self):
        serializer = EquipoSerializer(data={})

        self.assertFalse(serializer.is_valid())
        self.assertIn('club_id', serializer.errors)
        self.assertIn('nombre', serializer.errors)
        self.assertIn('categoria', serializer.errors)
        self.assertIn('temporada', serializer.errors)

    @patch('sports.serializers.CategoriaDeportiva.objects.filter')
    @patch('sports.serializers.Equipo.objects.filter')
    def test_valida_categoria_del_mismo_club(
        self,
        equipo_filter_mock,
        categoria_filter_mock,
    ):
        categoria_filter_mock.return_value.first.return_value = None
        equipo_filter_mock.return_value.exists.return_value = False
        serializer = self.build_serializer({
            'club_id': str(self.club_id),
            'nombre': 'Sub 12 A',
            'categoria': 'Sub-12',
            'temporada': '2026',
        })

        self.assertFalse(serializer.is_valid())
        self.assertIn('categoria', serializer.errors)
        categoria_filter_mock.assert_called_once_with(
            club=self.club,
            nombre__iexact='Sub-12',
        )

    @patch('sports.serializers.CategoriaDeportiva.objects.filter')
    @patch('sports.serializers.Equipo.objects.filter')
    def test_rechaza_duplicado_por_nombre_club_y_temporada(
        self,
        equipo_filter_mock,
        categoria_filter_mock,
    ):
        categoria_filter_mock.return_value.first.return_value = SimpleNamespace(
            nombre='Sub-12',
        )
        equipo_filter_mock.return_value.exists.return_value = True
        serializer = self.build_serializer({
            'club_id': str(self.club_id),
            'nombre': 'Sub 12 A',
            'categoria': 'Sub-12',
            'temporada': '2026',
        })

        self.assertFalse(serializer.is_valid())
        self.assertIn('non_field_errors', serializer.errors)
        equipo_filter_mock.assert_called_once_with(
            club=self.club,
            nombre__iexact='Sub 12 A',
            temporada__iexact='2026',
        )

    @patch('sports.serializers.CategoriaDeportiva.objects.filter')
    @patch('sports.serializers.Equipo.objects.filter')
    def test_acepta_y_normaliza_categoria_existente(
        self,
        equipo_filter_mock,
        categoria_filter_mock,
    ):
        categoria_filter_mock.return_value.first.return_value = SimpleNamespace(
            nombre='Sub-12',
        )
        equipo_filter_mock.return_value.exists.return_value = False
        serializer = self.build_serializer({
            'club_id': str(self.club_id),
            'nombre': 'Sub 12 A',
            'categoria': 'sub-12',
            'temporada': '2026',
        })

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data['categoria'], 'Sub-12')

    @patch('sports.serializers.Equipo.objects.create')
    def test_error_de_tipo_en_base_se_convierte_en_validacion(self, create_mock):
        create_mock.side_effect = DataError('invalid input value for enum')
        serializer = EquipoSerializer()

        with self.assertRaises(serializers.ValidationError) as context:
            serializer.create({
                'club': self.club,
                'nombre': 'Ludobi',
                'categoria': 'Sub 12',
                'temporada': '2025',
            })

        self.assertIn('categoria', context.exception.detail)

    @patch('sports.serializers.Equipo.objects.create')
    def test_conflicto_de_integridad_se_convierte_en_validacion(self, create_mock):
        create_mock.side_effect = IntegrityError('duplicate key')
        serializer = EquipoSerializer()

        with self.assertRaises(serializers.ValidationError) as context:
            serializer.create({
                'club': self.club,
                'nombre': 'Ludobi',
                'categoria': 'Sub 12',
                'temporada': '2025',
            })

        self.assertIn('non_field_errors', context.exception.detail)


class EquipoViewSetTests(SimpleTestCase):
    @patch('sports.views.EquipoSerializer')
    def test_desactiva_equipo(self, serializer_mock):
        equipo = SimpleNamespace(
            activo=True,
            actualizado_en=None,
            save=MagicMock(),
        )
        serializer_mock.return_value.data = {'activo': False}
        view = EquipoViewSet()
        view.get_object = MagicMock(return_value=equipo)
        view.get_serializer = serializer_mock

        response = view.desactivar(MagicMock(), pk='equipo-1')

        self.assertFalse(equipo.activo)
        equipo.save.assert_called_once_with(
            update_fields=['activo', 'actualizado_en'],
        )
        self.assertEqual(response.status_code, 200)

    @patch('sports.views.EquipoSerializer')
    def test_activa_equipo(self, serializer_mock):
        equipo = SimpleNamespace(
            activo=False,
            actualizado_en=None,
            save=MagicMock(),
        )
        serializer_mock.return_value.data = {'activo': True}
        view = EquipoViewSet()
        view.get_object = MagicMock(return_value=equipo)
        view.get_serializer = serializer_mock

        response = view.activar(MagicMock(), pk='equipo-1')

        self.assertTrue(equipo.activo)
        equipo.save.assert_called_once_with(
            update_fields=['activo', 'actualizado_en'],
        )
        self.assertEqual(response.status_code, 200)

    def test_eliminar_equipo_realiza_baja_logica(self):
        equipo = SimpleNamespace(
            activo=True,
            actualizado_en=None,
            save=MagicMock(),
            delete=MagicMock(),
        )
        view = EquipoViewSet()
        view.get_object = MagicMock(return_value=equipo)

        response = view.destroy(MagicMock(), pk='equipo-1')

        self.assertFalse(equipo.activo)
        equipo.save.assert_called_once_with(
            update_fields=['activo', 'actualizado_en'],
        )
        equipo.delete.assert_not_called()
        self.assertEqual(response.status_code, 204)


class CategoriaDeportivaSerializerTests(SimpleTestCase):
    def test_rechaza_categoria_sin_nombre(self):
        serializer = CategoriaDeportivaSerializer(
            data={'nombre': ''},
            context={'club': SimpleNamespace(pk='club-1')},
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn('nombre', serializer.errors)

    @patch('sports.serializers.CategoriaDeportiva.objects.filter')
    def test_rechaza_categoria_duplicada_en_mismo_club(self, filter_mock):
        filter_mock.return_value.exists.return_value = True
        club = SimpleNamespace(pk='club-1')
        serializer = CategoriaDeportivaSerializer(
            data={'nombre': 'SUB-12'},
            context={'club': club},
        )

        self.assertFalse(serializer.is_valid())
        filter_mock.assert_called_once_with(club=club, nombre__iexact='SUB-12')
        self.assertEqual(
            str(serializer.errors['nombre'][0]),
            'Ya existe una categoría con ese nombre en el club.',
        )

    @patch('sports.serializers.CategoriaDeportiva.objects.filter')
    def test_permite_mismo_nombre_en_clubes_diferentes(self, filter_mock):
        filter_mock.return_value.exists.return_value = False
        club_a = SimpleNamespace(pk='club-1')
        club_b = SimpleNamespace(pk='club-2')
        serializer_a = CategoriaDeportivaSerializer(
            data={'nombre': 'Sub-12'},
            context={'club': club_a},
        )
        serializer_b = CategoriaDeportivaSerializer(
            data={'nombre': 'Sub-12'},
            context={'club': club_b},
        )

        self.assertTrue(serializer_a.is_valid(), serializer_a.errors)
        self.assertTrue(serializer_b.is_valid(), serializer_b.errors)
        self.assertEqual(filter_mock.call_args_list[0].kwargs['club'], club_a)
        self.assertEqual(filter_mock.call_args_list[1].kwargs['club'], club_b)

    @patch('rest_framework.serializers.ModelSerializer.update')
    @patch('sports.serializers.CategoriaDeportiva.objects.filter')
    def test_edita_categoria(self, filter_mock, update_mock):
        filter_mock.return_value.exclude.return_value.exists.return_value = False
        club = SimpleNamespace(pk='club-1')
        instance = MagicMock(
            pk='categoria-1',
            club=club,
            nombre='Sub-10',
            edad_minima=8,
            edad_maxima=10,
        )
        update_mock.return_value = instance
        serializer = CategoriaDeportivaSerializer(
            instance,
            data={'nombre': 'Sub-12', 'edad_minima': 10, 'edad_maxima': 12},
            partial=True,
            context={'club': club},
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.update(instance, serializer.validated_data)
        self.assertEqual(serializer.validated_data['nombre'], 'Sub-12')
        update_mock.assert_called_once_with(instance, serializer.validated_data)


class CategoriaClubListCreateViewTests(SimpleTestCase):
    @patch('sports.views.CategoriaDeportivaSerializer')
    @patch('sports.views.CategoriaDeportiva.objects.filter')
    @patch('sports.views.get_object_or_404')
    def test_lista_categorias_activas_del_club(
        self,
        get_object_mock,
        filter_mock,
        serializer_mock,
    ):
        club = SimpleNamespace(pk='club-1')
        active_queryset = MagicMock()
        get_object_mock.return_value = club
        filter_mock.return_value.filter.return_value = active_queryset
        serializer_mock.return_value.data = [{'id': 1, 'nombre': 'Sub-12'}]
        request = MagicMock(query_params={'estado': 'activas'})

        response = CategoriaClubListCreateView().get(request, club_id='club-1')

        filter_mock.assert_called_once_with(club=club)
        filter_mock.return_value.filter.assert_called_once_with(activo=True)
        serializer_mock.assert_called_once_with(active_queryset, many=True)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data[0]['nombre'], 'Sub-12')

    @patch('sports.views.CategoriaDeportivaSerializer')
    @patch('sports.views.get_object_or_404')
    def test_crea_categoria_correctamente(self, get_object_mock, serializer_mock):
        club = SimpleNamespace(pk='club-1')
        get_object_mock.return_value = club
        serializer_mock.return_value.data = {'id': 1, 'nombre': 'Sub-12'}
        request = MagicMock(data={'nombre': 'Sub-12'})

        response = CategoriaClubListCreateView().post(request, club_id='club-1')

        serializer_mock.assert_called_once_with(
            data={'nombre': 'Sub-12'},
            context={'club': club},
        )
        serializer_mock.return_value.is_valid.assert_called_once_with(
            raise_exception=True,
        )
        serializer_mock.return_value.save.assert_called_once_with(club=club)
        self.assertEqual(response.status_code, 201)


class CategoriaDeportivaViewSetTests(SimpleTestCase):
    @patch('sports.views.CategoriaDeportivaSerializer')
    def test_desactiva_categoria(self, serializer_mock):
        categoria = SimpleNamespace(activo=True, save=MagicMock())
        serializer_mock.return_value.data = {'id': 1, 'activo': False}
        view = CategoriaDeportivaViewSet()
        view.get_object = MagicMock(return_value=categoria)
        view.get_serializer = serializer_mock

        response = view.desactivar(MagicMock(), pk='1')

        self.assertFalse(categoria.activo)
        categoria.save.assert_called_once_with(update_fields=['activo', 'updated_at'])
        self.assertEqual(response.status_code, 200)

    @patch('sports.views.CategoriaDeportivaSerializer')
    def test_activa_categoria(self, serializer_mock):
        categoria = SimpleNamespace(activo=False, save=MagicMock())
        serializer_mock.return_value.data = {'id': 1, 'activo': True}
        view = CategoriaDeportivaViewSet()
        view.get_object = MagicMock(return_value=categoria)
        view.get_serializer = serializer_mock

        response = view.activar(MagicMock(), pk='1')

        self.assertTrue(categoria.activo)
        categoria.save.assert_called_once_with(update_fields=['activo', 'updated_at'])
        self.assertEqual(response.status_code, 200)

    @patch('sports.views.Equipo.objects.filter')
    def test_elimina_categoria_sin_equipos_asociados(self, filter_mock):
        filter_mock.return_value.exists.return_value = False
        club = SimpleNamespace(pk='club-1')
        categoria = SimpleNamespace(nombre='Sub-12', club=club, delete=MagicMock())
        view = CategoriaDeportivaViewSet()
        view.get_object = MagicMock(return_value=categoria)

        response = view.destroy(MagicMock(), pk='1')

        filter_mock.assert_called_once_with(
            club=club,
            categoria__iexact='Sub-12',
            activo=True,
        )
        categoria.delete.assert_called_once_with()
        self.assertEqual(response.status_code, 204)

    @patch('sports.views.Equipo.objects.filter')
    def test_rechaza_eliminacion_con_equipos_asociados(self, filter_mock):
        filter_mock.return_value.exists.return_value = True
        categoria = SimpleNamespace(
            nombre='Sub-12',
            club=SimpleNamespace(pk='club-1'),
            delete=MagicMock(),
        )
        view = CategoriaDeportivaViewSet()
        view.get_object = MagicMock(return_value=categoria)

        response = view.destroy(MagicMock(), pk='1')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.data['detail'],
            'No se puede eliminar: tiene equipos asociados',
        )
        categoria.delete.assert_not_called()


class CategoriaPredefinidasViewTests(SimpleTestCase):
    def test_lista_categorias_predefinidas(self):
        request = APIRequestFactory().get('/api/categorias/predefinidas/')

        response = CategoriaPredefinidasView.as_view()(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, CATEGORIAS_PREDEFINIDAS)
        self.assertEqual(response.data[0], 'Prebenjamín')
        self.assertEqual(response.data[-1], 'Sénior')


class CuotaSocialTests(SimpleTestCase):
    def build_cuota(self, **overrides):
        values = {
            'pk': uuid.uuid4(),
            'club_id': uuid.uuid4(),
            'equipo_id': None,
            'concepto': 'Cuota mensual junio',
            'monto': Decimal('80.00'),
            'moneda': 'BOB',
            'fecha_vencimiento': date(2026, 6, 30),
            'estado': Cuota.Estado.ACTIVA,
        }
        values.update(overrides)
        return SimpleNamespace(**values)

    @patch('sports.serializers.Cuota.objects.create')
    def test_crear_cuota_valida(self, create):
        serializer = CuotaSerializer()
        values = {
            'club': SimpleNamespace(pk=uuid.uuid4()),
            'concepto': serializer.validate_concepto(' Cuota junio '),
            'monto': serializer.validate_monto(Decimal('80.00')),
            'fecha_vencimiento': date(2026, 6, 30),
        }
        serializer.create(values)
        saved = create.call_args.kwargs
        self.assertEqual(saved['concepto'], 'Cuota junio')
        self.assertEqual(saved['moneda'], 'BOB')
        self.assertEqual(saved['estado'], Cuota.Estado.ACTIVA)

    def test_monto_negativo_devuelve_validacion_clara(self):
        with self.assertRaises(serializers.ValidationError) as context:
            CuotaSerializer().validate_monto(Decimal('-1.00'))
        self.assertIn('mayor a 0', str(context.exception.detail))

    def test_concepto_vacio_devuelve_validacion_clara(self):
        with self.assertRaises(serializers.ValidationError) as context:
            CuotaSerializer().validate_concepto('   ')
        self.assertIn('obligatorio', str(context.exception.detail))

    def test_fecha_vencimiento_es_obligatoria(self):
        field = CuotaSerializer().fields['fecha_vencimiento']
        with self.assertRaises(serializers.ValidationError) as context:
            field.run_validation(serializers.empty)
        self.assertEqual(context.exception.detail[0].code, 'required')

    @patch('sports.serializers.insertar_pagos_pendientes')
    @patch('sports.serializers.Pago.objects.filter')
    @patch('sports.serializers.JugadorEquipo.objects.filter')
    def test_generar_pagos_para_equipo(self, relaciones, pagos_filter, insertar):
        jugador_ids = [uuid.uuid4(), uuid.uuid4()]
        relaciones.return_value.values_list.return_value.distinct.return_value = jugador_ids
        pagos_filter.return_value.values_list.return_value = []
        insertar.return_value = 2
        cuota = self.build_cuota(equipo_id=uuid.uuid4())
        resultado = generar_pagos_cuota.__wrapped__(cuota)
        relaciones.assert_called_once_with(
            equipo_id=cuota.equipo_id,
            activo=True,
            jugador__estado='ACTIVO',
            jugador__club_id=cuota.club_id,
        )
        self.assertEqual(resultado, {'pagos_creados': 2, 'total': 2})
        params = insertar.call_args.args[0]
        self.assertIn('%s::estado_pago', PAGO_PENDIENTE_INSERT_SQL)
        self.assertIn('ON CONFLICT (cuota_id, jugador_id) DO NOTHING', PAGO_PENDIENTE_INSERT_SQL)
        self.assertEqual(len(params), 2)
        self.assertEqual(params[0][5], Pago.Estado.PENDIENTE)

    @patch('sports.serializers.insertar_pagos_pendientes')
    @patch('sports.serializers.Pago.objects.filter')
    @patch('sports.serializers.Jugador.objects.filter')
    def test_generar_pagos_para_club(self, jugadores, pagos_filter, insertar):
        jugador_ids = [uuid.uuid4(), uuid.uuid4(), uuid.uuid4()]
        jugadores.return_value.values_list.return_value = jugador_ids
        pagos_filter.return_value.values_list.return_value = []
        insertar.return_value = 3
        resultado = generar_pagos_cuota.__wrapped__(self.build_cuota())
        self.assertEqual(resultado, {'pagos_creados': 3, 'total': 3})
        self.assertEqual(len(insertar.call_args.args[0]), 3)

    @patch('sports.serializers.insertar_pagos_pendientes')
    @patch('sports.serializers.Pago.objects.filter')
    @patch('sports.serializers.Jugador.objects.filter')
    def test_no_duplica_pagos_al_generar_dos_veces(
        self, jugadores, pagos_filter, insertar,
    ):
        jugador_id = uuid.uuid4()
        jugadores.return_value.values_list.return_value = [jugador_id]
        pagos_filter.return_value.values_list.side_effect = [[], [jugador_id]]
        insertar.return_value = 1
        cuota = self.build_cuota()
        primero = generar_pagos_cuota.__wrapped__(cuota)
        segundo = generar_pagos_cuota.__wrapped__(cuota)
        self.assertEqual(primero['pagos_creados'], 1)
        self.assertEqual(segundo['pagos_creados'], 0)
        insertar.assert_called_once()

    @patch('sports.views.PagoSerializer')
    @patch('sports.views.Pago.objects.select_related')
    def test_consultar_pagos_por_cuota(self, select_related, serializer_class):
        cuota = self.build_cuota()
        queryset = MagicMock()
        select_related.return_value.filter.return_value.order_by.return_value = queryset
        serializer_class.return_value.data = []
        view = CuotaViewSet()
        view.get_object = MagicMock(return_value=cuota)
        response = view.pagos(MagicMock(), pk=str(cuota.pk))
        select_related.return_value.filter.assert_called_once_with(cuota=cuota)
        serializer_class.assert_called_once_with(queryset, many=True)
        self.assertEqual(response.status_code, 200)

    @patch('sports.views.PagoSerializer')
    @patch('sports.views.Pago.objects.select_related')
    def test_consultar_pagos_pendientes_por_jugador(
        self, select_related, serializer_class,
    ):
        jugador = SimpleNamespace(pk=uuid.uuid4())
        queryset = MagicMock()
        select_related.return_value.filter.return_value.order_by.return_value = queryset
        serializer_class.return_value.data = []
        view = JugadorViewSet()
        view.get_object = MagicMock(return_value=jugador)
        response = view.pagos(MagicMock(), pk=str(jugador.pk))
        select_related.return_value.filter.assert_called_once_with(
            jugador=jugador,
            estado=Pago.Estado.PENDIENTE,
        )
        serializer_class.assert_called_once_with(queryset, many=True)
        self.assertEqual(response.status_code, 200)

    @patch('sports.serializers.Jugador.objects.filter')
    def test_sin_jugadores_devuelve_400_y_no_500(self, jugadores):
        jugadores.return_value.values_list.return_value = []
        with self.assertRaises(serializers.ValidationError) as context:
            generar_pagos_cuota.__wrapped__(self.build_cuota())
        self.assertIn('jugadores', context.exception.detail)
