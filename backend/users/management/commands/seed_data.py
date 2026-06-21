import uuid
from datetime import date

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from clubs.models import Club
from sports.models import (
    EntrenadorEquipo,
    Equipo,
    Jugador,
    JugadorEquipo,
    TutorJugador,
)
from users.models import EstadoUsuarioClub, RolUsuario, Usuario, UsuarioClub
from users.passwords import make_usuario_password


def update_instance(instance, fields):
    for field, value in fields.items():
        setattr(instance, field, value)
    instance.save(update_fields=list(fields.keys()))
    return instance


class Command(BaseCommand):
    help = 'Crea datos iniciales de prueba para TalentAI Sports.'

    @transaction.atomic
    def handle(self, *args, **options):
        now = timezone.now()

        club, created = Club.objects.get_or_create(
            slug='academia-oriente-fc',
            defaults={
                'id': uuid.uuid4(),
                'nombre': 'Academia Oriente FC',
                'descripcion': 'Club deportivo amateur para formación de jugadores jóvenes',
                'ciudad': 'Santa Cruz',
                'pais': 'Bolivia',
                'email_contacto': 'contacto@orienteacademy.com',
                'telefono': '70000000',
                'plan': 'BASICO',
                'activo': True,
                'creado_en': now,
                'actualizado_en': now,
            },
        )
        if not created:
            update_instance(club, {
                'nombre': 'Academia Oriente FC',
                'descripcion': 'Club deportivo amateur para formación de jugadores jóvenes',
                'ciudad': 'Santa Cruz',
                'pais': 'Bolivia',
                'email_contacto': 'contacto@orienteacademy.com',
                'telefono': '70000000',
                'plan': 'BASICO',
                'activo': True,
                'actualizado_en': now,
            })

        coordinador = self.create_or_update_usuario(
            email='coordinador@talentai.com',
            password='admin123',
            nombre='Carlos',
            apellido='Mendoza',
            telefono='70000001',
            now=now,
        )
        entrenador = self.create_or_update_usuario(
            email='entrenador@talentai.com',
            password='admin123',
            nombre='Luis',
            apellido='Rojas',
            telefono='70000002',
            now=now,
        )
        padre = self.create_or_update_usuario(
            email='padre@talentai.com',
            password='admin123',
            nombre='Mario',
            apellido='Vargas',
            telefono='70000003',
            now=now,
        )

        self.create_or_update_usuario_club(
            coordinador, club, RolUsuario.COORDINADOR, now,
        )
        self.create_or_update_usuario_club(
            entrenador, club, RolUsuario.ENTRENADOR, now,
        )
        self.create_or_update_usuario_club(
            padre, club, RolUsuario.PADRE, now,
        )

        equipo, created = Equipo.objects.get_or_create(
            club=club,
            nombre='Oriente Sub-15',
            temporada='2026',
            defaults={
                'id': uuid.uuid4(),
                'categoria': 'CADETE',
                'descripcion': 'Equipo formativo Sub-15',
                'activo': True,
                'creado_en': now,
                'actualizado_en': now,
            },
        )
        if not created:
            update_instance(equipo, {
                'categoria': 'CADETE',
                'descripcion': 'Equipo formativo Sub-15',
                'activo': True,
                'actualizado_en': now,
            })

        entrenador_equipo, created = EntrenadorEquipo.objects.get_or_create(
            equipo=equipo,
            usuario=entrenador,
            defaults={
                'id': uuid.uuid4(),
                'es_principal': True,
                'creado_en': now,
            },
        )
        if not created:
            update_instance(entrenador_equipo, {'es_principal': True})

        jugador, created = Jugador.objects.get_or_create(
            dni='12345678',
            defaults={
                'id': uuid.uuid4(),
                'club': club,
                'nombre': 'Diego',
                'apellido': 'Vargas',
                'fecha_nacimiento': date(2011, 5, 10),
                'posicion_principal': 'Delantero',
                'posicion_secundaria': 'Extremo derecho',
                'pie_dominante': 'Derecho',
                'numero_camiseta': 9,
                'estado': 'ACTIVO',
                'notas': 'Jugador con buen rendimiento ofensivo',
                'creado_en': now,
                'actualizado_en': now,
            },
        )
        if not created:
            update_instance(jugador, {
                'club': club,
                'nombre': 'Diego',
                'apellido': 'Vargas',
                'fecha_nacimiento': date(2011, 5, 10),
                'posicion_principal': 'Delantero',
                'posicion_secundaria': 'Extremo derecho',
                'pie_dominante': 'Derecho',
                'numero_camiseta': 9,
                'estado': 'ACTIVO',
                'notas': 'Jugador con buen rendimiento ofensivo',
                'actualizado_en': now,
            })

        jugador_equipo, created = JugadorEquipo.objects.get_or_create(
            jugador=jugador,
            equipo=equipo,
            defaults={
                'id': uuid.uuid4(),
                'fecha_inicio': date(2026, 4, 7),
                'activo': True,
                'creado_en': now,
            },
        )
        if not created:
            update_instance(jugador_equipo, {
                'fecha_inicio': date(2026, 4, 7),
                'activo': True,
            })

        tutor_jugador, created = TutorJugador.objects.get_or_create(
            jugador=jugador,
            usuario=padre,
            defaults={
                'id': uuid.uuid4(),
                'parentesco': 'Padre',
                'es_contacto_principal': True,
                'creado_en': now,
            },
        )
        if not created:
            update_instance(tutor_jugador, {
                'parentesco': 'Padre',
                'es_contacto_principal': True,
            })

        self.stdout.write(self.style.SUCCESS('Datos iniciales creados/actualizados correctamente.'))

    def create_or_update_usuario(self, email, password, nombre, apellido, telefono, now):
        password_hash = make_usuario_password(password)
        usuario, created = Usuario.objects.get_or_create(
            email=email,
            defaults={
                'id': uuid.uuid4(),
                'password_hash': password_hash,
                'nombre': nombre,
                'apellido': apellido,
                'telefono': telefono,
                'activo': True,
                'email_verificado': True,
                'creado_en': now,
                'actualizado_en': now,
            },
        )
        if not created:
            update_instance(usuario, {
                'password_hash': password_hash,
                'nombre': nombre,
                'apellido': apellido,
                'telefono': telefono,
                'activo': True,
                'email_verificado': True,
                'actualizado_en': now,
            })
        return usuario

    def create_or_update_usuario_club(self, usuario, club, rol, now):
        usuario_club, created = UsuarioClub.objects.get_or_create(
            usuario=usuario,
            club=club,
            rol=rol,
            defaults={
                'id': uuid.uuid4(),
                'estado': EstadoUsuarioClub.ACTIVO,
                'creado_en': now,
            },
        )
        if not created:
            update_instance(
                usuario_club,
                {'estado': EstadoUsuarioClub.ACTIVO},
            )
        return usuario_club
