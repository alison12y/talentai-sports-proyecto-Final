from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('sports', '0001_categoria_deportiva'),
    ]

    operations = [
        migrations.CreateModel(
            name='Asistencia',
            fields=[
                ('id', models.UUIDField(primary_key=True, serialize=False)),
                ('presente', models.BooleanField()),
                ('justificado', models.BooleanField()),
                ('motivo_ausencia', models.TextField(blank=True, null=True)),
                ('creado_en', models.DateTimeField()),
            ],
            options={'db_table': 'asistencia', 'managed': False},
        ),
        migrations.CreateModel(
            name='Convocatoria',
            fields=[
                ('id', models.UUIDField(primary_key=True, serialize=False)),
                ('confirmado', models.BooleanField(blank=True, null=True)),
                ('confirmado_en', models.DateTimeField(blank=True, null=True)),
                ('notas', models.TextField(blank=True, null=True)),
                ('creado_en', models.DateTimeField()),
            ],
            options={'db_table': 'convocatoria', 'managed': False},
        ),
        migrations.CreateModel(
            name='EntrenadorEquipo',
            fields=[
                ('id', models.UUIDField(primary_key=True, serialize=False)),
                ('es_principal', models.BooleanField()),
                ('creado_en', models.DateTimeField()),
            ],
            options={'db_table': 'entrenador_equipo', 'managed': False},
        ),
        migrations.CreateModel(
            name='Equipo',
            fields=[
                ('id', models.UUIDField(primary_key=True, serialize=False)),
                ('nombre', models.CharField(max_length=255)),
                ('categoria', models.CharField(max_length=100)),
                ('temporada', models.CharField(max_length=100)),
                ('descripcion', models.TextField(blank=True, null=True)),
                ('activo', models.BooleanField()),
                ('creado_en', models.DateTimeField()),
                ('actualizado_en', models.DateTimeField()),
            ],
            options={'db_table': 'equipo', 'managed': False},
        ),
        migrations.CreateModel(
            name='EstadisticaPartido',
            fields=[
                ('id', models.UUIDField(primary_key=True, serialize=False)),
                ('minutos_jugados', models.IntegerField()),
                ('goles', models.IntegerField()),
                ('asistencias', models.IntegerField()),
                ('tarjetas_amarillas', models.IntegerField()),
                ('tarjetas_rojas', models.IntegerField()),
                ('valoracion', models.DecimalField(blank=True, decimal_places=2, max_digits=4, null=True)),
                ('notas', models.TextField(blank=True, null=True)),
                ('creado_en', models.DateTimeField()),
            ],
            options={'db_table': 'estadistica_partido', 'managed': False},
        ),
        migrations.CreateModel(
            name='Evento',
            fields=[
                ('id', models.UUIDField(primary_key=True, serialize=False)),
                ('tipo', models.CharField(max_length=100)),
                ('titulo', models.CharField(max_length=255)),
                ('descripcion', models.TextField(blank=True, null=True)),
                ('ubicacion', models.CharField(blank=True, max_length=255, null=True)),
                ('fecha_inicio', models.DateTimeField()),
                ('fecha_fin', models.DateTimeField()),
                ('creado_en', models.DateTimeField()),
                ('actualizado_en', models.DateTimeField()),
            ],
            options={'db_table': 'evento', 'managed': False},
        ),
        migrations.CreateModel(
            name='EvolucionFisica',
            fields=[
                ('id', models.UUIDField(primary_key=True, serialize=False)),
                ('fecha', models.DateField()),
                ('peso_kg', models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True)),
                ('altura_cm', models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True)),
                ('velocidad_40m', models.DecimalField(blank=True, decimal_places=2, max_digits=4, null=True)),
                ('resistencia', models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True)),
                ('notas', models.TextField(blank=True, null=True)),
                ('creado_en', models.DateTimeField()),
            ],
            options={'db_table': 'evolucion_fisica', 'managed': False},
        ),
        migrations.CreateModel(
            name='Jugador',
            fields=[
                ('id', models.UUIDField(primary_key=True, serialize=False)),
                ('nombre', models.CharField(max_length=255)),
                ('apellido', models.CharField(max_length=255)),
                ('fecha_nacimiento', models.DateField()),
                ('dni', models.CharField(blank=True, max_length=100, null=True, unique=True)),
                ('foto_url', models.TextField(blank=True, null=True)),
                ('posicion_principal', models.CharField(blank=True, max_length=100, null=True)),
                ('posicion_secundaria', models.CharField(blank=True, max_length=100, null=True)),
                ('pie_dominante', models.CharField(blank=True, max_length=50, null=True)),
                ('numero_camiseta', models.IntegerField(blank=True, null=True)),
                ('estado', models.CharField(max_length=100)),
                ('notas', models.TextField(blank=True, null=True)),
                ('creado_en', models.DateTimeField()),
                ('actualizado_en', models.DateTimeField()),
            ],
            options={'db_table': 'jugador', 'managed': False},
        ),
        migrations.CreateModel(
            name='JugadorEquipo',
            fields=[
                ('id', models.UUIDField(primary_key=True, serialize=False)),
                ('fecha_inicio', models.DateField()),
                ('fecha_fin', models.DateField(blank=True, null=True)),
                ('activo', models.BooleanField()),
                ('creado_en', models.DateTimeField()),
            ],
            options={'db_table': 'jugador_equipo', 'managed': False},
        ),
        migrations.CreateModel(
            name='Partido',
            fields=[
                ('id', models.UUIDField(primary_key=True, serialize=False)),
                ('nombre_rival', models.CharField(max_length=255)),
                ('fecha', models.DateTimeField()),
                ('ubicacion', models.CharField(blank=True, max_length=255, null=True)),
                ('goles_local', models.IntegerField()),
                ('goles_rival', models.IntegerField()),
                ('resultado', models.CharField(blank=True, max_length=100, null=True)),
                ('notas_tacticas', models.TextField(blank=True, null=True)),
                ('creado_en', models.DateTimeField()),
                ('actualizado_en', models.DateTimeField()),
            ],
            options={'db_table': 'partido', 'managed': False},
        ),
        migrations.CreateModel(
            name='TutorJugador',
            fields=[
                ('id', models.UUIDField(primary_key=True, serialize=False)),
                ('parentesco', models.CharField(max_length=100)),
                ('es_contacto_principal', models.BooleanField()),
                ('creado_en', models.DateTimeField()),
            ],
            options={'db_table': 'tutor_jugador', 'managed': False},
        ),
    ]
