import uuid
from datetime import date
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, override_settings
from django.urls import resolve
from django.utils import timezone
from django.contrib.auth.hashers import check_password, make_password
from rest_framework.test import APIRequestFactory

from payments.models import PlanSaaS

from .models import EstadoUsuarioClub, RolUsuario, Usuario, UsuarioClub
from .management.commands.seed_data import Command as SeedDataCommand
from .serializers import OnboardingCompleteSerializer
from .views import (
    LoginView,
    OnboardingCompleteView,
    RECOVERY_MESSAGE,
    RecoverPasswordView,
    UsuarioViewSet,
    UsuarioClubViewSet,
)


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


class UsuarioPublicApiTests(SimpleTestCase):
    def setUp(self):
        now = timezone.now()
        self.usuario = Usuario(
            id=uuid.uuid4(),
            email='usuario@example.com',
            password_hash='secreto-no-publico',
            nombre='Ana',
            apellido='Pérez',
            telefono='70000000',
            avatar_url='https://example.com/avatar.png',
            fecha_nacimiento=date(1990, 1, 1),
            activo=True,
            email_verificado=True,
            firebase_token='token-no-publico',
            ultimo_acceso=now,
            creado_en=now,
            actualizado_en=now,
        )

    def get_response_data(self):
        request = APIRequestFactory().get('/api/usuarios/')
        with patch.object(
            UsuarioViewSet,
            'get_queryset',
            return_value=[self.usuario],
        ):
            response = UsuarioViewSet.as_view({'get': 'list'})(request)
        self.assertEqual(response.status_code, 200)
        return response.data[0]

    def test_get_usuarios_no_expone_password_hash(self):
        self.assertNotIn('password_hash', self.get_response_data())

    def test_get_usuarios_no_expone_firebase_token(self):
        self.assertNotIn('firebase_token', self.get_response_data())


class UsuarioManagementApiTests(SimpleTestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.now = timezone.now()

    def build_user(self, **overrides):
        values = {
            'id': uuid.uuid4(),
            'email': 'nuevo@example.com',
            'password_hash': make_password('Secreta123'),
            'nombre': 'Nuevo',
            'apellido': 'Usuario',
            'telefono': '70000000',
            'avatar_url': None,
            'fecha_nacimiento': date(2000, 1, 1),
            'activo': True,
            'email_verificado': False,
            'ultimo_acceso': None,
            'creado_en': self.now,
            'actualizado_en': self.now,
            'save': MagicMock(),
            'delete': MagicMock(),
        }
        values.update(overrides)
        return SimpleNamespace(**values)

    def create_payload(self, **overrides):
        payload = {
            'email': 'nuevo@example.com',
            'password': 'Secreta123',
            'nombre': 'Nuevo',
            'apellido': 'Usuario',
            'telefono': '70000000',
            'fecha_nacimiento': '2000-01-01',
        }
        payload.update(overrides)
        return payload

    @patch('users.serializers.Usuario.objects.create')
    @patch('users.serializers.Usuario.objects.filter')
    def test_crear_usuario_guarda_password_con_hash(self, filter_mock, create_mock):
        filter_mock.return_value.exists.return_value = False
        create_mock.return_value = self.build_user()
        request = self.factory.post(
            '/api/usuarios/',
            self.create_payload(),
            format='json',
        )

        response = UsuarioViewSet.as_view({'post': 'create'})(request)

        self.assertEqual(response.status_code, 201)
        stored_password = create_mock.call_args.kwargs['password_hash']
        self.assertNotEqual(stored_password, 'Secreta123')
        self.assertTrue(check_password('Secreta123', stored_password))
        self.assertNotIn('password_hash', response.data)
        self.assertNotIn('firebase_token', response.data)

    @patch('users.serializers.Usuario.objects.filter')
    def test_crear_usuario_con_email_duplicado_devuelve_400(self, filter_mock):
        filter_mock.return_value.exists.return_value = True
        request = self.factory.post(
            '/api/usuarios/',
            self.create_payload(),
            format='json',
        )

        response = UsuarioViewSet.as_view({'post': 'create'})(request)

        self.assertEqual(response.status_code, 400)
        self.assertIn('email', response.data)

    def test_crear_usuario_sin_email_devuelve_400(self):
        payload = self.create_payload()
        payload.pop('email')
        request = self.factory.post('/api/usuarios/', payload, format='json')

        response = UsuarioViewSet.as_view({'post': 'create'})(request)

        self.assertEqual(response.status_code, 400)
        self.assertIn('email', response.data)

    def test_crear_usuario_sin_nombre_devuelve_400(self):
        payload = self.create_payload()
        payload.pop('nombre')
        request = self.factory.post('/api/usuarios/', payload, format='json')

        with patch('users.serializers.Usuario.objects.filter') as filter_mock:
            filter_mock.return_value.exists.return_value = False
            response = UsuarioViewSet.as_view({'post': 'create'})(request)

        self.assertEqual(response.status_code, 400)
        self.assertIn('nombre', response.data)

    def test_crear_usuario_sin_password_devuelve_400(self):
        payload = self.create_payload()
        payload.pop('password')
        request = self.factory.post('/api/usuarios/', payload, format='json')

        with patch('users.serializers.Usuario.objects.filter') as filter_mock:
            filter_mock.return_value.exists.return_value = False
            response = UsuarioViewSet.as_view({'post': 'create'})(request)

        self.assertEqual(response.status_code, 400)
        self.assertIn('password', response.data)

    def test_editar_usuario_no_cambia_password(self):
        original_hash = make_password('Original123')
        user = Usuario(
            id=uuid.uuid4(),
            email='nuevo@example.com',
            password_hash=original_hash,
            nombre='Nuevo',
            apellido='Usuario',
            telefono='70000000',
            avatar_url=None,
            fecha_nacimiento=date(2000, 1, 1),
            activo=True,
            email_verificado=False,
            ultimo_acceso=None,
            creado_en=self.now,
            actualizado_en=self.now,
        )
        user.save = MagicMock()
        request = self.factory.patch(
            f'/api/usuarios/{user.id}/',
            {'nombre': 'Actualizado'},
            format='json',
        )

        with patch.object(UsuarioViewSet, 'get_object', return_value=user):
            response = UsuarioViewSet.as_view({'patch': 'partial_update'})(
                request,
                pk=str(user.id),
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(user.password_hash, original_hash)
        self.assertEqual(user.nombre, 'Actualizado')

    def test_edicion_rechaza_password_fuera_del_endpoint_dedicado(self):
        user = self.build_user()
        request = self.factory.patch(
            f'/api/usuarios/{user.id}/',
            {'password': 'NoPermitida123'},
            format='json',
        )

        with patch.object(UsuarioViewSet, 'get_object', return_value=user):
            response = UsuarioViewSet.as_view({'patch': 'partial_update'})(
                request,
                pk=str(user.id),
            )

        self.assertEqual(response.status_code, 400)
        self.assertIn('password', response.data)

    def test_activar_usuario(self):
        user = self.build_user(activo=False)
        request = self.factory.patch(
            f'/api/usuarios/{user.id}/activar/',
            {},
            format='json',
        )

        with patch.object(UsuarioViewSet, 'get_object', return_value=user):
            response = UsuarioViewSet.as_view({'patch': 'activar'})(
                request,
                pk=str(user.id),
            )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(user.activo)
        user.save.assert_called_once_with(update_fields=['activo', 'actualizado_en'])

    def test_desactivar_usuario(self):
        user = self.build_user(activo=True)
        request = self.factory.patch(
            f'/api/usuarios/{user.id}/desactivar/',
            {},
            format='json',
        )

        with patch.object(UsuarioViewSet, 'get_object', return_value=user):
            response = UsuarioViewSet.as_view({'patch': 'desactivar'})(
                request,
                pk=str(user.id),
            )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(user.activo)
        user.save.assert_called_once_with(update_fields=['activo', 'actualizado_en'])

    def test_cambiar_password_guarda_hash_verificable(self):
        user = self.build_user(password_hash=make_password('Anterior123'))
        request = self.factory.patch(
            f'/api/usuarios/{user.id}/cambiar-password/',
            {'password': 'NuevaSecreta123'},
            format='json',
        )

        with patch.object(UsuarioViewSet, 'get_object', return_value=user):
            response = UsuarioViewSet.as_view({'patch': 'cambiar_password'})(
                request,
                pk=str(user.id),
            )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(check_password('NuevaSecreta123', user.password_hash))
        user.save.assert_called_once_with(
            update_fields=['password_hash', 'actualizado_en'],
        )

    def test_delete_desactiva_sin_borrar_fisicamente(self):
        user = self.build_user(activo=True)
        request = self.factory.delete(f'/api/usuarios/{user.id}/')

        with patch.object(UsuarioViewSet, 'get_object', return_value=user):
            response = UsuarioViewSet.as_view({'delete': 'destroy'})(
                request,
                pk=str(user.id),
            )

        self.assertEqual(response.status_code, 204)
        self.assertFalse(user.activo)
        user.delete.assert_not_called()


class RolUsuarioTests(SimpleTestCase):
    def test_roles_validos_coinciden_con_enum_postgresql(self):
        self.assertEqual(
            set(RolUsuario.values),
            {'COORDINADOR', 'ENTRENADOR', 'PADRE', 'JUGADOR'},
        )

    def test_administrador_no_es_rol_valido(self):
        self.assertNotIn('ADMINISTRADOR', RolUsuario.values)

    def test_tutor_no_es_rol_valido(self):
        self.assertNotIn('TUTOR', RolUsuario.values)


class EstadoUsuarioClubTests(SimpleTestCase):
    def test_estados_validos(self):
        self.assertEqual(EstadoUsuarioClub.values, ['ACTIVO', 'INACTIVO'])


class PasswordTransitionTests(SimpleTestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

    def build_user(self, password_hash, *, activo=True):
        return SimpleNamespace(
            id=uuid.uuid4(),
            email='usuario@example.com',
            password_hash=password_hash,
            nombre='Ana',
            apellido='Pérez',
            activo=activo,
            ultimo_acceso=None,
            save=MagicMock(),
        )

    def login(self, password, user=None, error=None, memberships=None):
        request = self.factory.post(
            '/api/auth/login/',
            {'email': 'usuario@example.com', 'password': password},
            format='json',
        )
        get_result = patch(
            'users.views.Usuario.objects.get',
            return_value=user,
            side_effect=error,
        )
        with (
            get_result,
            patch('users.views.UsuarioClub.objects.filter') as filter_mock,
        ):
            filter_mock.return_value.select_related.return_value.order_by.return_value = (
                memberships or []
            )
            response = LoginView.as_view()(request)
        self.membership_filter_mock = filter_mock
        return response

    def test_login_correcto_con_hash_django(self):
        user = self.build_user(make_password('clave-segura'))

        response = self.login('clave-segura', user=user)

        self.assertEqual(response.status_code, 200)
        user.save.assert_called_once_with(update_fields=['ultimo_acceso'])

    def test_login_exitoso_devuelve_memberships_activas(self):
        user = self.build_user(make_password('clave-segura'))
        club = SimpleNamespace(id=uuid.uuid4(), nombre='Club Central')
        membership = SimpleNamespace(
            club=club,
            rol=RolUsuario.COORDINADOR,
            estado=EstadoUsuarioClub.ACTIVO,
        )

        response = self.login(
            'clave-segura',
            user=user,
            memberships=[membership],
        )

        self.assertEqual(response.data['memberships'], [{
            'club': {'id': str(club.id), 'nombre': 'Club Central'},
            'rol': RolUsuario.COORDINADOR,
            'estado': EstadoUsuarioClub.ACTIVO,
        }])
        self.membership_filter_mock.assert_called_once_with(
            usuario=user,
            estado=EstadoUsuarioClub.ACTIVO,
            rol__in=RolUsuario.values,
        )

    def test_login_sin_memberships_activas_devuelve_lista_vacia(self):
        user = self.build_user(make_password('clave-segura'))

        response = self.login('clave-segura', user=user)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['memberships'], [])

    def test_login_incorrecto_con_hash_django(self):
        user = self.build_user(make_password('clave-segura'))

        response = self.login('clave-incorrecta', user=user)

        self.assertEqual(response.status_code, 401)
        user.save.assert_not_called()

    def test_login_legado_correcto_actualiza_a_hash(self):
        user = self.build_user('clave-legada')

        response = self.login('clave-legada', user=user)

        self.assertEqual(response.status_code, 200)
        self.assertNotEqual(user.password_hash, 'clave-legada')
        self.assertTrue(check_password('clave-legada', user.password_hash))
        self.assertEqual(
            [call.kwargs['update_fields'] for call in user.save.call_args_list],
            [['password_hash'], ['ultimo_acceso']],
        )

    def test_login_legado_incorrecto_no_modifica_usuario(self):
        user = self.build_user('clave-legada')

        response = self.login('clave-incorrecta', user=user)

        self.assertEqual(response.status_code, 401)
        self.assertEqual(user.password_hash, 'clave-legada')
        user.save.assert_not_called()

    def test_texto_del_hash_no_funciona_como_password(self):
        encoded = make_password('clave-segura')
        user = self.build_user(encoded)

        response = self.login(encoded, user=user)

        self.assertEqual(response.status_code, 401)
        user.save.assert_not_called()

    def test_usuario_inactivo_devuelve_401(self):
        user = self.build_user(make_password('clave-segura'), activo=False)

        response = self.login('clave-segura', user=user)

        self.assertEqual(response.status_code, 401)
        user.save.assert_not_called()

    def test_email_inexistente_devuelve_401(self):
        response = self.login(
            'clave-segura',
            error=Usuario.DoesNotExist,
        )

        self.assertEqual(response.status_code, 401)

    def test_login_no_expone_password_hash(self):
        user = self.build_user(make_password('clave-segura'))

        response = self.login('clave-segura', user=user)

        self.assertNotIn('password_hash', response.data)
        self.assertNotIn('password_hash', response.data['user'])

    def test_login_no_expone_firebase_token(self):
        user = self.build_user(make_password('clave-segura'))
        user.firebase_token = 'token-no-publico'

        response = self.login('clave-segura', user=user)

        self.assertNotIn('firebase_token', response.data)
        self.assertNotIn('firebase_token', response.data['user'])

    @patch('users.management.commands.seed_data.Usuario.objects.get_or_create')
    def test_seed_guarda_hash_verificable(self, get_or_create_mock):
        user = SimpleNamespace(save=MagicMock())
        get_or_create_mock.return_value = (user, True)
        now = timezone.now()

        SeedDataCommand().create_or_update_usuario(
            email='seed@example.com',
            password='admin123',
            nombre='Seed',
            apellido='User',
            telefono='70000000',
            now=now,
        )

        stored_password = get_or_create_mock.call_args.kwargs['defaults']['password_hash']
        self.assertNotEqual(stored_password, 'admin123')
        self.assertTrue(check_password('admin123', stored_password))


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
            stored_password = user_create.call_args.kwargs['password_hash']
            self.assertNotEqual(stored_password, 'admin123')
            self.assertTrue(check_password('admin123', stored_password))
            self.assertEqual(user_create.call_args.kwargs['email'], 'admin@clubprueba.com')
            self.assertEqual(
                relation_create.call_args.kwargs['rol'],
                RolUsuario.COORDINADOR,
            )
            self.assertEqual(
                relation_create.call_args.kwargs['estado'],
                EstadoUsuarioClub.ACTIVO,
            )
            plan_serializer_class.assert_called_once_with(data={'plan_id': 2})
            plan_serializer_class.return_value.save.assert_called_once_with(club=club)
            atomic_mock.assert_called_once_with()

        request = APIRequestFactory().post(
            '/api/auth/login/',
            {'email': 'ADMIN@CLUBPRUEBA.COM', 'password': 'admin123'},
            format='json',
        )
        with (
            patch('users.views.Usuario.objects.get', return_value=usuario) as get_user,
            patch('users.views.UsuarioClub.objects.filter') as membership_filter,
        ):
            membership_filter.return_value.select_related.return_value.order_by.return_value = []
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


class UsuarioClubApiTests(SimpleTestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.now = timezone.now()
        self.user_id = uuid.uuid4()
        self.club_id = uuid.uuid4()
        self.membership_id = uuid.uuid4()

        self.usuario = SimpleNamespace(
            id=self.user_id,
            email='user@example.com',
            password_hash='secret-hash',
            nombre='John',
            apellido='Doe',
            telefono='70000000',
            avatar_url=None,
            fecha_nacimiento=date(2000, 1, 1),
            activo=True,
            email_verificado=True,
            firebase_token='token-secret',
            ultimo_acceso=self.now,
            creado_en=self.now,
            actualizado_en=self.now,
            pk=self.user_id,
        )

        self.club = SimpleNamespace(
            id=self.club_id,
            nombre='Club Test',
            slug='club-test',
            activo=True,
            creado_en=self.now,
            actualizado_en=self.now,
            pk=self.club_id,
        )

        self.membership = SimpleNamespace(
            id=self.membership_id,
            usuario=self.usuario,
            club=self.club,
            rol=RolUsuario.ENTRENADOR,
            estado=EstadoUsuarioClub.ACTIVO,
            creado_en=self.now,
            save=MagicMock(),
            pk=self.membership_id,
        )

    def get_create_payload(self, **overrides):
        payload = {
            'usuario': str(self.user_id),
            'club': str(self.club_id),
            'rol': 'ENTRENADOR',
        }
        payload.update(overrides)
        return payload

    @patch('rest_framework.relations.PrimaryKeyRelatedField.to_internal_value')
    @patch('users.serializers.UsuarioClub.objects.create')
    @patch('users.serializers.UsuarioClub.objects.filter')
    def test_crear_membresia_valida(self, filter_mock, create_mock, to_internal_mock):
        filter_mock.return_value.exists.return_value = False
        to_internal_mock.side_effect = [self.usuario, self.club]
        create_mock.return_value = self.membership

        request = self.factory.post(
            '/api/membresias/',
            self.get_create_payload(),
            format='json',
        )
        response = UsuarioClubViewSet.as_view({'post': 'create'})(request)

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['rol'], 'ENTRENADOR')
        self.assertEqual(response.data['estado'], 'ACTIVO')

    @patch('rest_framework.relations.PrimaryKeyRelatedField.to_internal_value')
    def test_crear_membresia_rol_invalido(self, to_internal_mock):
        to_internal_mock.side_effect = [self.usuario, self.club]

        request = self.factory.post(
            '/api/membresias/',
            self.get_create_payload(rol='ADMINISTRADOR'),
            format='json',
        )
        response = UsuarioClubViewSet.as_view({'post': 'create'})(request)

        self.assertEqual(response.status_code, 400)
        self.assertIn('rol', response.data)

    @patch('rest_framework.relations.PrimaryKeyRelatedField.to_internal_value')
    @patch('users.serializers.UsuarioClub.objects.filter')
    def test_crear_membresia_duplicada_devuelve_400(self, filter_mock, to_internal_mock):
        filter_mock.return_value.exists.return_value = True
        to_internal_mock.side_effect = [self.usuario, self.club]

        request = self.factory.post(
            '/api/membresias/',
            self.get_create_payload(),
            format='json',
        )
        response = UsuarioClubViewSet.as_view({'post': 'create'})(request)

        self.assertEqual(response.status_code, 400)
        self.assertTrue('non_field_errors' in response.data or 'detail' in response.data or any('membresía' in str(v) for v in response.data.values()))

    @patch.object(UsuarioClubViewSet, 'get_queryset')
    def test_listar_membresias_no_expone_password_hash_ni_firebase_token(self, get_queryset_mock):
        get_queryset_mock.return_value = [self.membership]

        request = self.factory.get('/api/membresias/')
        response = UsuarioClubViewSet.as_view({'get': 'list'})(request)

        self.assertEqual(response.status_code, 200)
        user_data = response.data[0]['usuario']
        self.assertNotIn('password_hash', user_data)
        self.assertNotIn('firebase_token', user_data)

    def test_filtrar_por_usuario(self):
        view = UsuarioClubViewSet()
        view.request = SimpleNamespace(query_params={'usuario': str(self.user_id)})
        mock_queryset = MagicMock()
        view.queryset = mock_queryset
        
        view.get_queryset()
        
        mock_queryset.filter.assert_called_once_with(usuario_id=str(self.user_id))

    def test_filtrar_por_club(self):
        view = UsuarioClubViewSet()
        view.request = SimpleNamespace(query_params={'club': str(self.club_id)})
        mock_queryset = MagicMock()
        view.queryset = mock_queryset
        
        view.get_queryset()
        
        mock_queryset.filter.assert_called_once_with(club_id=str(self.club_id))

    def test_filtrar_por_rol(self):
        view = UsuarioClubViewSet()
        view.request = SimpleNamespace(query_params={'rol': 'ENTRENADOR'})
        mock_queryset = MagicMock()
        view.queryset = mock_queryset
        
        view.get_queryset()
        
        mock_queryset.filter.assert_called_once_with(rol='ENTRENADOR')

    @patch('users.views.UsuarioClubViewSet.get_object')
    def test_activar_membresia(self, get_obj_mock):
        membership = SimpleNamespace(
            id=self.membership_id,
            usuario=self.usuario,
            club=self.club,
            rol=RolUsuario.ENTRENADOR,
            estado=EstadoUsuarioClub.INACTIVO,
            save=MagicMock(),
        )
        get_obj_mock.return_value = membership

        request = self.factory.patch(f'/api/membresias/{self.membership_id}/activar/', {})
        response = UsuarioClubViewSet.as_view({'patch': 'activar'})(
            request,
            pk=str(self.membership_id),
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(membership.estado, EstadoUsuarioClub.ACTIVO)
        membership.save.assert_called_once_with(update_fields=['estado'])

    @patch('users.views.UsuarioClubViewSet.get_object')
    def test_desactivar_membresia(self, get_obj_mock):
        membership = SimpleNamespace(
            id=self.membership_id,
            usuario=self.usuario,
            club=self.club,
            rol=RolUsuario.ENTRENADOR,
            estado=EstadoUsuarioClub.ACTIVO,
            save=MagicMock(),
        )
        get_obj_mock.return_value = membership

        request = self.factory.patch(f'/api/membresias/{self.membership_id}/desactivar/', {})
        response = UsuarioClubViewSet.as_view({'patch': 'desactivar'})(
            request,
            pk=str(self.membership_id),
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(membership.estado, EstadoUsuarioClub.INACTIVO)
        membership.save.assert_called_once_with(update_fields=['estado'])

    @patch('users.views.UsuarioClubViewSet.get_object')
    def test_delete_no_elimina_fisicamente_sino_desactiva(self, get_obj_mock):
        membership = SimpleNamespace(
            id=self.membership_id,
            usuario=self.usuario,
            club=self.club,
            rol=RolUsuario.ENTRENADOR,
            estado=EstadoUsuarioClub.ACTIVO,
            save=MagicMock(),
            delete=MagicMock(),
        )
        get_obj_mock.return_value = membership

        request = self.factory.delete(f'/api/membresias/{self.membership_id}/')
        response = UsuarioClubViewSet.as_view({'delete': 'destroy'})(
            request,
            pk=str(self.membership_id),
        )

        self.assertEqual(response.status_code, 204)
        self.assertEqual(membership.estado, EstadoUsuarioClub.INACTIVO)
        membership.save.assert_called_once_with(update_fields=['estado'])
        membership.delete.assert_not_called()
