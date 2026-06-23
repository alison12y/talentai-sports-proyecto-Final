from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
from .models import Partido, VideoPartido, InformeScouting
from .tasks import procesar_video_partido
import boto3
import uuid
from botocore.exceptions import NoCredentialsError, ClientError
from notifications.models import Notificacion
from .models import JugadorEquipo, TutorJugador
from .tasks import generar_metricas_informe, generar_heatmap_tactico
class SubirVideoPartidoView(APIView):
    def post(self, request, id):
        try:
            partido = Partido.objects.get(id=id)
        except Partido.DoesNotExist:
            return Response({"error": "Partido no encontrado."}, status=status.HTTP_404_NOT_FOUND)

        if 'video' not in request.FILES:
            return Response({"error": "No se envió ningún archivo."}, status=status.HTTP_400_BAD_REQUEST)

        video_file = request.FILES['video']
        
        # Validations
        if video_file.size > 500 * 1024 * 1024:
            return Response({"error": "El video no puede superar 500MB."}, status=status.HTTP_400_BAD_REQUEST)
        
        allowed_extensions = ['.mp4', '.mov']
        ext = ''
        if '.' in video_file.name:
            ext = '.' + video_file.name.split('.')[-1].lower()
            
        if ext not in allowed_extensions:
            return Response({"error": "El archivo debe ser MP4 o MOV."}, status=status.HTTP_400_BAD_REQUEST)

        video_partido, _ = VideoPartido.objects.get_or_create(partido=partido)
        
        key = f"videos/partidos/{partido.id}/{uuid.uuid4()}{ext}"
        
        video_partido.video_nombre_original = video_file.name
        video_partido.video_tamano = video_file.size
        video_partido.video_content_type = video_file.content_type
        video_partido.analisis_estado = VideoPartido.EstadoAnalisis.PENDIENTE
        video_partido.analisis_progreso = 0
        
        # Upload to R2 if configured, otherwise fake it (local fallback)
        if settings.R2_ENDPOINT_URL and settings.R2_ACCESS_KEY_ID:
            s3 = boto3.client('s3',
                endpoint_url=settings.R2_ENDPOINT_URL,
                aws_access_key_id=settings.R2_ACCESS_KEY_ID,
                aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY
            )
            try:
                s3.upload_fileobj(video_file, settings.R2_BUCKET_NAME, key, ExtraArgs={'ContentType': video_file.content_type})
                video_partido.video_key = key
                if settings.R2_PUBLIC_URL:
                    video_partido.video_url = f"{settings.R2_PUBLIC_URL}/{key}"
            except Exception as e:
                return Response({"error": f"Error subiendo a R2: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        else:
            # Fallback de desarrollo para no romper la app si faltan credenciales
            # Guardar el archivo localmente
            import os
            from django.core.files.storage import FileSystemStorage
            
            # Crear directorio si no existe
            media_path = os.path.join(settings.MEDIA_ROOT, 'videos', 'partidos', str(partido.id))
            os.makedirs(media_path, exist_ok=True)
            
            # Guardar archivo
            fs = FileSystemStorage(location=settings.MEDIA_ROOT)
            fs.save(key, video_file)
            
            video_partido.video_key = key
            video_partido.video_url = f"{settings.MEDIA_URL}{key}"
            
        video_partido.save()
        
        procesar_video_partido.delay(video_partido.id)
        
        return Response({
            "partido_id": partido.id,
            "video_nombre_original": video_partido.video_nombre_original,
            "video_tamano": video_partido.video_tamano,
            "video_url": video_partido.video_url,
            "analisis_estado": video_partido.analisis_estado,
            "analisis_progreso": video_partido.analisis_progreso
        })

class EstadoAnalisisVideoView(APIView):
    def get(self, request, id):
        try:
            partido = Partido.objects.get(id=id)
        except Partido.DoesNotExist:
            return Response({"error": "Partido no encontrado."}, status=status.HTTP_404_NOT_FOUND)
            
        try:
            video_partido = VideoPartido.objects.get(partido=partido)
        except VideoPartido.DoesNotExist:
            return Response({
                "analisis_estado": "SIN_VIDEO",
                "analisis_progreso": 0,
                "mensaje": "No hay video cargado para este partido."
            })
            
        response_data = {
            "analisis_estado": video_partido.analisis_estado,
            "analisis_progreso": video_partido.analisis_progreso,
            "analisis_error": video_partido.analisis_error,
            "video_nombre_original": video_partido.video_nombre_original,
            "video_tamano": video_partido.video_tamano,
            "video_subido_en": video_partido.creado_en,
            "video_url": video_partido.video_url,
            "mensaje": f"Estado del análisis: {video_partido.get_analisis_estado_display()}"
        }
        
        try:
            informe = InformeScouting.objects.get(partido=partido)
            response_data["informe_id"] = informe.id
            response_data["informe_disponible"] = True
        except InformeScouting.DoesNotExist:
            response_data["informe_id"] = None
            response_data["informe_disponible"] = False
            
        return Response(response_data)

class InformeScoutingVideoView(APIView):
    def get(self, request, id):
        try:
            partido = Partido.objects.get(id=id)
        except Partido.DoesNotExist:
            return Response({"error": "Partido no encontrado."}, status=status.HTTP_404_NOT_FOUND)
            
        informe = InformeScouting.objects.filter(partido_id=id).first()
        if not informe:
            return Response({"error": "El informe todavía no está disponible."}, status=status.HTTP_404_NOT_FOUND)
            
        try:
            video_partido = VideoPartido.objects.get(partido=partido)
            analisis_estado = video_partido.analisis_estado
            analisis_progreso = video_partido.analisis_progreso
        except VideoPartido.DoesNotExist:
            analisis_estado = "SIN_VIDEO"
            analisis_progreso = 0

        resumen = informe.resumen
        if resumen and "Modelo base generado correctamente" in resumen:
            resumen = resumen.replace(
                "Modelo base generado correctamente",
                "El video fue recibido correctamente y el informe de scouting quedó disponible para revisión."
            )
            
        metricas = informe.metricas_json or {}
        
        # Si el informe tiene la estructura antigua o le falta el heatmap, lo regeneramos
        if "metricas_jugadores" not in metricas or not metricas.get("heatmap_url"):
            metricas = generar_metricas_informe(partido)
            informe.metricas_json = metricas
            informe.save()
        else:
            # Forzar la regeneración de la imagen física para aplicar el nuevo diseño a informes existentes
            generar_heatmap_tactico(partido.id, metricas.get("metricas_jugadores"))

        return Response({
            "id": informe.id,
            "partido_id": partido.id,
            "video_id": informe.video_id,
            "video_url": video_partido.video_url if 'video_partido' in locals() else None,
            "resumen": resumen,
            "metricas_json": metricas,
            "creado_en": informe.creado_en,
            "actualizado_en": informe.actualizado_en,
            "analisis_estado": analisis_estado,
            "analisis_progreso": analisis_progreso
        })

class CompartirInformePadresView(APIView):
    def post(self, request, id):
        try:
            partido = Partido.objects.get(id=id)
        except Partido.DoesNotExist:
            return Response({"error": "Partido no encontrado."}, status=status.HTTP_404_NOT_FOUND)
            
        informe = InformeScouting.objects.filter(partido_id=id).first()
        if not informe:
            return Response({"error": "El informe no está disponible para compartir."}, status=status.HTTP_400_BAD_REQUEST)
            
        # Find parents and send notifications
        equipo = partido.equipo
        if equipo:
            try:
                relaciones = JugadorEquipo.objects.filter(equipo=equipo, activo=True)
                padres_notificados = set()
                cantidad = 0
                for rel in relaciones:
                    tutores = TutorJugador.objects.filter(jugador=rel.jugador)
                    for tutor in tutores:
                        if tutor.usuario and tutor.usuario.id not in padres_notificados:
                            Notificacion.objects.create(
                                usuario=tutor.usuario,
                                tipo="NUEVO_INFORME",
                                titulo="Informe de scouting disponible",
                                cuerpo="El informe de scouting de su hijo ya está disponible.",
                                data_extra={"partido_id": str(partido.id), "informe_id": str(informe.id), "tipo": "informe_scouting"},
                                leida=False
                            )
                            padres_notificados.add(tutor.usuario.id)
                            cantidad += 1
                            
                if cantidad == 0:
                     return Response({"mensaje": "No se encontraron padres vinculados a los jugadores del partido.", "notificaciones_creadas": 0}, status=status.HTTP_200_OK)
                     
                return Response({"mensaje": "Informe compartido con los padres correctamente.", "notificaciones_creadas": cantidad}, status=status.HTTP_200_OK)
            except Exception as e:
                return Response({"error": "Ocurrió un error al intentar compartir el informe con los padres."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
        return Response({"error": "El partido no tiene un equipo asignado."}, status=status.HTTP_400_BAD_REQUEST)
