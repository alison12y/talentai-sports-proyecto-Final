import uuid
from datetime import date
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.db import DataError, IntegrityError
from django.test import SimpleTestCase
from rest_framework import serializers
from rest_framework.test import APIRequestFactory

from .serializers import CategoriaDeportivaSerializer, EquipoSerializer, JugadorSerializer
from .views import (
    CATEGORIAS_PREDEFINIDAS,
    CategoriaClubListCreateView,
    CategoriaDeportivaViewSet,
    CategoriaPredefinidasView,
    EquipoViewSet,
    JugadorViewSet,
)


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
