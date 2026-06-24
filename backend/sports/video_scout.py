import os
import subprocess
import uuid
from django.conf import settings
from .models import InformeScouting, Jugador

def resolve_video_local_path(video_partido):
    if not video_partido:
        raise ValueError("El partido no tiene un video asociado.")
        
    video_path = None
    if video_partido.video_key:
        video_path = os.path.join(settings.MEDIA_ROOT, str(video_partido.video_key))
    elif video_partido.video_url:
        if video_partido.video_url.startswith(settings.MEDIA_URL):
            relative_path = video_partido.video_url[len(settings.MEDIA_URL):]
            video_path = os.path.join(settings.MEDIA_ROOT, relative_path)
        else:
            raise ValueError("El video no está en el almacenamiento local.")
    
    if not video_path or not os.path.exists(video_path):
        raise ValueError(f"No se encontró el archivo de video local en la ruta esperada: {video_path}")
        
    return video_path

def generate_video_scout_clips(partido, eventos):
    from .models import VideoPartido
    
    try:
        video_partido = VideoPartido.objects.get(partido=partido)
    except VideoPartido.DoesNotExist:
        raise ValueError("El partido no tiene un video registrado.")
        
    video_path = resolve_video_local_path(video_partido)
    
    # Check if ffmpeg is available
    try:
        subprocess.run(['ffmpeg', '-version'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    except (FileNotFoundError, subprocess.CalledProcessError):
        raise RuntimeError("Se requiere ffmpeg para procesar los clips de video. Por favor, instálelo en el servidor.")
        
    clips_dir_relative = os.path.join('clips', 'partidos', str(partido.id))
    clips_dir = os.path.join(settings.MEDIA_ROOT, clips_dir_relative)
    os.makedirs(clips_dir, exist_ok=True)
    
    generated_clips = []
    
    for evento in eventos:
        jugador_id = evento.get('jugador_id')
        minuto = evento.get('minuto')
        if not jugador_id or minuto is None:
            continue
            
        try:
            minuto_int = int(minuto)
        except ValueError:
            continue
            
        tipo = evento.get('tipo', 'ACCION_DESTACADA')
        tipo_label = tipo.replace('_', ' ').title()
        

        start_second = max(0, (minuto_int * 60) - 5)
        duration = 15 # 15 seconds clip
        end_second = start_second + duration
        
        clip_filename = f"{uuid.uuid4()}_{tipo}.mp4"
        clip_path = os.path.join(clips_dir, clip_filename)
        
 
        cmd = [
            'ffmpeg',
            '-y', # Overwrite output files without asking
            '-i', video_path,
            '-ss', str(start_second),
            '-t', str(duration),
            '-c:v', 'libx264', # Re-encode to ensure compatibility
            '-c:a', 'aac',
            clip_path
        ]
        
        try:
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        except subprocess.CalledProcessError as e:
            continue # Skip this clip if there's an error
            
        clip_url = settings.MEDIA_URL + f"clips/partidos/{partido.id}/{clip_filename}"
        
        jugador_nombre = evento.get('jugador_nombre')
        if not jugador_nombre:
            try:
                jugador = Jugador.objects.get(id=jugador_id)
                jugador_nombre = f"{jugador.usuario.first_name} {jugador.usuario.last_name}".strip()
            except Jugador.DoesNotExist:
                jugador_nombre = "Jugador Desconocido"
                
        generated_clips.append({
            'jugador_id': str(jugador_id),
            'jugador_nombre': jugador_nombre,
            'tipo': tipo,
            'tipo_label': tipo_label,
            'minuto': minuto_int,
            'descripcion': evento.get('descripcion', ''),
            'inicio_segundo': start_second,
            'fin_segundo': end_second,
            'clip_url': clip_url,
            'enviar_padres': evento.get('enviar_padres', False),
            'mensaje_padre': f"Nuevo clip de {jugador_nombre}: {tipo_label} en el minuto {minuto_int}"
        })
        
    if not generated_clips:
        raise ValueError("No se pudo generar ningún clip de video. Verifique los eventos y el video.")
        
    informe, _ = InformeScouting.objects.get_or_create(partido=partido)
    metricas = informe.metricas_json or {}
    
    metricas['video_scout_clips'] = generated_clips
    metricas['video_scout_resumen'] = f"Se generaron {len(generated_clips)} clips de video para el partido."
    
    informe.metricas_json = metricas
    informe.save()
    
    return generated_clips

def get_match_clips(partido):
    try:
        informe = InformeScouting.objects.get(partido=partido)
        metricas = informe.metricas_json or {}
        return metricas.get('video_scout_clips', [])
    except InformeScouting.DoesNotExist:
        return []

def get_player_clips(jugador_id):
    clips_jugador = []
    informes = InformeScouting.objects.filter(metricas_json__has_key='video_scout_clips')
    
    for informe in informes:
        clips = informe.metricas_json.get('video_scout_clips', [])
        for clip in clips:
            if str(clip.get('jugador_id')) == str(jugador_id):
                # Add match information if needed
                clip['partido_id'] = str(informe.partido.id)
                clip['partido_nombre'] = str(informe.partido)
                clips_jugador.append(clip)
                
    return clips_jugador
