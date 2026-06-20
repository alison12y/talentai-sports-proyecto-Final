from rest_framework.routers import DefaultRouter
from django.urls import path

from .views import (
    CategoriaClubListCreateView,
    CategoriaDeportivaViewSet,
    CategoriaListView,
    CategoriaPredefinidasView,
    EquipoViewSet,
    JugadorViewSet,
)


router = DefaultRouter()
router.register('equipos', EquipoViewSet, basename='equipo')
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
