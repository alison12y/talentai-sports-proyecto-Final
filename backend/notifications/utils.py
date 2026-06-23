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
    # Permitimos usuario None para crear notificaciones generales o asociadas solo por ID/extra data
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
        
    usuario_tutor = None
    if tutor_principal and tutor_principal.usuario:
        usuario_tutor = tutor_principal.usuario
        
    titulo = "Nueva convocatoria"
    evento = convocatoria.evento
    cuerpo = f"Has sido convocado a un evento: {evento.titulo}"
    data_extra = {
        "id_convocatoria": str(convocatoria.id),
        "id_evento": str(evento.id),
        "id_jugador": str(jugador.id),
    }
    
    return crear_notificacion(
        usuario=usuario_tutor,
        tipo="CONVOCATORIA",
        titulo=titulo,
        cuerpo=cuerpo,
        club=jugador.club,
        data_extra=data_extra
    )
