import hashlib
import logging
import secrets
from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from clubs.serializers import ClubSerializer
from payments.serializers import PlanSaaSSerializer

from .models import (
    EstadoUsuarioClub,
    PasswordResetToken,
    RolUsuario,
    Usuario,
    UsuarioClub,
)
from .passwords import set_usuario_password, verify_usuario_password
from .serializers import (
    LoginSerializer,
    LoginMembershipSerializer,
    OnboardingCompleteSerializer,
    OnboardingUsuarioResponseSerializer,
    RecoverPasswordSerializer,
    UsuarioCreateSerializer,
    UsuarioPasswordSerializer,
    UsuarioSerializer,
    UsuarioUpdateSerializer,
    UsuarioClubSerializer,
)


logger = logging.getLogger(__name__)
RECOVERY_MESSAGE = (
    'Si el correo ingresado está registrado, recibirás instrucciones '
    'para recuperar tu contraseña.'
)


class UsuarioViewSet(viewsets.ModelViewSet):
    queryset = Usuario.objects.all().order_by('nombre', 'apellido')
    serializer_class = UsuarioSerializer
    http_method_names = ('get', 'post', 'patch', 'delete', 'head', 'options')

    def get_serializer_class(self):
        if self.action == 'create':
            return UsuarioCreateSerializer
        if self.action in ('update', 'partial_update'):
            return UsuarioUpdateSerializer
        if self.action == 'cambiar_password':
            return UsuarioPasswordSerializer
        return UsuarioSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get('search', '').strip()
        activo = self.request.query_params.get('activo', '').strip().lower()
        if search:
            queryset = queryset.filter(
                Q(email__icontains=search)
                | Q(nombre__icontains=search)
                | Q(apellido__icontains=search)
            )
        if activo in ('true', '1', 'activo'):
            queryset = queryset.filter(activo=True)
        elif activo in ('false', '0', 'inactivo'):
            queryset = queryset.filter(activo=False)
        return queryset

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        usuario = serializer.save()
        return Response(
            UsuarioSerializer(usuario).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        usuario = self.get_object()
        serializer = self.get_serializer(
            usuario,
            data=request.data,
            partial=partial,
        )
        serializer.is_valid(raise_exception=True)
        usuario = serializer.save()
        return Response(UsuarioSerializer(usuario).data)

    @action(detail=True, methods=['patch'])
    def activar(self, request, pk=None):
        usuario = self.get_object()
        usuario.activo = True
        usuario.actualizado_en = timezone.now()
        usuario.save(update_fields=['activo', 'actualizado_en'])
        return Response(UsuarioSerializer(usuario).data)

    @action(detail=True, methods=['patch'])
    def desactivar(self, request, pk=None):
        usuario = self.get_object()
        usuario.activo = False
        usuario.actualizado_en = timezone.now()
        usuario.save(update_fields=['activo', 'actualizado_en'])
        return Response(UsuarioSerializer(usuario).data)

    @action(detail=True, methods=['patch'], url_path='cambiar-password')
    def cambiar_password(self, request, pk=None):
        usuario = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        set_usuario_password(
            usuario,
            serializer.validated_data['password'],
            save=False,
        )
        usuario.actualizado_en = timezone.now()
        usuario.save(update_fields=['password_hash', 'actualizado_en'])
        return Response({'message': 'Contraseña actualizada correctamente.'})

    def destroy(self, request, *args, **kwargs):
        usuario = self.get_object()
        usuario.activo = False
        usuario.actualizado_en = timezone.now()
        usuario.save(update_fields=['activo', 'actualizado_en'])
        return Response(status=status.HTTP_204_NO_CONTENT)


class LoginView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email'].strip().lower()
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

        if not verify_usuario_password(usuario, password):
            return Response(
                {'error': 'Usuario o password incorrectos.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        usuario.ultimo_acceso = timezone.now()
        usuario.save(update_fields=['ultimo_acceso'])

        memberships = (
            UsuarioClub.objects.filter(
                usuario=usuario,
                estado=EstadoUsuarioClub.ACTIVO,
                rol__in=RolUsuario.values,
            )
            .select_related('club')
            .order_by('creado_en')
        )

        return Response({
            'message': 'Inicio de sesión correcto',
            'user': {
                'id': str(usuario.id),
                'email': usuario.email,
                'nombre': usuario.nombre,
                'apellido': usuario.apellido,
                'activo': usuario.activo,
            },
            'memberships': LoginMembershipSerializer(
                memberships,
                many=True,
            ).data,
        })


class OnboardingCompleteView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        serializer = OnboardingCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = serializer.save()

        return Response({
            'message': 'Configuración completada correctamente',
            'usuario': OnboardingUsuarioResponseSerializer(result['usuario']).data,
            'club': ClubSerializer(result['club']).data,
            'plan': PlanSaaSSerializer(result['plan']).data,
        }, status=status.HTTP_201_CREATED)


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


class UsuarioClubViewSet(viewsets.ModelViewSet):
    queryset = UsuarioClub.objects.all().order_by('-creado_en')
    serializer_class = UsuarioClubSerializer
    http_method_names = ('get', 'post', 'patch', 'delete', 'head', 'options')

    def get_queryset(self):
        queryset = super().get_queryset()
        usuario = self.request.query_params.get('usuario', '').strip()
        club = self.request.query_params.get('club', '').strip()
        rol = self.request.query_params.get('rol', '').strip().upper()
        estado = self.request.query_params.get('estado', '').strip().upper()

        if usuario:
            queryset = queryset.filter(usuario_id=usuario)
        if club:
            queryset = queryset.filter(club_id=club)
        if rol:
            queryset = queryset.filter(rol=rol)
        if estado:
            queryset = queryset.filter(estado=estado)
        return queryset

    @action(detail=True, methods=['patch'])
    def activar(self, request, pk=None):
        membership = self.get_object()
        membership.estado = EstadoUsuarioClub.ACTIVO
        membership.save(update_fields=['estado'])
        return Response(UsuarioClubSerializer(membership).data)

    @action(detail=True, methods=['patch'])
    def desactivar(self, request, pk=None):
        membership = self.get_object()
        membership.estado = EstadoUsuarioClub.INACTIVO
        membership.save(update_fields=['estado'])
        return Response(UsuarioClubSerializer(membership).data)

    def destroy(self, request, *args, **kwargs):
        membership = self.get_object()
        membership.estado = EstadoUsuarioClub.INACTIVO
        membership.save(update_fields=['estado'])
        return Response(status=status.HTTP_204_NO_CONTENT)
