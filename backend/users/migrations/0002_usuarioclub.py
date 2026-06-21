
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='UsuarioClub',
            fields=[
                ('id', models.UUIDField(primary_key=True, serialize=False)),
                ('rol', models.CharField(max_length=100)),
                ('estado', models.CharField(max_length=100)),
                ('creado_en', models.DateTimeField()),
            ],
            options={
                'db_table': 'usuario_club',
                'managed': False,
            },
        ),
    ]
