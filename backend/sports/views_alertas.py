from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from datetime import timedelta
from django.db.models import Sum
from .models import AlertaRiesgoLesion, Jugador, Equipo, EvolucionFisica, EstadisticaPartido, JugadorEquipo
from .serializers import AlertaRiesgoLesionSerializer
from notifications.models import Notificacion

def calcular_riesgo_lesion_hu24(jugador_id):
    jugador = Jugador.objects.get(id=jugador_id)
    
    # 1. Obtener minutos jugados en los últimos 7 días
    hace_7_dias = timezone.now() - timedelta(days=7)
    
    estadisticas_recientes = EstadisticaPartido.objects.filter(
        jugador=jugador, 
        partido__fecha__gte=hace_7_dias
    )
    minutos_semana = estadisticas_recientes.aggregate(Sum('minutos_jugados'))['minutos_jugados__sum'] or 0
    
    # 2. Análisis Físico
    evoluciones = EvolucionFisica.objects.filter(jugador=jugador).order_by('-creado_en')[:2]
    
    score = 0
    motivos = []
    
    # Evaluar minutos jugados
    if minutos_semana > 260:
        score += 80
        motivos.append(f"Sobrecarga crítica: Acumula {minutos_semana} minutos en los últimos 7 días.")
    elif minutos_semana > 200:
        score += 50
        motivos.append(f"Alerta de sobrecarga: Acumula {minutos_semana} minutos en los últimos 7 días.")
    elif minutos_semana >= 120:
        score += 20
        motivos.append(f"Carga moderada: Acumula {minutos_semana} minutos en los últimos 7 días.")
    else:
        # Menos de 120 minutos, sin riesgo significativo por minutos
        pass
        
    # Evaluar físico
    if len(evoluciones) >= 2:
        ultima = evoluciones[0]
        anterior = evoluciones[1]
        if ultima.velocidad_40m and anterior.velocidad_40m:
            caida_vel = float(ultima.velocidad_40m) - float(anterior.velocidad_40m)
            if caida_vel > 0.5: # Más lento
                score += 30
                motivos.append("Caída significativa de velocidad en sprint corto.")

    if not estadisticas_recientes and not evoluciones:
        return None, 0, None, None, 0 # Sin datos suficientes
        
    if score >= 80 or minutos_semana > 260:
        nivel = "CRITICAL"
        recomendacion = "Descanso inmediato. Evitar entrenamientos de alta intensidad y partidos."
    elif score >= 50 or minutos_semana > 200:
        nivel = "WARNING"
        recomendacion = "Reducir carga física un 50% en entrenamientos. Monitorear molestias."
    elif score >= 20 or minutos_semana >= 120:
        nivel = "INFO"
        recomendacion = "Carga dentro del límite superior. Continuar hidratación y recuperación activa."
    else:
        # No alert needed if score is low and minutes are low
        return None, minutos_semana, None, None, score
        
    return nivel, minutos_semana, " ".join(motivos), recomendacion, score


class AlertasRiesgoLesionView(APIView):
    def get(self, request):
        queryset = AlertaRiesgoLesion.objects.all()
        
        equipo_id = request.query_params.get('equipo')
        if equipo_id:
            queryset = queryset.filter(equipo_id=equipo_id)
            
        jugador_id = request.query_params.get('jugador')
        if jugador_id:
            queryset = queryset.filter(jugador_id=jugador_id)
            
        nivel = request.query_params.get('nivel')
        if nivel:
            queryset = queryset.filter(nivel=nivel)
            
        estado = request.query_params.get('estado')
        if estado:
            queryset = queryset.filter(estado=estado)
            
        serializer = AlertaRiesgoLesionSerializer(queryset, many=True)
        return Response(serializer.data)

class GenerarAlertasRiesgoLesionView(APIView):
    def post(self, request):
        equipo_id = request.data.get('equipo')
        
        if not equipo_id:
            return Response({"error": "Se requiere equipo_id."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            equipo = Equipo.objects.get(id=equipo_id)
        except Equipo.DoesNotExist:
            return Response({"error": "Equipo no encontrado."}, status=status.HTTP_404_NOT_FOUND)
            
        jugadores_equipo = JugadorEquipo.objects.filter(equipo=equipo, activo=True)
        
        alertas_generadas = 0
        alertas_actualizadas = 0
        
        for rel in jugadores_equipo:
            jugador = rel.jugador
            
            nivel, minutos_semana, motivo, recomendacion, score = calcular_riesgo_lesion_hu24(jugador.id)
            
            if nivel is None:
                continue
                
            alerta_activa = AlertaRiesgoLesion.objects.filter(jugador=jugador, equipo=equipo, estado='ACTIVA').first()
            
            if alerta_activa:
                if alerta_activa.nivel != nivel or alerta_activa.score_riesgo != score or alerta_activa.minutos_semana != minutos_semana:
                    alerta_activa.nivel = nivel
                    alerta_activa.minutos_semana = minutos_semana
                    alerta_activa.motivo = motivo
                    alerta_activa.recomendacion = recomendacion
                    alerta_activa.score_riesgo = score
                    alerta_activa.save()
                    alertas_actualizadas += 1
            else:
                alerta = AlertaRiesgoLesion.objects.create(
                    jugador=jugador,
                    equipo=equipo,
                    nivel=nivel,
                    minutos_semana=minutos_semana,
                    motivo=motivo,
                    recomendacion=recomendacion,
                    score_riesgo=score,
                    estado='ACTIVA'
                )
                alertas_generadas += 1
                
                # Notification for Critical
                if nivel == 'CRITICAL':
                    Notificacion.objects.create(
                        usuario=request.user,
                        club=equipo.club,
                        tipo='OTRO', 
                        titulo='Alerta crítica de riesgo de lesión',
                        cuerpo=f"Alerta crítica de riesgo de lesión para {jugador.nombre} {jugador.apellido}.",
                        data_extra={"alerta_id": str(alerta.id), "jugador_id": str(jugador.id)}
                    )
                    
        return Response({
            "mensaje": f"Se procesaron las alertas exitosamente.",
            "alertas_generadas": alertas_generadas,
            "alertas_actualizadas": alertas_actualizadas
        })

class MarcarAlertaAtendidaView(APIView):
    def post(self, request, id):
        try:
            alerta = AlertaRiesgoLesion.objects.get(id=id)
        except AlertaRiesgoLesion.DoesNotExist:
            return Response({"error": "Alerta no encontrada."}, status=status.HTTP_404_NOT_FOUND)
            
        alerta.estado = 'VISTA'
        alerta.vista_en = timezone.now()
        alerta.save()
        
        return Response(AlertaRiesgoLesionSerializer(alerta).data)
