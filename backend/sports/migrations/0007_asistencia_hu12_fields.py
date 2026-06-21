from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):
    dependencies = [
        ('sports', '0006_convocatoria_hu10_fields'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql=(
                        "ALTER TABLE asistencia "
                        "ADD COLUMN IF NOT EXISTS estado varchar(20) NOT NULL DEFAULT 'AUSENTE', "
                        "ADD COLUMN IF NOT EXISTS motivo text NULL, "
                        "ADD COLUMN IF NOT EXISTS registrado_en timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP, "
                        "ADD COLUMN IF NOT EXISTS actualizado_en timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP, "
                        "ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true; "
                        "UPDATE asistencia SET "
                        "estado = CASE "
                        "WHEN presente THEN 'PRESENTE' "
                        "WHEN justificado THEN 'JUSTIFICADO' "
                        "ELSE 'AUSENTE' END, "
                        "motivo = COALESCE(motivo, motivo_ausencia), "
                        "registrado_en = COALESCE(creado_en, CURRENT_TIMESTAMP), "
                        "actualizado_en = COALESCE(creado_en, CURRENT_TIMESTAMP);"
                    ),
                    reverse_sql=(
                        "ALTER TABLE asistencia "
                        "DROP COLUMN IF EXISTS activo, "
                        "DROP COLUMN IF EXISTS actualizado_en, "
                        "DROP COLUMN IF EXISTS registrado_en, "
                        "DROP COLUMN IF EXISTS motivo, "
                        "DROP COLUMN IF EXISTS estado;"
                    ),
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='asistencia',
                    name='estado',
                    field=models.CharField(
                        choices=[
                            ('PRESENTE', 'Presente'),
                            ('AUSENTE', 'Ausente'),
                            ('JUSTIFICADO', 'Justificado'),
                        ],
                        default='AUSENTE',
                        max_length=20,
                    ),
                ),
                migrations.AddField(
                    model_name='asistencia',
                    name='motivo',
                    field=models.TextField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name='asistencia',
                    name='registrado_en',
                    field=models.DateTimeField(default=django.utils.timezone.now),
                ),
                migrations.AddField(
                    model_name='asistencia',
                    name='actualizado_en',
                    field=models.DateTimeField(default=django.utils.timezone.now),
                ),
                migrations.AddField(
                    model_name='asistencia',
                    name='activo',
                    field=models.BooleanField(default=True),
                ),
            ],
        ),
    ]
