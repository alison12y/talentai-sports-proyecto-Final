import random
import uuid
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from users.models import Usuario, RolUsuario
from clubs.models import Club
from sports.models import (
    Equipo, Jugador, JugadorEquipo, TutorJugador, Evento, Partido, 
    Convocatoria, Asistencia, EstadisticaPartido, EvolucionFisica, 
    VideoPartido, InformeScouting, AlertaRiesgoLesion, RecomendacionAscenso,
    CategoriaDeportiva
)
from payments.models import Cuota, Pago
from notifications.models import Notificacion

class Command(BaseCommand):
    help = 'Crea datos de prueba coherentes para TalentAI Sports'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clean',
            action='store_true',
            help='Eliminar todos los datos de prueba creados por este script',
        )

    def handle(self, *args, **kwargs):
        clean = kwargs['clean']

        if clean:
            self.stdout.write(self.style.WARNING('Limpiando datos existentes...'))
            AlertaRiesgoLesion.objects.filter(jugador__club__nombre='Los Infieles FC').delete()
            RecomendacionAscenso.objects.filter(jugador__club__nombre='Los Infieles FC').delete()
            InformeScouting.objects.filter(partido__evento__club__nombre='Los Infieles FC').delete()
            VideoPartido.objects.filter(partido__evento__club__nombre='Los Infieles FC').delete()
            EstadisticaPartido.objects.filter(jugador__club__nombre='Los Infieles FC').delete()
            Asistencia.objects.filter(jugador__club__nombre='Los Infieles FC').delete()
            Convocatoria.objects.filter(jugador__club__nombre='Los Infieles FC').delete()
            Partido.objects.filter(evento__club__nombre='Los Infieles FC').delete()
            Evento.objects.filter(club__nombre='Los Infieles FC').delete()
            Pago.objects.filter(jugador__club__nombre='Los Infieles FC').delete()
            Cuota.objects.filter(club__nombre='Los Infieles FC').delete()
            EvolucionFisica.objects.filter(jugador__club__nombre='Los Infieles FC').delete()
            TutorJugador.objects.filter(jugador__club__nombre='Los Infieles FC').delete()
            JugadorEquipo.objects.filter(jugador__club__nombre='Los Infieles FC').delete()
            Jugador.objects.filter(club__nombre='Los Infieles FC').delete()
            Equipo.objects.filter(club__nombre='Los Infieles FC').delete()
            CategoriaDeportiva.objects.filter(club__nombre='Los Infieles FC').delete()
            Club.objects.filter(nombre='Los Infieles FC').delete()
            Usuario.objects.filter(email='entrenador@talentai.com').delete()
            Usuario.objects.filter(email__startswith='padre_').delete()
            self.stdout.write(self.style.SUCCESS('Datos limpios.'))
            return
            
        self.stdout.write(self.style.SUCCESS('Creando Club...'))
        club, _ = Club.objects.get_or_create(
            nombre='Los Infieles FC',
            defaults={
                'id': uuid.uuid4(),
                'slug': 'los-infieles-fc',
                'activo': True,
                'creado_en': timezone.now(),
                'actualizado_en': timezone.now()
            }
        )

        self.stdout.write(self.style.SUCCESS('Creando Usuarios...'))
        coach, _ = Usuario.objects.get_or_create(
            email='entrenador@talentai.com',
            defaults={
                'id': uuid.uuid4(),
                'nombre': 'Carlos',
                'apellido': 'Gómez',
                'password_hash': 'pbkdf2_sha256$600000$xxxx',
                'activo': True,
                'email_verificado': True,
                'creado_en': timezone.now(),
                'actualizado_en': timezone.now()
            }
        )
        
        self.stdout.write(self.style.SUCCESS('Creando Categorías...'))
        categorias_nombres = ['Sub-13', 'Sub-15', 'Sub-17', 'Sub-20']
        for cat_nom in categorias_nombres:
            CategoriaDeportiva.objects.get_or_create(
                nombre=cat_nom,
                club=club,
                defaults={
                    'activo': True,
                    'predefinida': False
                }
            )

        self.stdout.write(self.style.SUCCESS('Creando Equipos...'))
        equipo1, _ = Equipo.objects.get_or_create(
            nombre='Los Ludolovers Sub-15',
            club=club,
            defaults={
                'id': uuid.uuid4(),
                'categoria': 'Sub-15',
                'temporada': '2026',
                'activo': True,
                'creado_en': timezone.now(),
                'actualizado_en': timezone.now()
            }
        )

        equipo2, _ = Equipo.objects.get_or_create(
            nombre='Las Peridel Sub-17',
            club=club,
            defaults={
                'id': uuid.uuid4(),
                'categoria': 'Sub-17',
                'temporada': '2026',
                'activo': True,
                'creado_en': timezone.now(),
                'actualizado_en': timezone.now()
            }
        )

        self.stdout.write(self.style.SUCCESS('Creando Jugadores...'))
        posiciones = ['Arquero', 'Defensa', 'Mediocampista', 'Delantero']
        nombres = ['Renso', 'Diego', 'Thiago', 'Joaquín', 'Martín', 'Simón', 'Tomás', 'Nicolás', 'Facundo', 'Sebastián']
        apellidos = ['Rosas', 'Fernández', 'García', 'Díaz', 'Martínez', 'Sánchez', 'Romero', 'Pérez', 'Silva', 'López']

        jugadores_creados = []
        for i in range(10):
            j, _ = Jugador.objects.get_or_create(
                nombre=nombres[i],
                apellido=apellidos[i],
                club=club,
                defaults={
                    'id': uuid.uuid4(),
                    'fecha_nacimiento': timezone.now().date() - timedelta(days=365*(15 if i < 5 else 17)),
                    'posicion_principal': posiciones[i % len(posiciones)],
                    'estado': 'ACTIVO',
                    'creado_en': timezone.now(),
                    'actualizado_en': timezone.now()
                }
            )
            jugadores_creados.append(j)

        self.stdout.write(self.style.SUCCESS('Asignando Jugadores a Equipos...'))
        for i, j in enumerate(jugadores_creados):
            eq = equipo1 if i < 5 else equipo2
            JugadorEquipo.objects.get_or_create(
                jugador=j,
                equipo=eq,
                defaults={
                    'id': uuid.uuid4(),
                    'fecha_inicio': timezone.now().date() - timedelta(days=30),
                    'activo': True,
                    'creado_en': timezone.now()
                }
            )

        self.stdout.write(self.style.SUCCESS('Creando Tutores...'))
        for j in jugadores_creados[:5]:
            padre_email = f"padre_{j.nombre.lower().replace(' ', '')}@talentai.com"
            padre_usr, _ = Usuario.objects.get_or_create(
                email=padre_email,
                defaults={
                    'id': uuid.uuid4(),
                    'nombre': f"Padre de {j.nombre}",
                    'apellido': j.apellido,
                    'password_hash': 'dummy',
                    'activo': True,
                    'email_verificado': True,
                    'creado_en': timezone.now(),
                    'actualizado_en': timezone.now()
                }
            )
            TutorJugador.objects.get_or_create(
                jugador=j,
                usuario=padre_usr,
                defaults={
                    'id': uuid.uuid4(),
                    'parentesco': 'Padre',
                    'es_contacto_principal': True,
                    'creado_en': timezone.now()
                }
            )

        self.stdout.write(self.style.SUCCESS('Creando Eventos y Partidos...'))
        partidos_creados = []
        for i in range(5):
            ev_partido, _ = Evento.objects.get_or_create(
                titulo=f'Partido {i+1} de prueba',
                club=club,
                equipo=equipo1,
                defaults={
                    'id': uuid.uuid4(),
                    'tipo': 'PARTIDO',
                    'fecha_inicio': timezone.now() - timedelta(days=i*2 + 1),
                    'fecha_fin': timezone.now() - timedelta(days=i*2),
                    'estado': 'FINALIZADO',
                    'activo': True,
                    'creado_en': timezone.now(),
                    'actualizado_en': timezone.now()
                }
            )
            
            p, _ = Partido.objects.get_or_create(
                evento=ev_partido,
                defaults={
                    'id': uuid.uuid4(),
                    'equipo': equipo1,
                    'nombre_rival': f'Rival {i+1}',
                    'fecha': ev_partido.fecha_inicio,
                    'goles_local': random.randint(0, 5),
                    'goles_rival': random.randint(0, 5),
                    'resultado': 'VICTORIA' if i % 2 == 0 else 'EMPATE',
                    'notas_tacticas': 'Notas tácticas de este partido.',
                    'creado_en': timezone.now(),
                    'actualizado_en': timezone.now()
                }
            )
            partidos_creados.append(p)

        for i in range(5):
            Evento.objects.get_or_create(
                titulo=f'Entrenamiento {i+1} de prueba',
                club=club,
                equipo=equipo1,
                defaults={
                    'id': uuid.uuid4(),
                    'tipo': 'ENTRENAMIENTO',
                    'fecha_inicio': timezone.now() - timedelta(days=i*2 + 2),
                    'fecha_fin': timezone.now() - timedelta(days=i*2 + 1),
                    'estado': 'FINALIZADO',
                    'activo': True,
                    'creado_en': timezone.now(),
                    'actualizado_en': timezone.now()
                }
            )

        self.stdout.write(self.style.SUCCESS('Creando Convocatorias, Asistencias, Estadísticas y Evolución...'))
        estados_convocatoria = ['PENDIENTE', 'CONFIRMADO', 'RECHAZADO']
        for idx, partido in enumerate(partidos_creados):
            for j_idx, j in enumerate(jugadores_creados[:5]): 
                Convocatoria.objects.get_or_create(
                    evento=partido.evento,
                    jugador=j,
                    defaults={
                        'id': uuid.uuid4(),
                        'estado': random.choice(estados_convocatoria),
                        'creado_en': timezone.now(),
                        'actualizado_en': timezone.now()
                    }
                )
                Asistencia.objects.get_or_create(
                    evento=partido.evento,
                    jugador=j,
                    defaults={
                        'id': uuid.uuid4(),
                        'estado': 'PRESENTE',
                        'creado_en': timezone.now(),
                        'actualizado_en': timezone.now()
                    }
                )
                min_jugados = random.randint(45, 90)
                if j_idx == 0:
                    min_jugados = 80 # 80 * 5 = 400 (> 270 CRITICAL)
                elif j_idx == 1:
                    min_jugados = 45 # 45 * 5 = 225 (> 210 WARNING)
                    
                EstadisticaPartido.objects.get_or_create(
                    partido=partido,
                    jugador=j,
                    defaults={
                        'id': uuid.uuid4(),
                        'minutos_jugados': min_jugados,
                        'goles': random.randint(0, 2),
                        'asistencias': random.randint(0, 2),
                        'tarjetas_amarillas': random.randint(0, 1),
                        'tarjetas_rojas': 0,
                        'valoracion': Decimal(random.uniform(6.0, 9.5)).quantize(Decimal('0.01')),
                        'notas': 'Buen desempeño.',
                        'creado_en': timezone.now(),
                        'actualizado_en': timezone.now()
                    }
                )
        
        for j in jugadores_creados:
            for i in range(2):
                EvolucionFisica.objects.get_or_create(
                    jugador=j,
                    fecha=timezone.now().date() - timedelta(days=i*30),
                    defaults={
                        'id': uuid.uuid4(),
                        'peso_kg': Decimal(random.uniform(60.0, 80.0)).quantize(Decimal('0.01')),
                        'altura_cm': Decimal(random.uniform(160.0, 190.0)).quantize(Decimal('0.01')),
                        'velocidad_40m': Decimal(random.uniform(5.0, 7.0)).quantize(Decimal('0.01')),
                        'creado_en': timezone.now()
                    }
                )

        self.stdout.write(self.style.SUCCESS('Creando Cuotas y Pagos...'))
        for i in range(5):
            cuota, _ = Cuota.objects.get_or_create(
                concepto=f'Mensualidad {i} 2026',
                club=club,
                defaults={
                    'id': uuid.uuid4(),
                    'monto': Decimal('50.00'),
                    'moneda': 'USD',
                    'fecha_vencimiento': timezone.now().date(),
                    'estado': 'ACTIVA',
                    'creado_en': timezone.now(),
                    'actualizado_en': timezone.now()
                }
            )
            Pago.objects.get_or_create(
                cuota=cuota,
                jugador=jugadores_creados[i],
                defaults={
                    'id': uuid.uuid4(),
                    'monto': Decimal('50.00'),
                    'fecha_vencimiento': cuota.fecha_vencimiento,
                    'estado': random.choice(['PENDIENTE', 'PAGADO', 'VENCIDO']),
                    'creado_en': timezone.now(),
                    'actualizado_en': timezone.now()
                }
            )

        self.stdout.write(self.style.SUCCESS('Creando Notificaciones...'))
        for i in range(5):
            Notificacion.objects.get_or_create(
                usuario=coach,
                titulo=f'Aviso importante {i}',
                defaults={
                    'id': uuid.uuid4(),
                    'tipo': 'OTRO', # Tipo válido en choices
                    'cuerpo': 'Esta es una notificación de prueba.',
                    'creado_en': timezone.now(),
                    'actualizado_en': timezone.now()
                }
            )

        self.stdout.write(self.style.SUCCESS('Creando Alertas de Riesgo de Lesión...'))
        jugador_critical = jugadores_creados[0]
        jugador_warning = jugadores_creados[1]
        jugador_info = jugadores_creados[2]
        
        AlertaRiesgoLesion.objects.get_or_create(
            jugador=jugador_critical,
            equipo=equipo1,
            nivel='CRITICAL',
            defaults={
                'minutos_semana': 400,
                'score_riesgo': 90,
                'motivo': 'Exceso de minutos de juego y alta carga física.',
                'recomendacion': 'Descanso absoluto y evaluación médica.',
                'estado': 'ACTIVA'
            }
        )
        AlertaRiesgoLesion.objects.get_or_create(
            jugador=jugador_warning,
            equipo=equipo1,
            nivel='WARNING',
            defaults={
                'minutos_semana': 225,
                'score_riesgo': 75,
                'motivo': 'Acumulación de fatiga detectada.',
                'recomendacion': 'Reducir intensidad en el próximo entrenamiento.',
                'estado': 'ACTIVA'
            }
        )
        AlertaRiesgoLesion.objects.get_or_create(
            jugador=jugador_info,
            equipo=equipo1,
            nivel='INFO',
            defaults={
                'minutos_semana': 150,
                'score_riesgo': 40,
                'motivo': 'Carga regular dentro del límite.',
                'recomendacion': 'Continuar monitoreo habitual.',
                'estado': 'VISTA',
                'vista_en': timezone.now()
            }
        )

        self.stdout.write(self.style.SUCCESS('Creando Informes de Scouting para Recomendaciones de Ascenso (HU-25)...'))
        # Para jugador 0: renso rosas
        scores = [88, 86, 84]
        for idx, partido in enumerate(partidos_creados[:3]):
            # NO creamos archivo de video. Sólo InformeScouting con JSON.
            # Y si VideoPartido es obligatorio, lo asociamos sin url.
            video, _ = VideoPartido.objects.get_or_create(
                partido=partido,
                defaults={
                    'analisis_estado': 'COMPLETADO',
                }
            )
            if video.analisis_estado != 'COMPLETADO':
                video.analisis_estado = 'COMPLETADO'
                video.save()
                
            InformeScouting.objects.get_or_create(
                partido=partido,
                defaults={
                    'video': video,
                    'resumen': "Análisis IA generado por seed para HU-25",
                    'metricas_json': {
                        "metricas_jugadores": [
                            {
                                "jugador_id": str(jugador_critical.id),
                                "score": scores[idx],
                                "compatibilidad": 90.0,
                                "nombre_completo": f"{jugador_critical.nombre} {jugador_critical.apellido}"
                            }
                        ]
                    }
                }
            )
            
        # Creamos directamente una recomendación en SEGUIMIENTO para probar UI
        RecomendacionAscenso.objects.get_or_create(
            jugador=jugador_critical,
            equipo_actual=equipo1,
            defaults={
                'categoria_actual': 'Sub-15',
                'categoria_recomendada': 'Sub-17',
                'score_promedio': 86.0,
                'analisis_considerados': 3,
                'nivel': 'TALENTO_DESTACADO',
                'motivo': 'Score promedio 86/100 en los últimos 3 análisis IA.',
                'recomendacion': 'Se recomienda evaluar el ascenso a la categoría superior.',
                'estado': 'ACTIVA'
            }
        )

        self.stdout.write(self.style.SUCCESS('\nResumen:'))
        self.stdout.write(f"- Clubes: {Club.objects.count()}")
        self.stdout.write(f"- Categorías: {CategoriaDeportiva.objects.count()}")
        self.stdout.write(f"- Equipos: {Equipo.objects.count()}")
        self.stdout.write(f"- Jugadores: {Jugador.objects.count()}")
        self.stdout.write(f"- Tutores: {TutorJugador.objects.count()}")
        self.stdout.write(f"- Eventos: {Evento.objects.count()}")
        self.stdout.write(f"- Partidos: {Partido.objects.count()}")
        self.stdout.write(f"- Convocatorias: {Convocatoria.objects.count()}")
        self.stdout.write(f"- Asistencias: {Asistencia.objects.count()}")
        self.stdout.write(f"- Estadísticas: {EstadisticaPartido.objects.count()}")
        self.stdout.write(f"- Evolución Física: {EvolucionFisica.objects.count()}")
        self.stdout.write(f"- Cuotas: {Cuota.objects.count()}")
        self.stdout.write(f"- Pagos: {Pago.objects.count()}")
        self.stdout.write(f"- Notificaciones: {Notificacion.objects.count()}")
        self.stdout.write(f"- Alertas Lesión: {AlertaRiesgoLesion.objects.count()}")
        self.stdout.write(f"- Recomendaciones Ascenso: {RecomendacionAscenso.objects.count()}")
        self.stdout.write(self.style.SUCCESS('\nSeed TalentAI completado.'))
