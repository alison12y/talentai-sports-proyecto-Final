from rest_framework.routers import DefaultRouter
from django.urls import path

from .views import CategoriaListView, EquipoViewSet, JugadorViewSet


router = DefaultRouter()
router.register('equipos', EquipoViewSet, basename='equipo')
router.register('jugadores', JugadorViewSet, basename='jugador')

urlpatterns = [
    path('categorias/', CategoriaListView.as_view(), name='categoria-list'),
] + router.urls
