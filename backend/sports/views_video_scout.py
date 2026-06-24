from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from collections import defaultdict

from .models import Partido, TutorJugador
from notifications.models import Notificacion
from .video_scout import generate_video_scout_clips, get_match_clips, get_player_clips

class VideoScoutClipsView(APIView):
    def get(self, request, id):
        partido = get_object_or_404(Partido, id=id)
        clips = get_match_clips(partido)
        return Response({"clips": clips}, status=status.HTTP_200_OK)

    def post(self, request, id):
        partido = get_object_or_404(Partido, id=id)
        eventos = request.data.get('eventos', [])
        
        if not eventos:
            return Response({"error": "Debe proporcionar una lista de eventos."}, status=status.HTTP_400_BAD_REQUEST)
            
        # Validación de eventos
        for evento in eventos:
            if not evento.get('jugador_id') or evento.get('minuto') is None:
                return Response({"error": "Cada evento debe tener jugador_id y minuto."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            clips = generate_video_scout_clips(partido, eventos)
            return Response({
                "mensaje": "Clips generados exitosamente.",
                "clips": clips
            }, status=status.HTTP_201_CREATED)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except RuntimeError as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class CompartirVideoScoutClipsPadresView(APIView):
    def post(self, request, id):
        partido = get_object_or_404(Partido, id=id)
        clips = get_match_clips(partido)
        
        if not clips:
            return Response({"error": "No hay clips generados para este partido."}, status=status.HTTP_400_BAD_REQUEST)
            
        clips_por_jugador = defaultdict(list)
        for clip in clips:
            if clip.get('enviar_padres'):
                clips_por_jugador[clip['jugador_id']].append(clip)
                
        if not clips_por_jugador:
            return Response({"error": "Ningún clip está marcado para enviar a los padres."}, status=status.HTTP_400_BAD_REQUEST)
            
        notificaciones_creadas = 0
        
        for jugador_id, clips_jugador in clips_por_jugador.items():
            tutores = TutorJugador.objects.filter(jugador_id=jugador_id)
            if not tutores.exists():
                continue
                
            jugador_nombre = clips_jugador[0].get('jugador_nombre', 'Jugador')
                
            for tutor in tutores:
                Notificacion.objects.create(
                    usuario=tutor.usuario,
                    club=partido.equipo.club,
                    tipo='NUEVO_INFORME',
                    titulo=f'Nuevos clips de video de {jugador_nombre}',
                    cuerpo=f'Se han generado {len(clips_jugador)} nuevos clips del último partido.',
                    data_extra={
                        'tipo': 'VIDEO_SCOUT_CLIPS',
                        'partido_id': str(partido.id),
                        'jugador_id': jugador_id,
                        'jugador_nombre': jugador_nombre,
                        'clips': clips_jugador
                    }
                )
                notificaciones_creadas += 1
                
        return Response({
            "mensaje": f"Se han enviado {notificaciones_creadas} notificaciones a los padres."
        }, status=status.HTTP_200_OK)

class JugadorVideoScoutClipsView(APIView):
    def get(self, request, jugador_id):
        clips = get_player_clips(jugador_id)
        return Response({"clips": clips}, status=status.HTTP_200_OK)
