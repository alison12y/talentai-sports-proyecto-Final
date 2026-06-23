from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from .models import RecomendacionAscenso, Jugador, Equipo, JugadorEquipo, InformeScouting, VideoPartido
from .serializers import RecomendacionAscensoSerializer
from notifications.models import Notificacion
import json

def get_categoria_recomendada(categoria_actual):
    cat = (categoria_actual or '').upper()
    if '13' in cat: return 'Sub-15'
    if '15' in cat: return 'Sub-17'
    if '17' in cat: return 'Sub-20'
    return 'Categoría superior inmediata'

def generar_recomendacion_ascenso_jugador(jugador, equipo):
    informes = InformeScouting.objects.all().order_by('-creado_en')
    
    analisis_encontrados = []
    
    for informe in informes:
        metricas = informe.metricas_json
        if not metricas or not isinstance(metricas, dict): 
            continue
        
        jugadores_data = metricas.get('metricas_jugadores', [])
        if not isinstance(jugadores_data, list):
            continue
            
        for j_data in jugadores_data:
            if str(j_data.get('jugador_id')) == str(jugador.id):
                score = j_data.get('score')
                if score is None:
                    score = j_data.get('compatibilidad')
                    
                if score is not None and isinstance(score, (int, float)):
                    analisis_encontrados.append(float(score))
                break
                
        if len(analisis_encontrados) >= 3:
            break
            
    if len(analisis_encontrados) < 3:
        return None, 0, 0
        
    # Usar int si el decimal es .0 para cumplir "86/100" en el texto
    score_promedio = sum(analisis_encontrados) / len(analisis_encontrados)
    
    if score_promedio <= 80:
        return None, score_promedio, len(analisis_encontrados)
        
    return 'LISTO_PARA_ASCENSO' if score_promedio >= 90 else 'TALENTO_DESTACADO', score_promedio, len(analisis_encontrados)

class RecomendacionesAscensoView(APIView):
    def get(self, request):
        queryset = RecomendacionAscenso.objects.all()
        
        equipo_id = request.query_params.get('equipo')
        if equipo_id:
            queryset = queryset.filter(equipo_actual_id=equipo_id)
            
        jugador_id = request.query_params.get('jugador')
        if jugador_id:
            queryset = queryset.filter(jugador_id=jugador_id)
            
        nivel = request.query_params.get('nivel')
        if nivel:
            queryset = queryset.filter(nivel=nivel)
            
        estado = request.query_params.get('estado')
        if estado:
            queryset = queryset.filter(estado=estado)
            
        serializer = RecomendacionAscensoSerializer(queryset, many=True)
        return Response(serializer.data)

class GenerarRecomendacionesAscensoView(APIView):
    def post(self, request):
        equipo_id = request.data.get('equipo')
        if not equipo_id:
            return Response({"error": "Se requiere equipo_id."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            equipo = Equipo.objects.get(id=equipo_id)
        except Equipo.DoesNotExist:
            return Response({"error": "Equipo no encontrado."}, status=status.HTTP_404_NOT_FOUND)
            
        jugadores_equipo = JugadorEquipo.objects.filter(equipo=equipo, activo=True)
        
        generadas = 0
        actualizadas = 0
        omitidos = 0
        
        for rel in jugadores_equipo:
            jugador = rel.jugador
            
            nivel, score_promedio, analisis_count = generar_recomendacion_ascenso_jugador(jugador, equipo)
            
            if nivel is None:
                omitidos += 1
                continue
                
            recomendacion = RecomendacionAscenso.objects.filter(jugador=jugador, equipo_actual=equipo, estado='ACTIVA').first()
            cat_nombre = equipo.categoria or 'Desconocida'
            cat_recomendada = get_categoria_recomendada(cat_nombre)
            
            if recomendacion:
                recomendacion.score_promedio = score_promedio
                recomendacion.analisis_considerados = analisis_count
                recomendacion.nivel = nivel
                recomendacion.categoria_recomendada = cat_recomendada
                recomendacion.save()
                actualizadas += 1
            else:
                score_int = int(score_promedio) if score_promedio.is_integer() else round(score_promedio, 1)
                recomendacion = RecomendacionAscenso.objects.create(
                    jugador=jugador,
                    equipo_actual=equipo,
                    categoria_actual=cat_nombre,
                    categoria_recomendada=cat_recomendada,
                    score_promedio=score_promedio,
                    analisis_considerados=analisis_count,
                    nivel=nivel,
                    motivo=f"Score promedio {score_int}/100 en los últimos {analisis_count} análisis IA.",
                    recomendacion="Se recomienda evaluar el ascenso a la categoría superior.",
                    estado='ACTIVA'
                )
                generadas += 1
                
                if nivel == 'LISTO_PARA_ASCENSO':
                    Notificacion.objects.create(
                        usuario=request.user if request.user.is_authenticated else None,
                        club=equipo.club,
                        tipo='OTRO',
                        titulo='Nuevo Talento Destacado',
                        cuerpo=f"Nuevo talento destacado detectado: {jugador.nombre} {jugador.apellido} tiene recomendación de ascenso.",
                        data_extra={"recomendacion_id": str(recomendacion.id)}
                    )
                    
        if generadas == 0 and actualizadas == 0:
            return Response({
                "mensaje": "No hay jugadores con al menos 3 análisis IA completados.",
                "recomendaciones_generadas": generadas,
                "recomendaciones_actualizadas": actualizadas,
                "jugadores_omitidos_por_datos_insuficientes": omitidos
            })
        return Response({
            "mensaje": "Recomendaciones generadas correctamente.",
            "recomendaciones_generadas": generadas,
            "recomendaciones_actualizadas": actualizadas,
            "jugadores_omitidos_por_datos_insuficientes": omitidos
        })

class MarcarRecomendacionRevisadaView(APIView):
    def post(self, request, id):
        try:
            rec = RecomendacionAscenso.objects.get(id=id)
        except RecomendacionAscenso.DoesNotExist:
            return Response({"error": "No encontrada."}, status=404)
            
        rec.estado = 'REVISADA'
        rec.revisada_en = timezone.now()
        rec.save()
        return Response(RecomendacionAscensoSerializer(rec).data)

class CrearSeguimientoRecomendacionView(APIView):
    def post(self, request, id):
        accion = request.data.get('accion_seguimiento')
        if not accion:
            return Response({"error": "Se requiere accion_seguimiento."}, status=400)
            
        try:
            rec = RecomendacionAscenso.objects.get(id=id)
        except RecomendacionAscenso.DoesNotExist:
            return Response({"error": "No encontrada."}, status=404)
            
        rec.estado = 'SEGUIMIENTO'
        rec.accion_seguimiento = accion
        rec.save()
        return Response({"mensaje": "Acción de seguimiento registrada correctamente."})
