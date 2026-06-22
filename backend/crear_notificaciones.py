from django.db import connection
from users.models import Usuario
from notifications.models import Notificacion

cursor = connection.cursor()
cursor.execute("""
    SELECT enumlabel
    FROM pg_enum
    WHERE enumtypid = to_regtype('tipo_notificacion')
    ORDER BY enumsortorder
    LIMIT 1;
""")

row = cursor.fetchone()

if not row:
    print("No se encontraron valores para tipo_notificacion")
else:
    tipo = row[0]
    usuarios = Usuario.objects.all()

    for usuario in usuarios:
        Notificacion.objects.create(
            usuario=usuario,
            tipo=tipo,
            titulo="Nueva notificación",
            cuerpo="Tienes una notificación pendiente del sistema.",
            leida=False
        )

    print("Tipo usado:", tipo)
    print("Notificaciones creadas:", usuarios.count())