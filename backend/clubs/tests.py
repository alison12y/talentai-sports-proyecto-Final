from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase
from .serializers import ClubConfigSerializer, ClubSerializer
from .views import ClubViewSet


class ClubSerializerTests(SimpleTestCase):
    @patch('clubs.serializers.Club.objects.create')
    @patch('clubs.serializers.Club.objects.filter')
    def test_creates_valid_club_with_generated_slug(self, filter_mock, create_mock):
        filter_mock.return_value.exists.return_value = False
        created_club = MagicMock()
        create_mock.return_value = created_club
        serializer = ClubSerializer(data={
            'nombre': 'Academia Central',
            'email_contacto': 'CONTACTO@CENTRAL.COM',
        })

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertIs(serializer.save(), created_club)
        create_kwargs = create_mock.call_args.kwargs
        self.assertEqual(create_kwargs['slug'], 'academia-central')
        self.assertEqual(create_kwargs['email_contacto'], 'contacto@central.com')
        self.assertTrue(create_kwargs['activo'])

    @patch('clubs.serializers.Club.objects.filter')
    def test_requires_name_and_contact_email(self, filter_mock):
        filter_mock.return_value.exists.return_value = False
        serializer = ClubSerializer(data={'nombre': '', 'email_contacto': ''})

        self.assertFalse(serializer.is_valid())
        self.assertIn('nombre', serializer.errors)
        self.assertIn('email_contacto', serializer.errors)

    @patch('clubs.serializers.Club.objects.filter')
    def test_rejects_duplicate_name_ignoring_case(self, filter_mock):
        filter_mock.return_value.exists.return_value = True
        serializer = ClubSerializer(data={
            'nombre': 'Academia Oriente',
            'email_contacto': 'contacto@oriente.com',
        })

        self.assertFalse(serializer.is_valid())
        self.assertEqual(
            str(serializer.errors['nombre'][0]),
            'Ya existe un club registrado con ese nombre.',
        )

    @patch('clubs.serializers.Club.objects.filter')
    def test_rejects_invalid_email(self, filter_mock):
        filter_mock.return_value.exists.return_value = False
        serializer = ClubSerializer(data={
            'nombre': 'Academia Norte',
            'email_contacto': 'correo-invalido',
        })

        self.assertFalse(serializer.is_valid())
        self.assertIn('email_contacto', serializer.errors)


class ClubViewSetTests(SimpleTestCase):
    @patch('clubs.views.ClubSerializer')
    def test_desactivar_keeps_club_and_sets_inactive(self, serializer_mock):
        club = SimpleNamespace(activo=True, actualizado_en=None, save=MagicMock())
        serializer_mock.return_value.data = {'id': 'club-id', 'activo': False}
        view = ClubViewSet()
        view.get_object = MagicMock(return_value=club)

        response = view.desactivar(MagicMock())

        self.assertEqual(response.status_code, 200)
        self.assertFalse(club.activo)
        club.save.assert_called_once_with(update_fields=['activo', 'actualizado_en'])

    @patch('clubs.views.ClubSerializer')
    def test_activar_sets_club_active(self, serializer_mock):
        club = SimpleNamespace(activo=False, actualizado_en=None, save=MagicMock())
        serializer_mock.return_value.data = {'id': 'club-id', 'activo': True}
        view = ClubViewSet()
        view.get_object = MagicMock(return_value=club)

        response = view.activar(MagicMock())

        self.assertEqual(response.status_code, 200)
        self.assertTrue(club.activo)
        club.save.assert_called_once_with(update_fields=['activo', 'actualizado_en'])

    def test_destroy_deletes_club(self):
        club = SimpleNamespace(delete=MagicMock())
        view = ClubViewSet()
        view.get_object = MagicMock(return_value=club)

        response = view.destroy(MagicMock())

        self.assertEqual(response.status_code, 204)
        club.delete.assert_called_once_with()

    @patch('clubs.views.ClubSerializer')
    @patch('clubs.views.ClubConfigSerializer')
    def test_configurar_updates_and_returns_club(self, config_serializer_mock, club_serializer_mock):
        club = SimpleNamespace(id='club-id', nombre='Academia Central')
        config_serializer = config_serializer_mock.return_value
        club_serializer_mock.return_value.data = {
            'id': 'club-id',
            'nombre': 'Academia Renovada',
        }
        view = ClubViewSet()
        view.get_object = MagicMock(return_value=club)
        request = MagicMock(data={'nombre': 'Academia Renovada'})

        response = view.configurar(request, pk='club-id')

        config_serializer_mock.assert_called_once_with(
            club,
            data={'nombre': 'Academia Renovada'},
            partial=True,
        )
        config_serializer.is_valid.assert_called_once_with(raise_exception=True)
        config_serializer.save.assert_called_once_with()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['nombre'], 'Academia Renovada')


class ClubConfigSerializerTests(SimpleTestCase):
    def test_requires_name_and_contact_email(self):
        serializer = ClubConfigSerializer(data={'nombre': '', 'email_contacto': ''})

        self.assertFalse(serializer.is_valid())
        self.assertIn('nombre', serializer.errors)
        self.assertIn('email_contacto', serializer.errors)

    @patch('clubs.serializers.Club.objects.filter')
    def test_rejects_invalid_contact_email(self, filter_mock):
        filter_mock.return_value.exists.return_value = False
        serializer = ClubConfigSerializer(data={
            'nombre': 'Academia Central',
            'email_contacto': 'correo-invalido',
        })

        self.assertFalse(serializer.is_valid())
        self.assertIn('email_contacto', serializer.errors)

    @patch('clubs.serializers.Club.objects.filter')
    def test_rejects_duplicate_name_from_another_club(self, filter_mock):
        filter_mock.return_value.exclude.return_value.exists.return_value = True
        instance = SimpleNamespace(pk='club-id', nombre='Academia Central')
        serializer = ClubConfigSerializer(
            instance,
            data={
                'nombre': 'ACADEMIA ORIENTE',
                'email_contacto': 'contacto@central.com',
            },
            partial=True,
        )

        self.assertFalse(serializer.is_valid())
        self.assertEqual(
            str(serializer.errors['nombre'][0]),
            'Ya existe un club registrado con ese nombre.',
        )

    @patch('clubs.serializers.Club.objects.filter')
    def test_rejects_logo_url_that_is_not_an_image(self, filter_mock):
        filter_mock.return_value.exists.return_value = False
        serializer = ClubConfigSerializer(data={
            'nombre': 'Academia Central',
            'email_contacto': 'contacto@central.com',
            'logo_url': 'https://example.com/documento.pdf',
        })

        self.assertFalse(serializer.is_valid())
        self.assertIn('logo_url', serializer.errors)

    @patch('clubs.serializers.Club.objects.filter')
    def test_accepts_image_extension_in_logo_url_query(self, filter_mock):
        filter_mock.return_value.exists.return_value = False
        serializer = ClubConfigSerializer(data={
            'nombre': 'Academia Central',
            'email_contacto': 'contacto@central.com',
            'logo_url': 'https://example.com/logo?format=club.png',
        })

        self.assertTrue(serializer.is_valid(), serializer.errors)

    @patch('clubs.serializers.ClubSerializer._available_slug', return_value='academia-renovada')
    @patch('clubs.serializers.Club.objects.filter')
    def test_updates_slug_when_name_changes(self, filter_mock, slug_mock):
        filter_mock.return_value.exclude.return_value.exists.return_value = False
        instance = MagicMock(
            pk='club-id',
            nombre='Academia Anterior',
            email_contacto='contacto@club.com',
        )
        serializer = ClubConfigSerializer(
            instance,
            data={
                'nombre': 'Academia Renovada',
                'email_contacto': 'contacto@club.com',
            },
            partial=True,
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        with patch(
            'rest_framework.serializers.ModelSerializer.update',
            return_value=instance,
        ):
            serializer.update(instance, serializer.validated_data)
        slug_mock.assert_called_once_with('Academia Renovada', instance)
