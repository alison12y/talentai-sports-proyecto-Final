from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql=(
                        'ALTER TABLE club '
                        'ADD COLUMN IF NOT EXISTS direccion text NULL, '
                        'ADD COLUMN IF NOT EXISTS colores varchar(255) NULL;'
                    ),
                    reverse_sql=(
                        'ALTER TABLE club '
                        'DROP COLUMN IF EXISTS direccion, '
                        'DROP COLUMN IF EXISTS colores;'
                    ),
                ),
            ],
            state_operations=[
                migrations.CreateModel(
                    name='Club',
                    fields=[
                        ('id', models.UUIDField(primary_key=True, serialize=False)),
                        ('nombre', models.CharField(max_length=255)),
                        ('slug', models.CharField(max_length=255, unique=True)),
                        ('descripcion', models.TextField(blank=True, null=True)),
                        ('logo_url', models.TextField(blank=True, null=True)),
                        ('direccion', models.TextField(blank=True, null=True)),
                        ('colores', models.CharField(blank=True, max_length=255, null=True)),
                        ('ciudad', models.CharField(blank=True, max_length=255, null=True)),
                        ('pais', models.CharField(blank=True, max_length=255, null=True)),
                        ('email_contacto', models.EmailField(blank=True, max_length=254, null=True)),
                        ('telefono', models.CharField(blank=True, max_length=50, null=True)),
                        ('plan', models.CharField(default='BASICO', max_length=50)),
                        ('activo', models.BooleanField(default=True)),
                        ('creado_en', models.DateTimeField()),
                        ('actualizado_en', models.DateTimeField()),
                    ],
                    options={'db_table': 'club', 'managed': False},
                ),
            ],
        ),
    ]
