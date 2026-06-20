from django.db import migrations


PLANES = (
    {
        'codigo': 'BASICO',
        'nombre': 'Básico',
        'descripcion': 'Para clubes pequeños.',
        'precio_mensual': 49,
        'limite_jugadores': 50,
        'limite_equipos': 3,
        'incluye_ia': False,
        'incluye_reportes': True,
        'soporte': 'Estándar',
        'caracteristicas': [
            'Hasta 50 jugadores',
            'Hasta 3 equipos',
            'Reportes básicos',
        ],
        'activo': True,
    },
    {
        'codigo': 'PRO',
        'nombre': 'Pro',
        'descripcion': 'Para clubes en crecimiento.',
        'precio_mensual': 99,
        'limite_jugadores': 200,
        'limite_equipos': 10,
        'incluye_ia': True,
        'incluye_reportes': True,
        'soporte': 'Preferente',
        'caracteristicas': [
            'Hasta 200 jugadores',
            'Hasta 10 equipos',
            'IA básica y scouting',
            'Reportes avanzados',
        ],
        'activo': True,
    },
    {
        'codigo': 'ELITE',
        'nombre': 'Elite',
        'descripcion': 'Para academias competitivas.',
        'precio_mensual': 199,
        'limite_jugadores': 500,
        'limite_equipos': 30,
        'incluye_ia': True,
        'incluye_reportes': True,
        'soporte': 'Prioritario',
        'caracteristicas': [
            'Hasta 500 jugadores',
            'Hasta 30 equipos',
            'IA avanzada',
            'Reportes completos',
            'Soporte prioritario',
        ],
        'activo': True,
    },
)


def crear_planes(apps, schema_editor):
    PlanSaaS = apps.get_model('payments', 'PlanSaaS')
    for plan in PLANES:
        codigo = plan['codigo']
        defaults = {key: value for key, value in plan.items() if key != 'codigo'}
        PlanSaaS.objects.update_or_create(codigo=codigo, defaults=defaults)


def eliminar_planes(apps, schema_editor):
    PlanSaaS = apps.get_model('payments', 'PlanSaaS')
    PlanSaaS.objects.filter(codigo__in=[plan['codigo'] for plan in PLANES]).delete()


class Migration(migrations.Migration):
    dependencies = [
        ('payments', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(crear_planes, eliminar_planes),
    ]
