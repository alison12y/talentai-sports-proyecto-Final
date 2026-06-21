from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import LoginView, OnboardingCompleteView, RecoverPasswordView, UsuarioViewSet, UsuarioClubViewSet


router = DefaultRouter()
router.register('usuarios', UsuarioViewSet, basename='usuario')
router.register('membresias', UsuarioClubViewSet, basename='membresia')


urlpatterns = [
    path('auth/login/', LoginView.as_view(), name='auth-login'),
    path('auth/onboarding-complete/', OnboardingCompleteView.as_view(), name='auth-onboarding-complete'),
    path('auth/recover-password/', RecoverPasswordView.as_view(), name='auth-recover-password'),
] + router.urls
