from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('sports', '0007_asistencia_hu12_fields'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql=(
                        "ALTER TABLE partido "
                        "ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;"
                    ),
                    reverse_sql=(
                        "ALTER TABLE partido DROP COLUMN IF EXISTS activo;"
                    ),
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='partido',
                    name='activo',
                    field=models.BooleanField(default=True),
                ),
            ],
        ),
    ]
