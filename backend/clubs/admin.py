from django.contrib import admin

from .models import Club


@admin.register(Club)
class ClubAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'email_contacto', 'telefono', 'plan', 'activo', 'creado_en')
    list_filter = ('activo', 'plan')
    search_fields = ('nombre', 'email_contacto', 'slug')
    readonly_fields = ('id', 'slug', 'creado_en', 'actualizado_en')
