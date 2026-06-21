from django.db import transaction
from django.db.models import Count
from django.utils import timezone
from django.shortcuts import get_object_or_404
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from clubs.models import Club
from users.models import EstadoUsuarioClub, RolUsuario, UsuarioClub

from .models import (
    Asistencia,
    CategoriaDeportiva,
    Convocatoria,
    Equipo,
    EstadisticaPartido,
    Evento,
    EvolucionFisica,
    Jugador,
    Partido,
    TutorJugador,
)
from .serializers import (
    AsistenciaSerializer,
    CategoriaDeportivaSerializer,
    ConvocatoriaSerializer,
    ConvocatoriaRespuestaSerializer,
    EquipoSerializer,
    EstadisticaPartidoSerializer,
    EventoSerializer,
    EvolucionFisicaSerializer,
    JugadorSerializer,
    PartidoSerializer,
    generar_convocatorias_evento,
)


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

    @action(detail=True, methods=['patch'])
    def desactivar(self, request, pk=None):
        equipo = self.get_object()
        equipo.activo = False
        equipo.actualizado_en = timezone.now()
        equipo.save(update_fields=['activo', 'actualizado_en'])
        return Response(self.get_serializer(equipo).data)

    @action(detail=True, methods=['patch'])
    def activar(self, request, pk=None):
        equipo = self.get_object()
        equipo.activo = True
        equipo.actualizado_en = timezone.now()
        equipo.save(update_fields=['activo', 'actualizado_en'])
        return Response(self.get_serializer(equipo).data)

    def destroy(self, request, *args, **kwargs):
        equipo = self.get_object()
        equipo.activo = False
        equipo.actualizado_en = timezone.now()
        equipo.save(update_fields=['activo', 'actualizado_en'])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['get'])
    def partidos(self, request, pk=None):
        equipo = self.get_object()
        queryset = Partido.objects.select_related('evento', 'equipo').filter(
            equipo=equipo,
            activo=True,
        ).order_by('-fecha')
        return Response(PartidoSerializer(queryset, many=True).data)


class EventoViewSet(viewsets.ModelViewSet):
    queryset = Evento.objects.select_related('club', 'equipo').filter(activo=True)
    serializer_class = EventoSerializer

    def perform_create(self, serializer):
        club = serializer.validated_data['club']
        usuario_id = getattr(self.request.user, 'pk', None)

        # TODO(HU-09 auth): mientras el proyecto no tenga autenticación real
        # integrada con Usuario, las peticiones llegan como AnonymousUser. El
        # serializer ya garantiza que el club exista; la autorización por rol
        # debe activarse para todas las peticiones al completar esa integración.
        if usuario_id is None:
            serializer.save()
            return

        autorizado = UsuarioClub.objects.filter(
            usuario_id=usuario_id,
            club=club,
            rol__in=(RolUsuario.ENTRENADOR, RolUsuario.COORDINADOR),
            estado=EstadoUsuarioClub.ACTIVO,
        ).exists()
        if not autorizado:
            raise PermissionDenied(
                'Solo un entrenador o administrador activo del club puede crear eventos.'
            )
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        evento = self.get_object()
        evento.activo = False
        evento.actualizado_en = timezone.now()
        evento.save(update_fields=['activo', 'actualizado_en'])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['patch'])
    def cancelar(self, request, pk=None):
        evento = self.get_object()
        if evento.estado == Evento.Estado.FINALIZADO:
            return Response(
                {'estado': 'Un evento FINALIZADO no puede cancelarse.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        evento.estado = Evento.Estado.CANCELADO
        evento.actualizado_en = timezone.now()
        evento.save(update_fields=['estado', 'actualizado_en'])
        return Response(self.get_serializer(evento).data)

    @action(detail=True, methods=['patch'])
    def finalizar(self, request, pk=None):
        evento = self.get_object()
        if evento.estado == Evento.Estado.CANCELADO:
            return Response(
                {'estado': 'Un evento CANCELADO no puede finalizarse.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        evento.estado = Evento.Estado.FINALIZADO
        evento.actualizado_en = timezone.now()
        evento.save(update_fields=['estado', 'actualizado_en'])
        return Response(self.get_serializer(evento).data)

    @action(detail=True, methods=['post'], url_path='generar-convocatorias')
    @transaction.atomic
    def generar_convocatorias(self, request, pk=None):
        evento = self.get_object()
        creadas = generar_convocatorias_evento(evento)
        return Response({
            'evento': str(evento.pk),
            'convocatorias_creadas': creadas,
            'total': Convocatoria.objects.filter(evento=evento).count(),
        })

    @action(detail=True, methods=['get'], url_path='resumen-convocatorias')
    def resumen_convocatorias(self, request, pk=None):
        evento = self.get_object()
        conteos = {
            item['estado']: item['total']
            for item in Convocatoria.objects.filter(evento=evento)
            .values('estado')
            .annotate(total=Count('id'))
        }
        return Response({
            'evento': str(evento.pk),
            'total': sum(conteos.values()),
            'pendientes': conteos.get(Convocatoria.Estado.PENDIENTE, 0),
            'confirmados': conteos.get(Convocatoria.Estado.CONFIRMADO, 0),
            'rechazados': conteos.get(Convocatoria.Estado.RECHAZADO, 0),
            'no_convocados': conteos.get(Convocatoria.Estado.NO_CONVOCADO, 0),
        })

    @action(detail=True, methods=['get'])
    def asistencias(self, request, pk=None):
        evento = self.get_object()
        queryset = Asistencia.objects.select_related('evento', 'jugador').filter(
            evento=evento,
            activo=True,
        )
        return Response(AsistenciaSerializer(queryset, many=True).data)

    @action(detail=True, methods=['post'], url_path='registrar-asistencias')
    @transaction.atomic
    def registrar_asistencias(self, request, pk=None):
        evento = self.get_object()
        items = request.data.get('asistencias')
        if not isinstance(items, list) or not items:
            return Response(
                {'asistencias': 'Debe enviar una lista no vacía de asistencias.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializers = []
        for index, item in enumerate(items):
            if not isinstance(item, dict):
                return Response(
                    {'asistencias': {index: 'Cada asistencia debe ser un objeto.'}},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            serializer = AsistenciaSerializer(data={**item, 'evento': evento.pk})
            if not serializer.is_valid():
                return Response(
                    {'asistencias': {index: serializer.errors}},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            serializers.append(serializer)

        asistencias = [serializer.save() for serializer in serializers]
        return Response(
            AsistenciaSerializer(asistencias, many=True).data,
            status=status.HTTP_200_OK,
        )


class ConvocatoriaViewSet(viewsets.ModelViewSet):
    queryset = Convocatoria.objects.select_related(
        'evento', 'jugador', 'evento__club', 'evento__equipo',
    ).all()
    serializer_class = ConvocatoriaSerializer

    def destroy(self, request, *args, **kwargs):
        convocatoria = self.get_object()
        convocatoria.estado = Convocatoria.Estado.NO_CONVOCADO
        convocatoria.confirmado = False
        convocatoria.confirmado_en = None
        convocatoria.respuesta = None
        convocatoria.motivo_rechazo = None
        convocatoria.respondido_en = None
        convocatoria.actualizado_en = timezone.now()
        convocatoria.save(update_fields=[
            'estado', 'confirmado', 'confirmado_en', 'respuesta',
            'motivo_rechazo', 'respondido_en', 'actualizado_en',
        ])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['get'], url_path='pendientes-padre')
    def pendientes_padre(self, request):
        queryset = self.get_queryset().filter(
            estado=Convocatoria.Estado.PENDIENTE,
        ).exclude(evento__estado=Evento.Estado.CANCELADO)
        usuario_id = getattr(request.user, 'pk', None)
        if usuario_id is not None:
            jugador_ids = TutorJugador.objects.filter(
                usuario_id=usuario_id,
            ).values_list('jugador_id', flat=True)
            queryset = queryset.filter(jugador_id__in=jugador_ids)
        return Response(self.get_serializer(queryset, many=True).data)

    def _responder(self, request, respuesta):
        convocatoria = self.get_object()
        serializer = ConvocatoriaRespuestaSerializer(
            convocatoria,
            data=request.data,
            context={'respuesta_esperada': respuesta},
        )
        serializer.is_valid(raise_exception=True)
        convocatoria = serializer.save()
        return Response(self.get_serializer(convocatoria).data)

    @action(detail=True, methods=['patch'])
    def confirmar(self, request, pk=None):
        return self._responder(request, Convocatoria.Estado.CONFIRMADO)

    @action(detail=True, methods=['patch'])
    def rechazar(self, request, pk=None):
        return self._responder(request, Convocatoria.Estado.RECHAZADO)


class AsistenciaViewSet(viewsets.ModelViewSet):
    queryset = Asistencia.objects.select_related('evento', 'jugador').filter(activo=True)
    serializer_class = AsistenciaSerializer
    http_method_names = ('get', 'post', 'patch', 'delete', 'head', 'options')

    def get_queryset(self):
        queryset = super().get_queryset()
        evento = self.request.query_params.get('evento')
        jugador = self.request.query_params.get('jugador')
        if evento:
            queryset = queryset.filter(evento_id=evento)
        if jugador:
            queryset = queryset.filter(jugador_id=jugador)
        return queryset

    def destroy(self, request, *args, **kwargs):
        asistencia = self.get_object()
        asistencia.activo = False
        asistencia.actualizado_en = timezone.now()
        asistencia.save(update_fields=['activo', 'actualizado_en'])
        return Response(status=status.HTTP_204_NO_CONTENT)


class PartidoViewSet(viewsets.ModelViewSet):
    queryset = Partido.objects.select_related('evento', 'equipo').filter(
        activo=True,
    ).order_by('-fecha')
    serializer_class = PartidoSerializer
    http_method_names = ('get', 'post', 'patch', 'delete', 'head', 'options')

    def get_queryset(self):
        queryset = super().get_queryset()
        equipo = self.request.query_params.get('equipo')
        if equipo:
            queryset = queryset.filter(equipo_id=equipo)
        return queryset

    def destroy(self, request, *args, **kwargs):
        partido = self.get_object()
        partido.activo = False
        partido.actualizado_en = timezone.now()
        partido.save(update_fields=['activo', 'actualizado_en'])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['get'])
    def estadisticas(self, request, pk=None):
        partido = self.get_object()
        queryset = EstadisticaPartido.objects.select_related(
            'partido', 'jugador',
        ).filter(partido=partido, activo=True)
        return Response(EstadisticaPartidoSerializer(queryset, many=True).data)

    @action(detail=True, methods=['post'], url_path='registrar-estadisticas')
    @transaction.atomic
    def registrar_estadisticas(self, request, pk=None):
        partido = self.get_object()
        items = request.data.get('estadisticas')
        if not isinstance(items, list) or not items:
            return Response(
                {'estadisticas': 'Debe enviar una lista no vacía de estadísticas.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializers = []
        for index, item in enumerate(items):
            if not isinstance(item, dict):
                return Response(
                    {'estadisticas': {index: 'Cada estadística debe ser un objeto.'}},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            serializer = EstadisticaPartidoSerializer(
                data={**item, 'partido': partido.pk},
            )
            if not serializer.is_valid():
                return Response(
                    {'estadisticas': {index: serializer.errors}},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            serializers.append(serializer)

        estadisticas = [serializer.save() for serializer in serializers]
        return Response(
            EstadisticaPartidoSerializer(estadisticas, many=True).data,
            status=status.HTTP_200_OK,
        )


class EstadisticaPartidoViewSet(viewsets.ModelViewSet):
    queryset = EstadisticaPartido.objects.select_related(
        'partido', 'jugador',
    ).filter(activo=True).order_by('-creado_en')
    serializer_class = EstadisticaPartidoSerializer
    http_method_names = ('get', 'post', 'patch', 'delete', 'head', 'options')

    def get_queryset(self):
        queryset = super().get_queryset()
        partido = self.request.query_params.get('partido')
        jugador = self.request.query_params.get('jugador')
        if partido:
            queryset = queryset.filter(partido_id=partido)
        if jugador:
            queryset = queryset.filter(jugador_id=jugador)
        return queryset

    def destroy(self, request, *args, **kwargs):
        estadistica = self.get_object()
        estadistica.activo = False
        estadistica.actualizado_en = timezone.now()
        estadistica.save(update_fields=['activo', 'actualizado_en'])
        return Response(status=status.HTTP_204_NO_CONTENT)


class EvolucionFisicaViewSet(viewsets.ModelViewSet):
    queryset = EvolucionFisica.objects.select_related('jugador').filter(
        activo=True,
    ).order_by('-fecha')
    serializer_class = EvolucionFisicaSerializer
    http_method_names = ('get', 'post', 'patch', 'delete', 'head', 'options')

    def get_queryset(self):
        queryset = super().get_queryset()
        jugador = self.request.query_params.get('jugador')
        if jugador:
            queryset = queryset.filter(jugador_id=jugador)
        return queryset

    def destroy(self, request, *args, **kwargs):
        evolucion = self.get_object()
        evolucion.activo = False
        evolucion.actualizado_en = timezone.now()
        evolucion.save(update_fields=['activo', 'actualizado_en'])
        return Response(status=status.HTTP_204_NO_CONTENT)


class JugadorViewSet(viewsets.ModelViewSet):
    queryset = Jugador.objects.all()
    serializer_class = JugadorSerializer

    @action(detail=True, methods=['patch'])
    def desactivar(self, request, pk=None):
        jugador = self.get_object()
        jugador.estado = 'INACTIVO'
        jugador.actualizado_en = timezone.now()
        jugador.save(update_fields=['estado', 'actualizado_en'])
        return Response(self.get_serializer(jugador).data)

    @action(detail=True, methods=['patch'])
    def activar(self, request, pk=None):
        jugador = self.get_object()
        jugador.estado = 'ACTIVO'
        jugador.actualizado_en = timezone.now()
        jugador.save(update_fields=['estado', 'actualizado_en'])
        return Response(self.get_serializer(jugador).data)

    def destroy(self, request, *args, **kwargs):
        jugador = self.get_object()
        jugador.estado = 'INACTIVO'
        jugador.actualizado_en = timezone.now()
        jugador.save(update_fields=['estado', 'actualizado_en'])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['get'], url_path='resumen-asistencia')
    def resumen_asistencia(self, request, pk=None):
        jugador = self.get_object()
        conteos = {
            item['estado']: item['total']
            for item in Asistencia.objects.filter(jugador=jugador, activo=True)
            .values('estado')
            .annotate(total=Count('id'))
        }
        presentes = conteos.get(Asistencia.Estado.PRESENTE, 0)
        ausentes = conteos.get(Asistencia.Estado.AUSENTE, 0)
        justificados = conteos.get(Asistencia.Estado.JUSTIFICADO, 0)
        total = presentes + ausentes + justificados
        return Response({
            'jugador': str(jugador.pk),
            'total': total,
            'presentes': presentes,
            'ausentes': ausentes,
            'justificados': justificados,
            'porcentaje_asistencia': round((presentes / total) * 100, 2) if total else 0,
        })

    @action(detail=True, methods=['get'])
    def estadisticas(self, request, pk=None):
        jugador = self.get_object()
        queryset = EstadisticaPartido.objects.select_related(
            'partido', 'jugador',
        ).filter(jugador=jugador, activo=True).order_by('-partido__fecha')
        return Response(EstadisticaPartidoSerializer(queryset, many=True).data)

    @action(detail=True, methods=['get'], url_path='evolucion-fisica')
    def evolucion_fisica(self, request, pk=None):
        jugador = self.get_object()
        queryset = EvolucionFisica.objects.filter(
            jugador=jugador,
            activo=True,
        ).order_by('-fecha')
        return Response(EvolucionFisicaSerializer(queryset, many=True).data)

    @action(
        detail=True,
        methods=['get'],
        url_path='evolucion-fisica/ultimos-12',
    )
    def ultimos_12_evolucion_fisica(self, request, pk=None):
        jugador = self.get_object()
        queryset = EvolucionFisica.objects.filter(
            jugador=jugador,
            activo=True,
        ).order_by('-fecha')[:12]
        return Response(EvolucionFisicaSerializer(queryset, many=True).data)

    @action(detail=True, methods=['get'])
    def convocatorias(self, request, pk=None):
        jugador = self.get_object()
        queryset = Convocatoria.objects.select_related(
            'evento', 'jugador', 'evento__club', 'evento__equipo',
        ).filter(jugador=jugador).order_by('-creado_en')
        return Response(ConvocatoriaSerializer(queryset, many=True).data)


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
