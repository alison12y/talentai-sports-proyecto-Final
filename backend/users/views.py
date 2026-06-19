from django.utils import timezone
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Usuario
from .serializers import LoginSerializer, RecoverPasswordSerializer, UsuarioSerializer


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

        email = serializer.validated_data['email']
        if Usuario.objects.filter(email=email).exists():
            return Response({
                'message': 'Se enviaron instrucciones de recuperación al correo registrado.'
            })

        return Response({
            'message': 'Si el correo está registrado, se enviarán instrucciones de recuperación.'
        })
