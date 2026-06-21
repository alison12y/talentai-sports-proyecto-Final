from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):
    dependencies = [
        ('sports', '0010_evolucion_fisica_hu15_fields'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql=(
                        "ALTER TABLE convocatoria "
                        "ADD COLUMN IF NOT EXISTS respuesta varchar(20) NULL, "
                        "ADD COLUMN IF NOT EXISTS motivo_rechazo text NULL, "
                        "ADD COLUMN IF NOT EXISTS respondido_en timestamp with time zone NULL, "
                        "ADD COLUMN IF NOT EXISTS actualizado_en timestamp with time zone "
                        "NOT NULL DEFAULT CURRENT_TIMESTAMP; "
                        "UPDATE convocatoria SET "
                        "respuesta = CASE WHEN estado IN ('CONFIRMADO', 'RECHAZADO') "
                        "THEN estado ELSE NULL END, "
                        "respondido_en = CASE WHEN estado IN ('CONFIRMADO', 'RECHAZADO') "
                        "THEN confirmado_en ELSE NULL END, "
                        "actualizado_en = COALESCE(creado_en, CURRENT_TIMESTAMP);"
                    ),
                    reverse_sql=(
                        "ALTER TABLE convocatoria "
                        "DROP COLUMN IF EXISTS actualizado_en, "
                        "DROP COLUMN IF EXISTS respondido_en, "
                        "DROP COLUMN IF EXISTS motivo_rechazo, "
                        "DROP COLUMN IF EXISTS respuesta;"
                    ),
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='convocatoria',
                    name='respuesta',
                    field=models.CharField(blank=True, max_length=20, null=True),
                ),
                migrations.AddField(
                    model_name='convocatoria',
                    name='motivo_rechazo',
                    field=models.TextField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name='convocatoria',
                    name='respondido_en',
                    field=models.DateTimeField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name='convocatoria',
                    name='actualizado_en',
                    field=models.DateTimeField(default=django.utils.timezone.now),
                ),
            ],
        ),
    ]
