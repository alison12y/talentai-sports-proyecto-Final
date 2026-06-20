from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, override_settings
from django.urls import resolve
from rest_framework.test import APIRequestFactory

from payments.models import PlanSaaS

from .serializers import OnboardingCompleteSerializer
from .views import LoginView, OnboardingCompleteView, RECOVERY_MESSAGE, RecoverPasswordView


def onboarding_payload():
    return {
        'admin': {
            'nombre': 'Yesenia',
            'apellido': 'Prueba',
            'telefono': '70000001',
            'correo': 'ADMIN@CLUBPRUEBA.COM',
            'password': 'admin123',
        },
        'club': {
            'nombre': 'Club Onboarding Test 01',
            'ciudad': 'Santa Cruz',
            'telefono': '70000002',
            'correo': 'contacto@clubprueba.com',
            'direccion': 'Av. Prueba 123',
        },
        'plan_id': 2,
    }


class OnboardingCompleteSerializerTests(SimpleTestCase):
    def test_onboarding_crea_usuario_club_relacion_plan_y_permite_login(self):
        plan = SimpleNamespace(pk=2, activo=True, codigo='PRO')
        usuario = SimpleNamespace(
            id='user-id',
            email='admin@clubprueba.com',
            password_hash='admin123',
            nombre='Yesenia',
            apellido='Prueba',
            activo=True,
            ultimo_acceso=None,
            save=MagicMock(),
        )
        club = SimpleNamespace(id='club-id', pk='club-id', plan='BASICO')
        suscripcion = SimpleNamespace(plan=plan)

        with (
            patch('users.serializers.Usuario.objects.filter') as user_filter,
            patch('users.serializers.Club.objects.filter') as club_filter,
            patch('users.serializers.PlanSaaS.objects.get', return_value=plan),
            patch('users.serializers.Usuario.objects.create', return_value=usuario) as user_create,
            patch('users.serializers.UsuarioClub.objects.create') as relation_create,
            patch('users.serializers.ClubSerializer') as club_serializer_class,
            patch('users.serializers.SeleccionarPlanSaaSSerializer') as plan_serializer_class,
            patch('users.serializers.transaction.atomic') as atomic_mock,
        ):
            user_filter.return_value.exists.return_value = False
            club_filter.return_value.exists.return_value = False
            club_serializer_class.return_value.save.return_value = club
            plan_serializer_class.return_value.save.return_value = suscripcion
            serializer = OnboardingCompleteSerializer(data=onboarding_payload())

            self.assertTrue(serializer.is_valid(), serializer.errors)
            result = serializer.save()

            self.assertIs(result['usuario'], usuario)
            self.assertIs(result['club'], club)
            self.assertIs(result['plan'], plan)
            self.assertEqual(user_create.call_args.kwargs['password_hash'], 'admin123')
            self.assertEqual(user_create.call_args.kwargs['email'], 'admin@clubprueba.com')
            self.assertEqual(relation_create.call_args.kwargs['rol'], 'COORDINADOR')
            self.assertEqual(relation_create.call_args.kwargs['estado'], 'ACTIVO')
            plan_serializer_class.assert_called_once_with(data={'plan_id': 2})
            plan_serializer_class.return_value.save.assert_called_once_with(club=club)
            atomic_mock.assert_called_once_with()

        request = APIRequestFactory().post(
            '/api/auth/login/',
            {'email': 'ADMIN@CLUBPRUEBA.COM', 'password': 'admin123'},
            format='json',
        )
        with patch('users.views.Usuario.objects.get', return_value=usuario) as get_user:
            response = LoginView.as_view()(request)

        get_user.assert_called_once_with(email='admin@clubprueba.com')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['user']['email'], 'admin@clubprueba.com')

    def test_rechaza_correo_de_usuario_duplicado(self):
        plan = SimpleNamespace(pk=2, activo=True)
        with (
            patch('users.serializers.Usuario.objects.filter') as user_filter,
            patch('users.serializers.Club.objects.filter') as club_filter,
            patch('users.serializers.PlanSaaS.objects.get', return_value=plan),
        ):
            user_filter.return_value.exists.return_value = True
            club_filter.return_value.exists.return_value = False
            serializer = OnboardingCompleteSerializer(data=onboarding_payload())

            self.assertFalse(serializer.is_valid())
            self.assertEqual(
                str(serializer.errors['admin']['correo'][0]),
                'Ya existe un usuario con ese correo',
            )

    def test_rechaza_nombre_de_club_duplicado(self):
        plan = SimpleNamespace(pk=2, activo=True)
        with (
            patch('users.serializers.Usuario.objects.filter') as user_filter,
            patch('users.serializers.Club.objects.filter') as club_filter,
            patch('users.serializers.PlanSaaS.objects.get', return_value=plan),
        ):
            user_filter.return_value.exists.return_value = False
            club_filter.return_value.exists.return_value = True
            serializer = OnboardingCompleteSerializer(data=onboarding_payload())

            self.assertFalse(serializer.is_valid())
            self.assertEqual(
                str(serializer.errors['club']['nombre'][0]),
                'Ya existe un club registrado con ese nombre',
            )

    def test_rechaza_plan_inexistente(self):
        with (
            patch('users.serializers.Usuario.objects.filter') as user_filter,
            patch('users.serializers.Club.objects.filter') as club_filter,
            patch(
                'users.serializers.PlanSaaS.objects.get',
                side_effect=PlanSaaS.DoesNotExist,
            ),
        ):
            user_filter.return_value.exists.return_value = False
            club_filter.return_value.exists.return_value = False
            serializer = OnboardingCompleteSerializer(data=onboarding_payload())

            self.assertFalse(serializer.is_valid())
            self.assertEqual(
                str(serializer.errors['plan_id'][0]),
                'El plan seleccionado no existe',
            )

    def test_rechaza_plan_inactivo(self):
        plan = SimpleNamespace(pk=2, activo=False)
        with (
            patch('users.serializers.Usuario.objects.filter') as user_filter,
            patch('users.serializers.Club.objects.filter') as club_filter,
            patch('users.serializers.PlanSaaS.objects.get', return_value=plan),
        ):
            user_filter.return_value.exists.return_value = False
            club_filter.return_value.exists.return_value = False
            serializer = OnboardingCompleteSerializer(data=onboarding_payload())

            self.assertFalse(serializer.is_valid())
            self.assertEqual(
                str(serializer.errors['plan_id'][0]),
                'El plan seleccionado no está activo',
            )

    def test_rechaza_password_admin_y_password_corta(self):
        plan = SimpleNamespace(pk=2, activo=True)
        with (
            patch('users.serializers.Usuario.objects.filter') as user_filter,
            patch('users.serializers.Club.objects.filter') as club_filter,
            patch('users.serializers.PlanSaaS.objects.get', return_value=plan),
        ):
            user_filter.return_value.exists.return_value = False
            club_filter.return_value.exists.return_value = False
            admin_payload = onboarding_payload()
            admin_payload['admin']['password'] = 'admin'
            admin_serializer = OnboardingCompleteSerializer(data=admin_payload)
            short_payload = onboarding_payload()
            short_payload['admin']['password'] = '12345'
            short_serializer = OnboardingCompleteSerializer(data=short_payload)

            self.assertFalse(admin_serializer.is_valid())
            self.assertFalse(short_serializer.is_valid())
            self.assertEqual(
                str(short_serializer.errors['admin']['password'][0]),
                'La contraseña debe tener al menos 6 caracteres',
            )

    def test_fallo_de_plan_sale_de_la_transaccion_con_error(self):
        plan = SimpleNamespace(pk=2, activo=True, codigo='PRO')
        usuario = SimpleNamespace(id='user-id')
        club = SimpleNamespace(id='club-id', pk='club-id')
        atomic_context = MagicMock()

        with (
            patch('users.serializers.Usuario.objects.filter') as user_filter,
            patch('users.serializers.Club.objects.filter') as club_filter,
            patch('users.serializers.PlanSaaS.objects.get', return_value=plan),
            patch('users.serializers.Usuario.objects.create', return_value=usuario),
            patch('users.serializers.UsuarioClub.objects.create'),
            patch('users.serializers.ClubSerializer') as club_serializer_class,
            patch('users.serializers.SeleccionarPlanSaaSSerializer') as plan_serializer_class,
            patch('users.serializers.transaction.atomic', return_value=atomic_context),
        ):
            user_filter.return_value.exists.return_value = False
            club_filter.return_value.exists.return_value = False
            club_serializer_class.return_value.save.return_value = club
            plan_serializer_class.return_value.save.side_effect = RuntimeError('plan failure')
            serializer = OnboardingCompleteSerializer(data=onboarding_payload())

            self.assertTrue(serializer.is_valid(), serializer.errors)
            with self.assertRaisesRegex(RuntimeError, 'plan failure'):
                serializer.save()

        exit_exception = atomic_context.__exit__.call_args.args[0]
        self.assertIs(exit_exception, RuntimeError)

    def test_ruta_de_onboarding_esta_registrada(self):
        match = resolve('/api/auth/onboarding-complete/')

        self.assertEqual(match.view_name, 'auth-onboarding-complete')


class OnboardingCompleteViewTests(SimpleTestCase):
    @patch('users.views.PlanSaaSSerializer')
    @patch('users.views.ClubSerializer')
    @patch('users.views.OnboardingUsuarioResponseSerializer')
    @patch('users.views.OnboardingCompleteSerializer')
    def test_respuesta_exitosa_no_expone_password(
        self,
        onboarding_serializer_mock,
        user_serializer_mock,
        club_serializer_mock,
        plan_serializer_mock,
    ):
        onboarding_serializer_mock.return_value.save.return_value = {
            'usuario': SimpleNamespace(),
            'club': SimpleNamespace(),
            'plan': SimpleNamespace(),
        }
        user_serializer_mock.return_value.data = {
            'id': 'user-id',
            'email': 'admin@clubprueba.com',
            'nombre': 'Yesenia',
        }
        club_serializer_mock.return_value.data = {'id': 'club-id'}
        plan_serializer_mock.return_value.data = {'id': 2, 'nombre': 'Pro'}
        request = APIRequestFactory().post(
            '/api/auth/onboarding-complete/',
            onboarding_payload(),
            format='json',
        )

        response = OnboardingCompleteView.as_view()(request)

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['message'], 'Configuración completada correctamente')
        self.assertNotIn('password', response.data['usuario'])
        self.assertNotIn('password_hash', response.data['usuario'])


class RecoverPasswordViewTests(SimpleTestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.url = '/api/auth/recover-password/'

    @patch('users.views.Usuario.objects.filter')
    def test_unknown_email_returns_safe_response(self, filter_mock):
        filter_mock.return_value.first.return_value = None

        request = self.factory.post(self.url, {'email': 'unknown@example.com'}, format='json')
        response = RecoverPasswordView.as_view()(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {'message': RECOVERY_MESSAGE})

    @patch.object(RecoverPasswordView, '_create_token_and_send_email')
    @patch('users.views.Usuario.objects.filter')
    def test_known_email_returns_the_same_safe_response(self, filter_mock, send_mock):
        user = MagicMock()
        filter_mock.return_value.first.return_value = user

        request = self.factory.post(self.url, {'email': 'known@example.com'}, format='json')
        response = RecoverPasswordView.as_view()(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {'message': RECOVERY_MESSAGE})
        send_mock.assert_called_once_with(user)

    @override_settings(
        EMAIL_HOST='smtp.example.com',
        EMAIL_HOST_USER='sender@example.com',
        EMAIL_HOST_PASSWORD='secret',
        DEFAULT_FROM_EMAIL='TalentAI Sports <sender@example.com>',
        FRONTEND_URL='http://localhost:5173',
        PASSWORD_RESET_TOKEN_TTL_MINUTES=60,
    )
    @patch('users.views.send_mail')
    @patch('users.views.PasswordResetToken.objects')
    def test_email_contains_reset_link_and_only_token_hash_is_stored(self, token_manager, send_mail_mock):
        user = MagicMock(pk='user-id', nombre='Alex', email='alex@example.com')

        RecoverPasswordView._create_token_and_send_email(user)

        stored_token = token_manager.create.call_args.kwargs['token']
        sent_message = send_mail_mock.call_args.kwargs['message']
        self.assertEqual(len(stored_token), 64)
        self.assertIn('http://localhost:5173/reset-password?token=', sent_message)
        self.assertNotIn(stored_token, sent_message)
        self.assertIn('Si no solicitaste este cambio', sent_message)

    @override_settings(
        EMAIL_HOST='smtp.example.com',
        EMAIL_HOST_USER='sender@example.com',
        EMAIL_HOST_PASSWORD='secret',
        FRONTEND_URL='http://localhost:5173',
        PASSWORD_RESET_TOKEN_TTL_MINUTES=60,
    )
    @patch('users.views.logger.exception')
    @patch('users.views.send_mail', side_effect=OSError('SMTP unavailable'))
    @patch('users.views.PasswordResetToken.objects')
    def test_smtp_failure_is_logged_and_not_raised(self, _token_manager, _send_mail, log_mock):
        user = MagicMock(pk='user-id', nombre='Alex', email='alex@example.com')

        RecoverPasswordView._create_token_and_send_email(user)

        log_mock.assert_called_once()
