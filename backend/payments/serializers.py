from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from clubs.models import Club

from .models import ClubPlan, PlanSaaS


class PlanSaaSSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlanSaaS
        fields = (
            'id', 'codigo', 'nombre', 'descripcion', 'precio_mensual',
            'limite_jugadores', 'limite_equipos', 'incluye_ia',
            'incluye_reportes', 'soporte', 'caracteristicas', 'activo',
        )
        read_only_fields = fields


class ClubPlanSerializer(serializers.ModelSerializer):
    plan = PlanSaaSSerializer(read_only=True)

    class Meta:
        model = ClubPlan
        fields = (
            'id', 'club_id', 'plan', 'activo', 'fecha_inicio', 'fecha_fin',
            'estado', 'created_at', 'updated_at',
        )
        read_only_fields = fields


class SeleccionarPlanSaaSSerializer(serializers.Serializer):
    plan_id = serializers.IntegerField(required=True, min_value=1)
    metodo_pago = serializers.CharField(max_length=50, required=False, allow_blank=True, allow_null=True)
    referencia = serializers.CharField(max_length=100, required=False, allow_blank=True, allow_null=True)

    def validate_plan_id(self, value):
        try:
            plan = PlanSaaS.objects.get(pk=value)
        except PlanSaaS.DoesNotExist:
            raise serializers.ValidationError('El plan seleccionado no existe.')
        if not plan.activo:
            raise serializers.ValidationError('El plan seleccionado no está activo.')
        return plan

    def create(self, validated_data):
        club = validated_data['club']
        plan = validated_data['plan_id']
        metodo_pago = validated_data.get('metodo_pago', '')
        referencia = validated_data.get('referencia', '')
        now = timezone.now()

        with transaction.atomic():
            ClubPlan.objects.filter(club=club, activo=True).update(
                activo=False,
                estado=ClubPlan.Estado.CANCELADA,
                fecha_fin=now,
                updated_at=now,
            )
            suscripcion = ClubPlan.objects.create(
                club=club,
                plan=plan,
                activo=True,
                estado=ClubPlan.Estado.ACTIVA,
                metodo_pago=metodo_pago,
                referencia=referencia,
                fecha_inicio=now,
            )
            Club.objects.filter(pk=club.pk).update(
                plan=plan.codigo,
                actualizado_en=now,
            )

        club.plan = plan.codigo
        club.actualizado_en = now
        return suscripcion
