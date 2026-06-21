from rest_framework.routers import DefaultRouter
from django.urls import path

from .views import (
    AsistenciaViewSet,
    CategoriaClubListCreateView,
    CategoriaDeportivaViewSet,
    CategoriaListView,
    CategoriaPredefinidasView,
    ConvocatoriaViewSet,
    EquipoViewSet,
    EstadisticaPartidoViewSet,
    EventoViewSet,
    EvolucionFisicaViewSet,
    JugadorViewSet,
    PartidoViewSet,
)


router = DefaultRouter()
router.register('equipos', EquipoViewSet, basename='equipo')
router.register('eventos', EventoViewSet, basename='evento')
router.register('convocatorias', ConvocatoriaViewSet, basename='convocatoria')
router.register('asistencias', AsistenciaViewSet, basename='asistencia')
router.register('partidos', PartidoViewSet, basename='partido')
router.register(
    'estadisticas-partido',
    EstadisticaPartidoViewSet,
    basename='estadistica-partido',
)
router.register(
    'evoluciones-fisicas',
    EvolucionFisicaViewSet,
    basename='evolucion-fisica',
)
router.register('jugadores', JugadorViewSet, basename='jugador')
router.register('categorias', CategoriaDeportivaViewSet, basename='categoria-deportiva')

urlpatterns = [
    path(
        'clubes/<uuid:club_id>/categorias/',
        CategoriaClubListCreateView.as_view(),
        name='club-categoria-list',
    ),
    path(
        'categorias/predefinidas/',
        CategoriaPredefinidasView.as_view(),
        name='categoria-predefinidas',
    ),
    path('categorias/', CategoriaListView.as_view(), name='categoria-list'),
] + router.urls
