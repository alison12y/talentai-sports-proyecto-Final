
import django.utils.timezone
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('clubs', '0001_club_management_fields'),
        ('notifications', '0002_alter_notificacion_options'),
        ('users', '0002_usuarioclub'),
    ]

    operations = [
        migrations.AddField(
            model_name='notificacion',
            name='fecha_lectura',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='notificacion',
            name='actualizado_en',
            field=models.DateTimeField(default=django.utils.timezone.now),
        ),
        migrations.AlterField(
            model_name='notificacion',
            name='creado_en',
            field=models.DateTimeField(default=django.utils.timezone.now),
        ),
        migrations.AlterField(
            model_name='notificacion',
            name='enviada_push',
            field=models.BooleanField(default=False),
        ),
        migrations.AlterField(
            model_name='notificacion',
            name='id',
            field=models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False),
        ),
        migrations.AlterField(
            model_name='notificacion',
            name='leida',
            field=models.BooleanField(default=False),
        ),
    ]