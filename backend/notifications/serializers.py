from rest_framework import serializers
from .models import Notificacion

class NotificacionSerializer(serializers.ModelSerializer):
    mensaje = serializers.CharField(source='cuerpo', required=False, allow_blank=True)
    fecha_creacion = serializers.DateTimeField(source='creado_en', read_only=True)

    class Meta:
        model = Notificacion
        fields = (
            'id', 'usuario', 'titulo', 'mensaje', 'tipo', 'leida',
            'fecha_creacion', 'fecha_lectura', 'creado_en', 'data_extra'
        )
        read_only_fields = ('id', 'fecha_creacion', 'fecha_lectura', 'usuario', 'creado_en', 'data_extra')

    def create(self, validated_data):
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            validated_data['usuario'] = request.user
        return super().create(validated_data)
