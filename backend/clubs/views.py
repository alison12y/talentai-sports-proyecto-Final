from django.db import IntegrityError
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from payments.models import ClubPlan
from payments.serializers import (
    ClubPlanSerializer,
    PlanSaaSSerializer,
    SeleccionarPlanSaaSSerializer,
)
from users.models import EstadoUsuarioClub, RolUsuario, UsuarioClub

from .models import Club
from .serializers import ClubConfigSerializer, ClubSerializer


class ClubViewSet(viewsets.ModelViewSet):
    queryset = Club.objects.all().order_by('-creado_en')
    serializer_class = ClubSerializer

    def destroy(self, request, *args, **kwargs):
        club = self.get_object()
        try:
            club.delete()
        except IntegrityError:
            return Response(
                {'detail': 'No se puede eliminar el club porque tiene información relacionada.'},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['patch'])
    def desactivar(self, request, pk=None):
        club = self.get_object()
        club.activo = False
        club.actualizado_en = timezone.now()
        club.save(update_fields=['activo', 'actualizado_en'])
        return Response({
            'message': 'Club desactivado correctamente',
            'club': ClubSerializer(club).data,
        })

    @action(detail=True, methods=['patch'])
    def activar(self, request, pk=None):
        club = self.get_object()
        club.activo = True
        club.actualizado_en = timezone.now()
        club.save(update_fields=['activo', 'actualizado_en'])
        return Response({
            'message': 'Club activado correctamente',
            'club': ClubSerializer(club).data,
        })

    @action(detail=True, methods=['patch'], url_path='configurar')
    def configurar(self, request, pk=None):
        # TODO: validar que solo el administrador del club pueda modificar la
        # configuración de su club.
        club = self.get_object()
        serializer = ClubConfigSerializer(club, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(ClubSerializer(club).data)

    @action(detail=True, methods=['post'], url_path='seleccionar-plan')
    def seleccionar_plan(self, request, pk=None):
        club = self.get_object()
        if not UsuarioClub.objects.filter(
            usuario_id=getattr(request.user, 'pk', None),
            club=club,
            rol=RolUsuario.COORDINADOR,
            estado=EstadoUsuarioClub.ACTIVO,
        ).exists():
            raise PermissionDenied('Solo el administrador del club puede seleccionar el plan.')

        serializer = SeleccionarPlanSaaSSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        suscripcion = serializer.save(club=club)

        return Response({
            'message': 'Plan seleccionado correctamente',
            'club': ClubSerializer(club).data,
            'plan': PlanSaaSSerializer(suscripcion.plan).data,
            'suscripcion': ClubPlanSerializer(suscripcion).data,
        })

    @action(detail=True, methods=['get'], url_path='plan-actual')
    def plan_actual(self, request, pk=None):
        club = self.get_object()
        suscripcion = (
            ClubPlan.objects.filter(club=club, activo=True)
            .select_related('plan')
            .first()
        )
        return Response({
            'club_id': str(club.pk),
            'plan': PlanSaaSSerializer(suscripcion.plan).data if suscripcion else None,
            'suscripcion': ClubPlanSerializer(suscripcion).data if suscripcion else None,
        })
