from django.utils import timezone
from django.shortcuts import get_object_or_404
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from clubs.models import Club

from .models import CategoriaDeportiva, Equipo, Jugador
from .serializers import CategoriaDeportivaSerializer, EquipoSerializer, JugadorSerializer


CATEGORIAS_PREDEFINIDAS = [
    'Prebenjamín',
    'Benjamín',
    'Alevín',
    'Infantil',
    'Cadete',
    'Juvenil',
    'Sénior',
]


class CategoriaClubListCreateView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request, club_id):
        club = get_object_or_404(Club, pk=club_id)
        queryset = CategoriaDeportiva.objects.filter(club=club)
        estado = request.query_params.get('estado', 'todas').lower()
        if estado == 'activas':
            queryset = queryset.filter(activo=True)
        elif estado == 'inactivas':
            queryset = queryset.filter(activo=False)
        elif estado != 'todas':
            return Response(
                {'estado': 'Use activas, inactivas o todas.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(CategoriaDeportivaSerializer(queryset, many=True).data)

    def post(self, request, club_id):
        # TODO: validar que solo el administrador del club pueda gestionar
        # categorías de su club.
        club = get_object_or_404(Club, pk=club_id)
        serializer = CategoriaDeportivaSerializer(
            data=request.data,
            context={'club': club},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(club=club)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class CategoriaDeportivaViewSet(
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    queryset = CategoriaDeportiva.objects.select_related('club').all()
    serializer_class = CategoriaDeportivaSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if getattr(self, 'action', None) in {'partial_update', 'update'}:
            context['club'] = self.get_object().club
        return context

    @action(detail=True, methods=['patch'])
    def desactivar(self, request, pk=None):
        categoria = self.get_object()
        categoria.activo = False
        categoria.save(update_fields=['activo', 'updated_at'])
        return Response(self.get_serializer(categoria).data)

    @action(detail=True, methods=['patch'])
    def activar(self, request, pk=None):
        categoria = self.get_object()
        categoria.activo = True
        categoria.save(update_fields=['activo', 'updated_at'])
        return Response(self.get_serializer(categoria).data)

    def destroy(self, request, *args, **kwargs):
        categoria = self.get_object()
        # Equipo.categoria es texto; se compara dentro del mismo club hasta que
        # exista una relación ForeignKey explícita.
        tiene_equipos = Equipo.objects.filter(
            club=categoria.club,
            categoria__iexact=categoria.nombre,
            activo=True,
        ).exists()
        if tiene_equipos:
            return Response(
                {'detail': 'No se puede eliminar: tiene equipos asociados'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        categoria.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CategoriaPredefinidasView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        return Response(CATEGORIAS_PREDEFINIDAS)


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
