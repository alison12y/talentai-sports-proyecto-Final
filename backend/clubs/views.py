from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Club
from .serializers import ClubConfigSerializer, ClubSerializer, SeleccionarPlanSerializer


class ClubViewSet(viewsets.ModelViewSet):
    queryset = Club.objects.all()
    serializer_class = ClubSerializer

    def destroy(self, request, *args, **kwargs):
        club = self.get_object()
        club.activo = False
        club.actualizado_en = timezone.now()
        club.save(update_fields=['activo', 'actualizado_en'])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['patch'], url_path='configurar')
    def configurar(self, request, pk=None):
        club = self.get_object()
        serializer = ClubConfigSerializer(club, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(ClubSerializer(club).data)

    @action(detail=True, methods=['post'], url_path='seleccionar-plan')
    def seleccionar_plan(self, request, pk=None):
        club = self.get_object()
        serializer = SeleccionarPlanSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        club.plan = serializer.validated_data['plan']
        club.actualizado_en = timezone.now()
        club.save(update_fields=['plan', 'actualizado_en'])

        return Response({
            'message': 'Plan seleccionado correctamente',
            'club': ClubSerializer(club).data,
        })
