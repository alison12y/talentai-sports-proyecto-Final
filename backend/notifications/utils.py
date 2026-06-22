from django.db import transaction
from notifications.models import Notificacion
from sports.models import TutorJugador

def enviar_notificacion_push(usuario, titulo, cuerpo, data_extra=None):
    """
    Función simulada/preparada para enviar notificaciones push a Firebase.
    Aquí se integraría el SDK de Firebase en el futuro.
    """
    # firebase_admin.messaging.send(...)
    pass

@transaction.atomic
def crear_notificacion(usuario, tipo, titulo, cuerpo, club=None, data_extra=None):
    if not usuario:
        return None
        
    notificacion = Notificacion.objects.create(
        usuario=usuario,
        tipo=tipo,
        titulo=titulo,
        cuerpo=cuerpo,
        club=club,
        data_extra=data_extra or {},
        leida=False,
    )
    
    # Intento de envío push
    enviar_notificacion_push(usuario, titulo, cuerpo, data_extra)
    return notificacion

@transaction.atomic
def notificar_padre_convocatoria(convocatoria):
    jugador = convocatoria.jugador
    # Buscar el padre/tutor principal relacionado al jugador
    tutor_principal = TutorJugador.objects.filter(
        jugador=jugador, es_contacto_principal=True
    ).select_related('usuario').first()
    
    # Si no hay principal, agarrar el primero que haya
    if not tutor_principal:
        tutor_principal = TutorJugador.objects.filter(
            jugador=jugador
        ).select_related('usuario').first()
        
    if not tutor_principal or not tutor_principal.usuario:
        # No hay tutor, no creamos notificación pero no fallamos
        return None
        
    usuario_tutor = tutor_principal.usuario
    titulo = "Nueva convocatoria"
    evento = convocatoria.evento
    cuerpo = f"{jugador.nombre} {jugador.apellido} fue convocado para {evento.titulo}."
    data_extra = {
        "convocatoria_id": str(convocatoria.id),
        "evento_id": str(evento.id),
        "jugador_id": str(jugador.id),
    }
    
    return crear_notificacion(
        usuario=usuario_tutor,
        tipo="CONVOCATORIA",
        titulo=titulo,
        cuerpo=cuerpo,
        club=jugador.club,
        data_extra=data_extra
    )
