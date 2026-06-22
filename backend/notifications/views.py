from django.shortcuts import render
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from .models import Notificacion
from .serializers import NotificacionSerializer

class NotificacionViewSet(viewsets.ModelViewSet):
    serializer_class = NotificacionSerializer
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        usuario_id = self.request.query_params.get('usuario_id')
        if usuario_id:
            return Notificacion.objects.filter(usuario_id=usuario_id)
            
        user = self.request.user
        if user.is_authenticated:
            return Notificacion.objects.filter(usuario=user)
        return Notificacion.objects.none()

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)

    @action(detail=True, methods=['post'], url_path='marcar-leida')
    def marcar_leida(self, request, pk=None):
        from django.http import Http404
        try:
            notificacion = self.get_object()
        except Http404:
            return Response(
                {"error": "No se encontró la notificación o no tienes permisos para modificarla."},
                status=status.HTTP_404_NOT_FOUND
            )

        if not notificacion.leida:
            notificacion.leida = True
            notificacion.fecha_lectura = timezone.now()
            notificacion.save(update_fields=['leida', 'fecha_lectura'])
            
        return Response({
            "mensaje": "Notificación marcada como leída.",
            "notificacion": self.get_serializer(notificacion).data
        }, status=status.HTTP_200_OK)
