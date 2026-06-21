from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('sports', '0005_evento_hu09_fields'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql=(
                        "ALTER TABLE convocatoria "
                        "ADD COLUMN IF NOT EXISTS estado varchar(100) NOT NULL DEFAULT 'PENDIENTE', "
                        "ADD COLUMN IF NOT EXISTS fecha_notificacion timestamp with time zone NULL; "
                        "CREATE UNIQUE INDEX IF NOT EXISTS unique_convocatoria_evento_jugador "
                        "ON convocatoria (evento_id, jugador_id);"
                    ),
                    reverse_sql=(
                        "DROP INDEX IF EXISTS unique_convocatoria_evento_jugador; "
                        "ALTER TABLE convocatoria "
                        "DROP COLUMN IF EXISTS fecha_notificacion, "
                        "DROP COLUMN IF EXISTS estado;"
                    ),
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='convocatoria',
                    name='estado',
                    field=models.CharField(
                        choices=[
                            ('PENDIENTE', 'Pendiente'),
                            ('CONFIRMADO', 'Confirmado'),
                            ('RECHAZADO', 'Rechazado'),
                            ('NO_CONVOCADO', 'No convocado'),
                        ],
                        default='PENDIENTE',
                        max_length=100,
                    ),
                ),
                migrations.AddField(
                    model_name='convocatoria',
                    name='fecha_notificacion',
                    field=models.DateTimeField(blank=True, null=True),
                ),
                migrations.AddConstraint(
                    model_name='convocatoria',
                    constraint=models.UniqueConstraint(
                        fields=('evento', 'jugador'),
                        name='unique_convocatoria_evento_jugador',
                    ),
                ),
            ],
        ),
    ]
