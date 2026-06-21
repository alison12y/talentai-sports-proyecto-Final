import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('clubs', '0001_club_management_fields'),
        ('sports', '0011_convocatoria_hu11_respuesta'),
        ('payments', '0002_seed_saas_plans'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql=(
                        "ALTER TABLE cuota "
                        "ADD COLUMN IF NOT EXISTS descripcion text NULL, "
                        "ADD COLUMN IF NOT EXISTS estado varchar(20) NOT NULL DEFAULT 'ACTIVA'; "
                        "ALTER TABLE pago "
                        "ADD COLUMN IF NOT EXISTS monto numeric(10, 2) NULL, "
                        "ADD COLUMN IF NOT EXISTS moneda varchar(10) NULL, "
                        "ADD COLUMN IF NOT EXISTS fecha_vencimiento date NULL, "
                        "ADD COLUMN IF NOT EXISTS referencia varchar(255) NULL, "
                        "ADD COLUMN IF NOT EXISTS observaciones text NULL; "
                        "UPDATE pago p SET "
                        "monto = COALESCE(p.monto, c.monto), "
                        "moneda = COALESCE(p.moneda, c.moneda), "
                        "fecha_vencimiento = COALESCE(p.fecha_vencimiento, c.fecha_vencimiento) "
                        "FROM cuota c WHERE p.cuota_id = c.id; "
                        "ALTER TABLE pago ALTER COLUMN monto SET NOT NULL, "
                        "ALTER COLUMN moneda SET NOT NULL, "
                        "ALTER COLUMN fecha_vencimiento SET NOT NULL; "
                        "CREATE UNIQUE INDEX IF NOT EXISTS unique_pago_cuota_jugador "
                        "ON pago (cuota_id, jugador_id);"
                    ),
                    reverse_sql=(
                        "DROP INDEX IF EXISTS unique_pago_cuota_jugador; "
                        "ALTER TABLE pago "
                        "DROP COLUMN IF EXISTS observaciones, "
                        "DROP COLUMN IF EXISTS referencia, "
                        "DROP COLUMN IF EXISTS fecha_vencimiento, "
                        "DROP COLUMN IF EXISTS moneda, "
                        "DROP COLUMN IF EXISTS monto; "
                        "ALTER TABLE cuota "
                        "DROP COLUMN IF EXISTS estado, "
                        "DROP COLUMN IF EXISTS descripcion;"
                    ),
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='cuota',
                    name='club',
                    field=models.ForeignKey(
                        db_column='club_id',
                        on_delete=django.db.models.deletion.DO_NOTHING,
                        to='clubs.club',
                    ),
                ),
                migrations.AddField(
                    model_name='cuota',
                    name='equipo',
                    field=models.ForeignKey(
                        blank=True,
                        db_column='equipo_id',
                        null=True,
                        on_delete=django.db.models.deletion.DO_NOTHING,
                        to='sports.equipo',
                    ),
                ),
                migrations.AddField(
                    model_name='cuota',
                    name='descripcion',
                    field=models.TextField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name='cuota',
                    name='estado',
                    field=models.CharField(
                        choices=[('ACTIVA', 'Activa'), ('INACTIVA', 'Inactiva')],
                        default='ACTIVA',
                        max_length=20,
                    ),
                ),
                migrations.AddField(
                    model_name='pago',
                    name='cuota',
                    field=models.ForeignKey(
                        db_column='cuota_id',
                        on_delete=django.db.models.deletion.DO_NOTHING,
                        to='payments.cuota',
                    ),
                ),
                migrations.AddField(
                    model_name='pago',
                    name='jugador',
                    field=models.ForeignKey(
                        db_column='jugador_id',
                        on_delete=django.db.models.deletion.DO_NOTHING,
                        to='sports.jugador',
                    ),
                ),
                migrations.AddField(
                    model_name='pago',
                    name='monto',
                    field=models.DecimalField(decimal_places=2, max_digits=10),
                ),
                migrations.AddField(
                    model_name='pago',
                    name='moneda',
                    field=models.CharField(default='BOB', max_length=10),
                ),
                migrations.AddField(
                    model_name='pago',
                    name='fecha_vencimiento',
                    field=models.DateField(),
                ),
                migrations.AddField(
                    model_name='pago',
                    name='referencia',
                    field=models.CharField(blank=True, max_length=255, null=True),
                ),
                migrations.AddField(
                    model_name='pago',
                    name='observaciones',
                    field=models.TextField(blank=True, null=True),
                ),
                migrations.AlterField(
                    model_name='pago',
                    name='estado',
                    field=models.CharField(
                        choices=[
                            ('PENDIENTE', 'Pendiente'),
                            ('PAGADO', 'Pagado'),
                            ('VENCIDO', 'Vencido'),
                            ('ANULADO', 'Anulado'),
                        ],
                        default='PENDIENTE',
                        max_length=100,
                    ),
                ),
                migrations.AddConstraint(
                    model_name='pago',
                    constraint=models.UniqueConstraint(
                        fields=('cuota', 'jugador'),
                        name='unique_pago_cuota_jugador',
                    ),
                ),
            ],
        ),
    ]
