from rest_framework.routers import DefaultRouter

from .views import PlanSaaSViewSet


router = DefaultRouter()
router.register('planes', PlanSaaSViewSet, basename='plan-saas')

urlpatterns = router.urls
