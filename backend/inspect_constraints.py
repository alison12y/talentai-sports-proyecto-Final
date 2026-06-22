from django.db import connection
with connection.cursor() as c:
    c.execute("SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'pago'::regclass")
    for row in c.fetchall():
        print(row)
