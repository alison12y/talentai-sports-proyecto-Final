import django.db.models.deletion
from django.db import migrations, models
from django.db.models.functions import Lower


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ('clubs', '0001_club_management_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='CategoriaDeportiva',
            fields=[
                (
                    'id',
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name='ID',
                    ),
                ),
                ('nombre', models.CharField(max_length=100)),
                ('descripcion', models.TextField(blank=True, null=True)),
                ('edad_minima', models.PositiveSmallIntegerField(blank=True, null=True)),
                ('edad_maxima', models.PositiveSmallIntegerField(blank=True, null=True)),
                ('activo', models.BooleanField(default=True)),
                ('predefinida', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                (
                    'club',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='categorias_deportivas',
                        to='clubs.club',
                    ),
                ),
            ],
            options={
                'db_table': 'categoria_deportiva',
                'ordering': ['nombre'],
                'constraints': [
                    models.UniqueConstraint(
                        Lower('nombre'),
                        'club',
                        name='unique_category_name_per_club_ci',
                    ),
                ],
            },
        ),
    ]
