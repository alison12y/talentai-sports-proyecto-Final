import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'talentai.settings')
django.setup()

from django.db import connection

with connection.cursor() as cursor:
    cursor.execute("SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE typname = 'tipo_notificacion'")
    print("Valid Notification Types:")
    for row in cursor.fetchall():
        print(row[0])
