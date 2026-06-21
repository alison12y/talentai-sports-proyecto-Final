from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('sports', '0004_jugador_categoria'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql=(
                        "ALTER TABLE evento "
                        "ADD COLUMN IF NOT EXISTS rival varchar(255) NULL, "
                        "ADD COLUMN IF NOT EXISTS estado varchar(100) NOT NULL DEFAULT 'PROGRAMADO', "
                        "ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;"
                    ),
                    reverse_sql=(
                        "ALTER TABLE evento "
                        "DROP COLUMN IF EXISTS rival, "
                        "DROP COLUMN IF EXISTS estado, "
                        "DROP COLUMN IF EXISTS activo;"
                    ),
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='evento',
                    name='rival',
                    field=models.CharField(blank=True, max_length=255, null=True),
                ),
                migrations.AddField(
                    model_name='evento',
                    name='estado',
                    field=models.CharField(
                        choices=[
                            ('PROGRAMADO', 'Programado'),
                            ('CANCELADO', 'Cancelado'),
                            ('FINALIZADO', 'Finalizado'),
                        ],
                        default='PROGRAMADO',
                        max_length=100,
                    ),
                ),
                migrations.AddField(
                    model_name='evento',
                    name='activo',
                    field=models.BooleanField(default=True),
                ),
                migrations.AlterField(
                    model_name='evento',
                    name='tipo',
                    field=models.CharField(
                        choices=[
                            ('ENTRENAMIENTO', 'Entrenamiento'),
                            ('PARTIDO', 'Partido'),
                            ('REUNION', 'Reunión'),
                            ('OTRO', 'Otro'),
                        ],
                        max_length=100,
                    ),
                ),
            ],
        ),
    ]
