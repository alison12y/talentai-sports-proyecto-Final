import hashlib
import logging
import secrets
from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import PasswordResetToken, Usuario
from .serializers import LoginSerializer, RecoverPasswordSerializer, UsuarioSerializer


logger = logging.getLogger(__name__)
RECOVERY_MESSAGE = (
    'Si el correo ingresado está registrado, recibirás instrucciones '
    'para recuperar tu contraseña.'
)


class UsuarioListView(generics.ListAPIView):
    queryset = Usuario.objects.all()
    serializer_class = UsuarioSerializer


class LoginView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email']
        password = serializer.validated_data['password']

        try:
            usuario = Usuario.objects.get(email=email)
        except Usuario.DoesNotExist:
            return Response(
                {'error': 'Usuario o password incorrectos.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not usuario.activo:
            return Response(
                {'error': 'El usuario no está activo.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if usuario.password_hash != password:
            return Response(
                {'error': 'Usuario o password incorrectos.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        usuario.ultimo_acceso = timezone.now()
        usuario.save(update_fields=['ultimo_acceso'])

        return Response({
            'message': 'Inicio de sesión correcto',
            'user': {
                'id': str(usuario.id),
                'email': usuario.email,
                'nombre': usuario.nombre,
                'apellido': usuario.apellido,
                'activo': usuario.activo,
            },
        })


class RecoverPasswordView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        serializer = RecoverPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email'].strip().lower()
        usuario = Usuario.objects.filter(email__iexact=email, activo=True).first()

        if usuario:
            self._create_token_and_send_email(usuario)

        return Response({'message': RECOVERY_MESSAGE}, status=status.HTTP_200_OK)

    @staticmethod
    def _create_token_and_send_email(usuario):
        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()
        expires_at = timezone.now() + timedelta(
            minutes=settings.PASSWORD_RESET_TOKEN_TTL_MINUTES,
        )

        PasswordResetToken.objects.filter(user=usuario, used=False).update(used=True)
        PasswordResetToken.objects.create(
            user=usuario,
            token=token_hash,
            expires_at=expires_at,
        )

        if not settings.EMAIL_HOST or not settings.EMAIL_HOST_USER or not settings.EMAIL_HOST_PASSWORD:
            logger.warning(
                'SMTP no configurado; no se envió el correo de recuperación para el usuario %s.',
                usuario.pk,
            )
            return

        reset_url = f'{settings.FRONTEND_URL}/reset-password?token={raw_token}'
        message = (
            f'Hola {usuario.nombre},\n\n'
            'Recibimos una solicitud para recuperar tu contraseña en TalentAI Sports.\n\n'
            f'Puedes crear una nueva contraseña desde este enlace:\n{reset_url}\n\n'
            f'Este enlace expirará en {settings.PASSWORD_RESET_TOKEN_TTL_MINUTES} minutos.\n\n'
            'Si no solicitaste este cambio, puedes ignorar este mensaje.'
        )

        try:
            send_mail(
                subject='Recuperación de contraseña - TalentAI Sports',
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[usuario.email],
                fail_silently=False,
            )
        except Exception:
            logger.exception(
                'No se pudo enviar el correo de recuperación para el usuario %s.',
                usuario.pk,
            )
