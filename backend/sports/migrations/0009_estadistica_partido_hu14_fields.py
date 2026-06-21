from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):
    dependencies = [
        ('sports', '0008_partido_hu13_activo'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql=(
                        "ALTER TABLE estadistica_partido "
                        "ADD COLUMN IF NOT EXISTS actualizado_en timestamp with time zone "
                        "NOT NULL DEFAULT CURRENT_TIMESTAMP, "
                        "ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true; "
                        "UPDATE estadistica_partido SET actualizado_en = "
                        "COALESCE(creado_en, CURRENT_TIMESTAMP);"
                    ),
                    reverse_sql=(
                        "ALTER TABLE estadistica_partido "
                        "DROP COLUMN IF EXISTS activo, "
                        "DROP COLUMN IF EXISTS actualizado_en;"
                    ),
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='estadisticapartido',
                    name='actualizado_en',
                    field=models.DateTimeField(default=django.utils.timezone.now),
                ),
                migrations.AddField(
                    model_name='estadisticapartido',
                    name='activo',
                    field=models.BooleanField(default=True),
                ),
            ],
        ),
    ]
