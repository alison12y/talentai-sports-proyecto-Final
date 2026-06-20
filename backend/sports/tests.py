from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase
from rest_framework.test import APIRequestFactory

from .serializers import CategoriaDeportivaSerializer
from .views import (
    CATEGORIAS_PREDEFINIDAS,
    CategoriaClubListCreateView,
    CategoriaDeportivaViewSet,
    CategoriaPredefinidasView,
)


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
