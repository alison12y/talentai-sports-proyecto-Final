from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('sports', '0002_existing_sports_models_state'),
    ]

    operations = [
        migrations.RunSQL(
            sql=(
                'DROP VIEW vista_jugadores_activos; '
                'ALTER TABLE equipo '
                'ALTER COLUMN categoria TYPE varchar(100) '
                'USING categoria::text; '
                'CREATE VIEW vista_jugadores_activos AS '
                'SELECT j.id AS jugador_id, j.nombre, j.apellido, '
                'j.fecha_nacimiento, j.numero_camiseta, '
                'j.posicion_principal, e.id AS equipo_id, '
                'e.nombre AS equipo_nombre, '
                'e.categoria AS equipo_categoria, c.id AS club_id, '
                'c.nombre AS club_nombre '
                'FROM jugador j '
                'JOIN jugador_equipo je '
                'ON j.id = je.jugador_id AND je.activo = true '
                'JOIN equipo e ON je.equipo_id = e.id '
                'JOIN club c ON j.club_id = c.id '
                "WHERE j.estado::text = 'ACTIVO'::text;"
            ),
            # No se revierte al enum porque podria perder categorias personalizadas.
            reverse_sql=None,
        ),
    ]
