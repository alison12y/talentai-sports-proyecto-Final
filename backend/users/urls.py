from django.urls import path

from .views import LoginView, RecoverPasswordView, UsuarioListView


urlpatterns = [
    path('usuarios/', UsuarioListView.as_view(), name='usuario-list'),
    path('auth/login/', LoginView.as_view(), name='auth-login'),
    path('auth/recover-password/', RecoverPasswordView.as_view(), name='auth-recover-password'),
]
