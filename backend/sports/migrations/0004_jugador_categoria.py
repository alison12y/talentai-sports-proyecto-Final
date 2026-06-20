from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('sports', '0003_equipo_categoria_varchar'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql=(
                        'ALTER TABLE jugador '
                        'ADD COLUMN IF NOT EXISTS categoria varchar(100); '
                        'UPDATE jugador j SET categoria = e.categoria '
                        'FROM jugador_equipo je '
                        'JOIN equipo e ON e.id = je.equipo_id '
                        'WHERE je.jugador_id = j.id '
                        'AND je.activo = true AND j.categoria IS NULL;'
                    ),
                    reverse_sql=(
                        'ALTER TABLE jugador DROP COLUMN IF EXISTS categoria;'
                    ),
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='jugador',
                    name='categoria',
                    field=models.CharField(
                        blank=True,
                        max_length=100,
                        null=True,
                    ),
                ),
            ],
        ),
    ]
