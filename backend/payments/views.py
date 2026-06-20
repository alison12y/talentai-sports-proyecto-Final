from rest_framework import mixins, viewsets

from .models import PlanSaaS
from .serializers import PlanSaaSSerializer


class PlanSaaSViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = PlanSaaSSerializer

    def get_queryset(self):
        return PlanSaaS.objects.filter(activo=True).order_by('precio_mensual', 'id')
