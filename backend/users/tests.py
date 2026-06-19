from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, override_settings
from rest_framework.test import APIRequestFactory

from .views import RECOVERY_MESSAGE, RecoverPasswordView


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
