import uuid
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from sports.models import Equipo, JugadorEquipo, Partido, VideoPartido, InformeScouting

class Command(BaseCommand):
    help = 'Crea datos de prueba para HU-25 Recomendar ascenso de categoría sin crear videos reales'

    def handle(self, *args, **kwargs):
        self.stdout.write(self.style.WARNING('Iniciando creación de datos de prueba para HU-25...'))

        # Buscar el equipo 'Los Ludolovers' o el primero disponible
        equipo = Equipo.objects.filter(nombre__icontains='ludolovers').first()
        if not equipo:
            equipo = Equipo.objects.first()

        if not equipo:
            self.stdout.write(self.style.ERROR('No se encontró ningún equipo en la base de datos. Ejecuta seed_talentai primero.'))
            return

        self.stdout.write(self.style.SUCCESS(f'Equipo seleccionado: {equipo.nombre}'))

        # Buscar jugadores activos en el equipo
        jugadores_rel = JugadorEquipo.objects.filter(equipo=equipo, activo=True)[:2]
        if len(jugadores_rel) < 2:
            self.stdout.write(self.style.ERROR('No hay suficientes jugadores activos en el equipo.'))
            return

        jugador1 = jugadores_rel[0].jugador
        jugador2 = jugadores_rel[1].jugador

        self.stdout.write(self.style.SUCCESS(f'Jugador 1 (para generar recomendación): {jugador1.nombre} {jugador1.apellido}'))
        self.stdout.write(self.style.SUCCESS(f'Jugador 2 (para no generar recomendación): {jugador2.nombre} {jugador2.apellido}'))

        # Buscar 3 partidos del equipo para asociar los informes (o crear partidos falsos si no hay suficientes)
        partidos = list(Partido.objects.filter(equipo=equipo)[:3])
        while len(partidos) < 3:
            nuevo_partido = Partido.objects.create(
                id=uuid.uuid4(),
                equipo=equipo,
                nombre_rival="Rival de Prueba",
                fecha=timezone.now() - timedelta(days=len(partidos) * 7),
                goles_local=2,
                goles_rival=1,
                creado_en=timezone.now(),
                actualizado_en=timezone.now()
            )
            partidos.append(nuevo_partido)

        # Crear 3 informes para el Jugador 1 (scores: 84, 86, 88)
        scores_jugador1 = [84, 86, 88]
        for i, partido in enumerate(partidos):
            # Asegurarse de que el partido tenga VideoPartido
            video, created = VideoPartido.objects.get_or_create(
                partido=partido,
                defaults={
                    'analisis_estado': 'COMPLETADO',
                }
            )
            # Si ya existía y su estado no es COMPLETADO, forzarlo (solo para la prueba, pero respetando la base)
            if video.analisis_estado != 'COMPLETADO':
                video.analisis_estado = 'COMPLETADO'
                video.save()

            metricas_json = {
                "resumen_tactico": "El jugador mantiene rendimiento superior en la categoría actual.",
                "metricas_jugadores": [
                    {
                        "jugador_id": str(jugador1.id),
                        "nombre_completo": f"{jugador1.nombre} {jugador1.apellido}",
                        "score": scores_jugador1[i],
                        "compatibilidad": 88,
                        "perfil_sugerido": "Categoría superior",
                        "observacion": "Rendimiento consistente en los últimos análisis."
                    }
                ],
                "recomendaciones": [
                    "Realizar seguimiento técnico para posible ascenso de categoría."
                ],
                "heatmap_url": None
            }

            # Si es el informe 1 o 2, agregar también datos del Jugador 2 (score 80, no llega al promedio y solo tiene 2 análisis)
            if i < 2:
                metricas_json["metricas_jugadores"].append({
                    "jugador_id": str(jugador2.id),
                    "nombre_completo": f"{jugador2.nombre} {jugador2.apellido}",
                    "score": 80,
                    "compatibilidad": 80,
                    "perfil_sugerido": "Misma categoría",
                    "observacion": "Buen rendimiento, mantener trabajo actual."
                })

            # Crear o actualizar el InformeScouting
            informe, inf_created = InformeScouting.objects.get_or_create(
                partido=partido,
                defaults={
                    'video': video,
                    'resumen': "Análisis IA generado por seed para HU-25",
                    'metricas_json': metricas_json
                }
            )
            if not inf_created:
                informe.video = video
                informe.metricas_json = metricas_json
                informe.save()

        self.stdout.write(self.style.SUCCESS(f'\nSe crearon 3 informes IA para {jugador1.nombre} {jugador1.apellido} con scores {scores_jugador1}'))
        self.stdout.write(self.style.SUCCESS(f'Se crearon 2 informes IA para {jugador2.nombre} {jugador2.apellido} con scores [80, 80]'))
        self.stdout.write(self.style.SUCCESS('Completado. Ahora puedes probar el botón en la interfaz.'))
