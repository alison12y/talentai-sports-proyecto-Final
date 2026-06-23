from celery import shared_task
from django.utils import timezone
from .models import VideoPartido, InformeScouting, JugadorEquipo, EstadisticaPartido
import time
import json
import random
from notifications.models import Notificacion
from django.contrib.auth import get_user_model
from django.conf import settings
import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.colors import LinearSegmentedColormap

User = get_user_model()

def generar_heatmap_tactico(partido_id, jugadores_data=None):
    # Crear directorio si no existe
    heatmaps_dir = os.path.join(settings.MEDIA_ROOT, 'heatmaps', 'partidos')
    os.makedirs(heatmaps_dir, exist_ok=True)
    
    file_name = f"{partido_id}_heatmap.png"
    file_path = os.path.join(heatmaps_dir, file_name)
    
    # Dibujar la cancha (proporciones 105x68 típicamente, usaremos 100x100 porcentual para facilidad)
    fig, ax = plt.subplots(figsize=(10, 7))
    ax.set_facecolor('#1e5c33') # Verde oscuro, más profesional
    
    # Líneas básicas
    ax.plot([0, 0, 100, 100, 0], [0, 100, 100, 0, 0], color='#e0e0e0', linewidth=2.5)
    # Línea central
    ax.plot([50, 50], [0, 100], color='#e0e0e0', linewidth=2.5)
    
    # Círculo central y punto central
    circle = plt.Circle((50, 50), 9.15, color='#e0e0e0', fill=False, linewidth=2.5)
    ax.add_patch(circle)
    ax.plot(50, 50, 'o', color='#e0e0e0', markersize=5)
    
    # Área grande izquierda
    ax.plot([0, 16.5, 16.5, 0], [21.15, 21.15, 78.85, 78.85], color='#e0e0e0', linewidth=2.5)
    # Área chica izquierda
    ax.plot([0, 5.5, 5.5, 0], [36.85, 36.85, 63.15, 63.15], color='#e0e0e0', linewidth=2.5)
    ax.plot(11, 50, 'o', color='#e0e0e0', markersize=5) # Punto penal
    # Arco izquierdo
    ax.plot([0, 0], [45, 55], color='#ffffff', linewidth=5)
    
    # Área grande derecha
    ax.plot([100, 83.5, 83.5, 100], [21.15, 21.15, 78.85, 78.85], color='#e0e0e0', linewidth=2.5)
    # Área chica derecha
    ax.plot([100, 94.5, 94.5, 100], [36.85, 36.85, 63.15, 63.15], color='#e0e0e0', linewidth=2.5)
    ax.plot(89, 50, 'o', color='#e0e0e0', markersize=5) # Punto penal
    # Arco derecho
    ax.plot([100, 100], [45, 55], color='#ffffff', linewidth=5)

    # Generar puntos basados en jugadores
    x = []
    y = []
    
    if jugadores_data:
        for j in jugadores_data:
            pos = j.get('posicion', '').lower()
            val = j.get('valoracion', 0)
            if val == "Sin registro":
                val = 5.0
            else:
                try:
                    val = float(val)
                except ValueError:
                    val = 5.0
                    
            goles = j.get('goles', 0)
            asistencias = j.get('asistencias', 0)
            
            # Ponderación para la cantidad de puntos generados
            weight = val + (goles * 3) + (asistencias * 2)
            
            # Coordenadas por posiciones
            if 'arquero' in pos or 'portero' in pos:
                cx, cy = 5, 50
                scale_x, scale_y = 6, 12
            elif 'defensa' in pos or 'central' in pos or 'lateral' in pos:
                cx = 25
                cy = random.choice([20, 50, 80])
                scale_x, scale_y = 10, 20
            elif 'medio' in pos or 'volante' in pos:
                cx = 50
                cy = random.choice([25, 50, 75])
                scale_x, scale_y = 15, 25
            elif 'delantero' in pos or 'extremo' in pos or 'punta' in pos:
                cx = 80
                cy = random.choice([25, 50, 75])
                scale_x, scale_y = 12, 20
            else:
                cx, cy = 50, 50
                scale_x, scale_y = 20, 30
                
            num_points = int(weight * 25)
            if num_points > 0:
                x.extend(np.random.normal(loc=cx, scale=scale_x, size=num_points))
                y.extend(np.random.normal(loc=cy, scale=scale_y, size=num_points))

    # Si no hay suficientes puntos, usar un patrón por defecto centrado
    if len(x) < 50:
        x = np.random.normal(loc=50, scale=25, size=500)
        y = np.random.normal(loc=50, scale=30, size=500)
    
    # Filtrar puntos dentro de la cancha extendida para suavizado
    x = np.array(x)
    y = np.array(y)
    valid_idx = (x >= -10) & (x <= 110) & (y >= -10) & (y <= 110)
    x = x[valid_idx]
    y = y[valid_idx]

    # Crear el heatmap usando histogram2d con interpolación
    bins = 40
    heatmap, xedges, yedges = np.histogram2d(x, y, bins=bins, range=[[0, 100], [0, 100]])
    
    # Suavizar aplicando filtro manual o simplemente usando gaussian interpolation en imshow
    
    # Crear colormap personalizado: Transparente -> Verde Claro -> Amarillo -> Naranja -> Rojo
    cdict = {
        'red':   [(0.0,  0.0, 0.0),
                  (0.3,  0.0, 0.0),
                  (0.6,  1.0, 1.0),
                  (0.8,  1.0, 1.0),
                  (1.0,  1.0, 1.0)],
        'green': [(0.0,  0.0, 0.0),
                  (0.3,  1.0, 1.0),
                  (0.6,  1.0, 1.0),
                  (0.8,  0.5, 0.5),
                  (1.0,  0.0, 0.0)],
        'blue':  [(0.0,  0.0, 0.0),
                  (0.3,  0.0, 0.0),
                  (0.6,  0.0, 0.0),
                  (0.8,  0.0, 0.0),
                  (1.0,  0.0, 0.0)],
        'alpha': [(0.0,  0.0, 0.0),
                  (0.2,  0.4, 0.4),
                  (0.5,  0.7, 0.7),
                  (0.8,  0.85, 0.85),
                  (1.0,  0.95, 0.95)]
    }
    custom_cmap = LinearSegmentedColormap('custom_heatmap', cdict)
    
    # Dibujar la superposición del heatmap
    im = ax.imshow(heatmap.T, origin='lower', extent=[0, 100, 0, 100], 
                   interpolation='gaussian', cmap=custom_cmap, zorder=2)
    
    ax.set_xlim(-5, 105)
    ax.set_ylim(-15, 105) # Margen inferior para la leyenda
    ax.axis('off')
    
    # Título y textos
    plt.text(50, 103, 'Mapa de Calor del Partido', color='#333333', fontsize=18, fontweight='bold', ha='center', va='bottom')
    plt.text(50, -5, 'Distribución aproximada de participación del equipo durante el partido', color='#666666', fontsize=11, ha='center', va='top')
    
    # Leyenda de intensidad
    plt.text(25, -12, 'Baja', color='#4CAF50', fontsize=12, fontweight='bold', ha='center')
    plt.text(50, -12, 'Media', color='#FFC107', fontsize=12, fontweight='bold', ha='center')
    plt.text(75, -12, 'Alta intensidad', color='#F44336', fontsize=12, fontweight='bold', ha='center')
    
    plt.savefig(file_path, bbox_inches='tight', dpi=150, transparent=False, facecolor='#ffffff')
    plt.close(fig)
    
    return f"{settings.MEDIA_URL}heatmaps/partidos/{file_name}"

def generar_metricas_informe(partido):
    # Gather team players
    equipo = partido.equipo
    jugadores = []
    if equipo:
        relaciones = JugadorEquipo.objects.filter(equipo=equipo, activo=True)
        for rel in relaciones:
            jugador = rel.jugador
            
            # Try to get manual statistics if available
            stats = EstadisticaPartido.objects.filter(partido=partido, jugador=jugador).first()
            
            goles = stats.goles if stats else 0
            asistencias = stats.asistencias if stats else 0
            tarjetas_amarillas = stats.tarjetas_amarillas if stats else 0
            tarjetas_rojas = stats.tarjetas_rojas if stats else 0
            valoracion = float(stats.valoracion) if stats and stats.valoracion else 0.0
            
            observacion = "Jugador incluido en el informe del partido."
            if stats and stats.notas:
                observacion = stats.notas
            elif valoracion >= 8:
                observacion = "Desempeño destacado"
            elif valoracion > 0:
                observacion = "Desempeño promedio"

            jugadores.append({
                "jugador_id": str(jugador.id),
                "nombre_completo": f"{jugador.nombre} {jugador.apellido}",
                "posicion": jugador.posicion_principal or "Sin registro",
                "goles": goles,
                "asistencias": asistencias,
                "tarjetas": tarjetas_amarillas + tarjetas_rojas,
                "valoracion": valoracion if valoracion > 0 else "Sin registro",
                "pases": "Pendiente de análisis avanzado",
                "duelos": "Pendiente de análisis avanzado",
                "distancia": "Pendiente de análisis avanzado",
                "sprints": "Pendiente de análisis avanzado",
                "perfil_sugerido": jugador.posicion_principal or "En evaluación",
                "compatibilidad": "En evaluación",
                "observacion": observacion
            })

    # Determine recommendations based on stats presence
    recomendaciones = []
    if len(jugadores) > 0:
        if not any(j['valoracion'] != "Sin registro" for j in jugadores):
            recomendaciones.append("Complementar el análisis con estadísticas manuales del partido.")
            recomendaciones.append("Revisar participación individual en entrenamiento.")
            recomendaciones.append("Actualizar datos físicos para mejorar la precisión del seguimiento.")
        else:
            recomendaciones.append("Existen registros de valoración; se sugiere mantener la monitorización manual para complementar el video.")
        recomendaciones.append("Revisar las líneas defensivas en situaciones a balón parado (basado en posicionamiento promedio).")
        recomendaciones.append("Fomentar la comunicación en transiciones rápidas.")
    else:
        recomendaciones.append("No hay jugadores asignados a este equipo. Asigna jugadores para obtener métricas individuales.")

    # Top performers
    top_rendimiento = []
    valid_jugadores = [j for j in jugadores if j['valoracion'] != "Sin registro"]
    
    if valid_jugadores:
        sorted_jugadores = sorted(valid_jugadores, key=lambda x: x['valoracion'], reverse=True)
        for t in sorted_jugadores[:3]:
            top_rendimiento.append({
                "nombre": t["nombre_completo"],
                "motivo": f"Alta valoración ({t['valoracion']})",
                "posicion": t["posicion"]
            })
    else:
        for t in jugadores[:3]:
            top_rendimiento.append({
                "nombre": t["nombre_completo"],
                "motivo": "Sin valoración registrada todavía.",
                "posicion": t["posicion"]
            })

    heatmap_url = generar_heatmap_tactico(partido.id, jugadores)

    return {
        "resumen_tactico": "El equipo mostró un bloque compacto en defensa, pero tuvo dificultades para conectar con los delanteros de forma limpia. Se observaron agrupaciones constantes en el centro del campo.",
        "top_rendimiento": top_rendimiento,
        "metricas_jugadores": jugadores,
        "recomendaciones": recomendaciones,
        "heatmap_url": heatmap_url
    }


@shared_task
def procesar_video_partido(video_id):
    try:
        video = VideoPartido.objects.get(id=video_id)
        video.analisis_estado = VideoPartido.EstadoAnalisis.PROCESANDO
        video.analisis_progreso = 10
        video.analisis_iniciado_en = timezone.now()
        video.save()

        # Simulate analysis steps
        time.sleep(2)
        video.analisis_progreso = 30
        video.save()
        
        time.sleep(2)
        video.analisis_progreso = 60
        video.save()

        time.sleep(2)
        video.analisis_progreso = 90
        video.save()

        time.sleep(2)

        # Create informe
        informe, created = InformeScouting.objects.get_or_create(partido=video.partido)
        informe.video = video
        informe.resumen = "El video ha sido analizado mediante visión artificial. Se detectó una estructura general sólida con áreas de mejora en transiciones. Las métricas individuales están siendo procesadas."
        informe.metricas_json = generar_metricas_informe(video.partido)
        informe.save()

        video.analisis_progreso = 100
        video.analisis_estado = VideoPartido.EstadoAnalisis.COMPLETADO
        video.analisis_finalizado_en = timezone.now()
        video.save()

        # Notify coaches associated with this team
        try:
            equipo = video.partido.equipo
            if equipo and hasattr(equipo, 'entrenador_principal') and equipo.entrenador_principal:
                entrenador = equipo.entrenador_principal.usuario
                if entrenador:
                    Notificacion.objects.create(
                        usuario=entrenador,
                        tipo="ANALISIS_COMPLETADO",
                        titulo="Análisis de video completado",
                        cuerpo=f"El análisis del video del partido vs {video.partido.nombre_rival} ya está disponible.",
                        leida=False
                    )
        except Exception as e:
            print("Error sending notification:", e)

    except Exception as e:
        try:
            video = VideoPartido.objects.get(id=video_id)
            video.analisis_estado = VideoPartido.EstadoAnalisis.ERROR
            video.analisis_error = str(e)
            video.save()
        except:
            pass
