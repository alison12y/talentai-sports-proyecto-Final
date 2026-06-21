
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='Usuario',
            fields=[
                ('id', models.UUIDField(primary_key=True, serialize=False)),
                ('email', models.EmailField(max_length=254, unique=True)),
                ('password_hash', models.CharField(max_length=255)),
                ('nombre', models.CharField(max_length=255)),
                ('apellido', models.CharField(max_length=255)),
                ('telefono', models.CharField(blank=True, max_length=50, null=True)),
                ('avatar_url', models.TextField(blank=True, null=True)),
                ('fecha_nacimiento', models.DateField(blank=True, null=True)),
                ('activo', models.BooleanField()),
                ('email_verificado', models.BooleanField()),
                ('firebase_token', models.TextField(blank=True, null=True)),
                ('ultimo_acceso', models.DateTimeField(blank=True, null=True)),
                ('creado_en', models.DateTimeField()),
                ('actualizado_en', models.DateTimeField()),
            ],
            options={
                'db_table': 'usuario',
                'managed': False,
            },
        ),
        migrations.CreateModel(
            name='PasswordResetToken',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('token', models.CharField(db_index=True, max_length=64, unique=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('expires_at', models.DateTimeField()),
                ('used', models.BooleanField(default=False)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='password_reset_tokens', to='users.usuario')),
            ],
            options={
                'db_table': 'password_reset_token',
                'ordering': ['-created_at'],
            },
        ),
    ]
