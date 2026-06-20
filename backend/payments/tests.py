from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase
from django.urls import resolve
from rest_framework.test import APIRequestFactory

from clubs.views import ClubViewSet

from .models import ClubPlan, PlanSaaS
from .serializers import SeleccionarPlanSaaSSerializer
from .views import PlanSaaSViewSet


def build_plan(**overrides):
    values = {
        'id': 1,
        'codigo': 'BASICO',
        'nombre': 'Básico',
        'descripcion': 'Para clubes pequeños.',
        'precio_mensual': '49.00',
        'limite_jugadores': 50,
        'limite_equipos': 3,
        'incluye_ia': False,
        'incluye_reportes': True,
        'soporte': 'Estándar',
        'caracteristicas': ['Reportes básicos'],
        'activo': True,
    }
    values.update(overrides)
    return PlanSaaS(**values)


class PlanSaaSViewSetTests(SimpleTestCase):
    @patch('payments.views.PlanSaaS.objects.filter')
    def test_listar_planes_filtra_solo_activos(self, filter_mock):
        ordered_queryset = MagicMock()
        filter_mock.return_value.order_by.return_value = ordered_queryset

        queryset = PlanSaaSViewSet().get_queryset()

        filter_mock.assert_called_once_with(activo=True)
        filter_mock.return_value.order_by.assert_called_once_with('precio_mensual', 'id')
        self.assertIs(queryset, ordered_queryset)

    def test_ver_detalle_de_plan_muestra_caracteristicas(self):
        request = APIRequestFactory().get('/api/planes/1/')

        with patch.object(PlanSaaSViewSet, 'get_object', return_value=build_plan()):
            response = PlanSaaSViewSet.as_view({'get': 'retrieve'})(request, pk='1')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['nombre'], 'Básico')
        self.assertEqual(response.data['caracteristicas'], ['Reportes básicos'])
        self.assertEqual(resolve('/api/planes/1/').view_name, 'plan-saas-detail')


class SeleccionarPlanSaaSSerializerTests(SimpleTestCase):
    @patch('payments.serializers.PlanSaaS.objects.get')
    def test_rechaza_plan_inexistente(self, get_mock):
        get_mock.side_effect = PlanSaaS.DoesNotExist
        serializer = SeleccionarPlanSaaSSerializer(data={'plan_id': 999})

        self.assertFalse(serializer.is_valid())
        self.assertEqual(
            str(serializer.errors['plan_id'][0]),
            'El plan seleccionado no existe.',
        )

    @patch('payments.serializers.PlanSaaS.objects.get')
    def test_rechaza_plan_inactivo(self, get_mock):
        get_mock.return_value = build_plan(activo=False)
        serializer = SeleccionarPlanSaaSSerializer(data={'plan_id': 1})

        self.assertFalse(serializer.is_valid())
        self.assertEqual(
            str(serializer.errors['plan_id'][0]),
            'El plan seleccionado no está activo.',
        )

    @patch('payments.serializers.transaction.atomic')
    @patch('payments.serializers.Club.objects.filter')
    @patch('payments.serializers.ClubPlan.objects.create')
    @patch('payments.serializers.ClubPlan.objects.filter')
    @patch('payments.serializers.PlanSaaS.objects.get')
    def test_selecciona_plan_y_desactiva_el_anterior(
        self,
        get_plan_mock,
        filter_subscription_mock,
        create_subscription_mock,
        filter_club_mock,
        atomic_mock,
    ):
        plan = build_plan(id=2, codigo='PRO', nombre='Pro')
        club = SimpleNamespace(pk='club-id', plan='BASICO', actualizado_en=None)
        subscription = SimpleNamespace(plan=plan)
        previous_queryset = filter_subscription_mock.return_value
        create_subscription_mock.return_value = subscription
        get_plan_mock.return_value = plan
        serializer = SeleccionarPlanSaaSSerializer(data={'plan_id': 2})

        self.assertTrue(serializer.is_valid(), serializer.errors)
        result = serializer.save(club=club)

        self.assertIs(result, subscription)
        previous_queryset.update.assert_called_once()
        update_values = previous_queryset.update.call_args.kwargs
        self.assertFalse(update_values['activo'])
        self.assertEqual(update_values['estado'], ClubPlan.Estado.CANCELADA)
        create_subscription_mock.assert_called_once()
        self.assertTrue(create_subscription_mock.call_args.kwargs['activo'])
        self.assertEqual(club.plan, 'PRO')
        filter_club_mock.assert_called_once_with(pk='club-id')
        atomic_mock.assert_called_once_with()


class ClubPlanActionsTests(SimpleTestCase):
    @patch('clubs.views.ClubPlanSerializer')
    @patch('clubs.views.PlanSaaSSerializer')
    @patch('clubs.views.ClubSerializer')
    @patch('clubs.views.SeleccionarPlanSaaSSerializer')
    def test_seleccionar_plan_devuelve_confirmacion(
        self,
        selection_serializer_mock,
        club_serializer_mock,
        plan_serializer_mock,
        subscription_serializer_mock,
    ):
        club = SimpleNamespace(pk='club-id')
        plan = build_plan(id=2, codigo='PRO', nombre='Pro')
        subscription = SimpleNamespace(plan=plan)
        selection_serializer_mock.return_value.save.return_value = subscription
        club_serializer_mock.return_value.data = {'id': 'club-id', 'plan': 'PRO'}
        plan_serializer_mock.return_value.data = {'id': 2, 'nombre': 'Pro'}
        subscription_serializer_mock.return_value.data = {'id': 10, 'activo': True}
        view = ClubViewSet()
        view.get_object = MagicMock(return_value=club)
        request = MagicMock(data={'plan_id': 2})

        response = view.seleccionar_plan(request, pk='club-id')

        selection_serializer_mock.assert_called_once_with(data={'plan_id': 2})
        selection_serializer_mock.return_value.is_valid.assert_called_once_with(
            raise_exception=True,
        )
        selection_serializer_mock.return_value.save.assert_called_once_with(club=club)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['message'], 'Plan seleccionado correctamente')
        self.assertEqual(response.data['plan']['nombre'], 'Pro')

    @patch('clubs.views.ClubPlanSerializer')
    @patch('clubs.views.PlanSaaSSerializer')
    @patch('clubs.views.ClubPlan.objects.filter')
    def test_plan_actual_devuelve_suscripcion_activa(
        self,
        filter_mock,
        plan_serializer_mock,
        subscription_serializer_mock,
    ):
        club = SimpleNamespace(pk='club-id')
        plan = build_plan(id=2, codigo='PRO', nombre='Pro')
        subscription = SimpleNamespace(plan=plan)
        filter_mock.return_value.select_related.return_value.first.return_value = subscription
        plan_serializer_mock.return_value.data = {'id': 2, 'nombre': 'Pro'}
        subscription_serializer_mock.return_value.data = {'id': 10, 'activo': True}
        view = ClubViewSet()
        view.get_object = MagicMock(return_value=club)

        response = view.plan_actual(MagicMock(), pk='club-id')

        filter_mock.assert_called_once_with(club=club, activo=True)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['plan']['nombre'], 'Pro')
        self.assertTrue(response.data['suscripcion']['activo'])
