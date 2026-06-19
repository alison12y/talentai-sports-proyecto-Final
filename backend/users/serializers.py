from rest_framework import serializers

from .models import Usuario


class UsuarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Usuario
        fields = '__all__'


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(required=True, trim_whitespace=False)

    def validate_password(self, value):
        if not value:
            raise serializers.ValidationError('La password es obligatoria.')
        return value


class RecoverPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
