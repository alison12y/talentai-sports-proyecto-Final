from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):
    dependencies = [
        ('sports', '0009_estadistica_partido_hu14_fields'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql=(
                        "ALTER TABLE evolucion_fisica "
                        "ADD COLUMN IF NOT EXISTS test_cooper numeric(8,2) NULL, "
                        "ADD COLUMN IF NOT EXISTS actualizado_en timestamp with time zone "
                        "NOT NULL DEFAULT CURRENT_TIMESTAMP, "
                        "ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true; "
                        "UPDATE evolucion_fisica SET "
                        "test_cooper = COALESCE(test_cooper, resistencia), "
                        "actualizado_en = COALESCE(creado_en, CURRENT_TIMESTAMP);"
                    ),
                    reverse_sql=(
                        "ALTER TABLE evolucion_fisica "
                        "DROP COLUMN IF EXISTS activo, "
                        "DROP COLUMN IF EXISTS actualizado_en, "
                        "DROP COLUMN IF EXISTS test_cooper;"
                    ),
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='evolucionfisica',
                    name='test_cooper',
                    field=models.DecimalField(
                        blank=True,
                        decimal_places=2,
                        max_digits=8,
                        null=True,
                    ),
                ),
                migrations.AddField(
                    model_name='evolucionfisica',
                    name='actualizado_en',
                    field=models.DateTimeField(default=django.utils.timezone.now),
                ),
                migrations.AddField(
                    model_name='evolucionfisica',
                    name='activo',
                    field=models.BooleanField(default=True),
                ),
            ],
        ),
    ]
