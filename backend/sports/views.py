from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Equipo, Jugador
from .serializers import EquipoSerializer, JugadorSerializer


class EquipoViewSet(viewsets.ModelViewSet):
    queryset = Equipo.objects.all()
    serializer_class = EquipoSerializer

    def destroy(self, request, *args, **kwargs):
        equipo = self.get_object()
        equipo.activo = False
        equipo.actualizado_en = timezone.now()
        equipo.save(update_fields=['activo', 'actualizado_en'])
        return Response(status=status.HTTP_204_NO_CONTENT)


class JugadorViewSet(viewsets.ModelViewSet):
    queryset = Jugador.objects.all()
    serializer_class = JugadorSerializer

    def destroy(self, request, *args, **kwargs):
        jugador = self.get_object()
        jugador.estado = 'INACTIVO'
        jugador.actualizado_en = timezone.now()
        jugador.save(update_fields=['estado', 'actualizado_en'])
        return Response(status=status.HTTP_204_NO_CONTENT)


class CategoriaListView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        categorias = [
            {'value': 'PREBENJAMIN', 'label': 'Prebenjamin'},
            {'value': 'BENJAMIN', 'label': 'Benjamin'},
            {'value': 'ALEVIN', 'label': 'Alevin'},
            {'value': 'INFANTIL', 'label': 'Infantil'},
            {'value': 'CADETE', 'label': 'Cadete'},
            {'value': 'JUVENIL', 'label': 'Juvenil'},
            {'value': 'SENIOR', 'label': 'Senior'},
        ]
        return Response(categorias)
