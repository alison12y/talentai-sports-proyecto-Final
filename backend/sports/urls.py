from rest_framework.routers import DefaultRouter
from django.urls import path

from .views import (
    AsistenciaViewSet,
    CategoriaClubListCreateView,
    CategoriaDeportivaViewSet,
    CategoriaListView,
    CategoriaPredefinidasView,
    ConvocatoriaViewSet,
    CuotaViewSet,
    EquipoViewSet,
    EstadisticaPartidoViewSet,
    EventoViewSet,
    EvolucionFisicaViewSet,
    JugadorViewSet,
    PartidoViewSet,
    PagoViewSet,
)

from .views_reports import ReporteRendimientoView, ReporteRendimientoExcelView, JugadoresPorEquipoView
from .views_video import SubirVideoPartidoView, EstadoAnalisisVideoView, InformeScoutingVideoView, CompartirInformePadresView
from .views_alertas import (
    AlertasRiesgoLesionView,
    GenerarAlertasRiesgoLesionView,
    MarcarAlertaAtendidaView,
)
from .views_recomendaciones import (
    RecomendacionesAscensoView,
    GenerarRecomendacionesAscensoView,
    MarcarRecomendacionRevisadaView,
    CrearSeguimientoRecomendacionView,
)
from .views_video_scout import (
    VideoScoutClipsView,
    CompartirVideoScoutClipsPadresView,
    JugadorVideoScoutClipsView,
)

router = DefaultRouter()
router.register('equipos', EquipoViewSet, basename='equipo')
router.register('eventos', EventoViewSet, basename='evento')
router.register('convocatorias', ConvocatoriaViewSet, basename='convocatoria')
router.register('cuotas', CuotaViewSet, basename='cuota')
router.register('pagos', PagoViewSet, basename='pago')
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
    path('reportes/rendimiento/', ReporteRendimientoView.as_view(), name='reporte-rendimiento'),
    path('reportes/rendimiento/exportar-excel/', ReporteRendimientoExcelView.as_view(), name='reporte-rendimiento-excel'),
    path('reportes/jugadores-por-equipo/', JugadoresPorEquipoView.as_view(), name='reporte-jugadores-por-equipo'),
    path('partidos/<uuid:id>/subir-video/', SubirVideoPartidoView.as_view(), name='subir-video-partido'),
    path('partidos/<uuid:id>/estado-analisis/', EstadoAnalisisVideoView.as_view(), name='estado-analisis-video'),
    path('partidos/<uuid:id>/informe-scouting/', InformeScoutingVideoView.as_view(), name='informe-scouting-video'),
    path('partidos/<uuid:id>/compartir-informe-padres/', CompartirInformePadresView.as_view(), name='compartir-informe-padres'),
    path('partidos/<uuid:id>/video-scout-clips/', VideoScoutClipsView.as_view(), name='video-scout-clips'),
    path('partidos/<uuid:id>/video-scout-clips/compartir-padres/', CompartirVideoScoutClipsPadresView.as_view(), name='video-scout-clips-compartir-padres'),
    path('jugadores/<uuid:jugador_id>/video-scout-clips/', JugadorVideoScoutClipsView.as_view(), name='jugador-video-scout-clips'),
    path('alertas-riesgo-lesion/', AlertasRiesgoLesionView.as_view(), name='alertas-riesgo-lesion'),
    path('alertas-riesgo-lesion/generar/', GenerarAlertasRiesgoLesionView.as_view(), name='generar-alertas-riesgo'),
    path('alertas-riesgo-lesion/<uuid:id>/marcar-vista/', MarcarAlertaAtendidaView.as_view(), name='marcar-alerta-vista'),
    path('recomendaciones-ascenso/', RecomendacionesAscensoView.as_view(), name='recomendaciones-ascenso'),
    path('recomendaciones-ascenso/generar/', GenerarRecomendacionesAscensoView.as_view(), name='generar-recomendaciones'),
    path('recomendaciones-ascenso/<uuid:id>/marcar-revisada/', MarcarRecomendacionRevisadaView.as_view(), name='marcar-revisada'),
    path('recomendaciones-ascenso/<uuid:id>/crear-seguimiento/', CrearSeguimientoRecomendacionView.as_view(), name='crear-seguimiento'),
] + router.urls
