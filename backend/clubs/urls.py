from rest_framework.routers import DefaultRouter

from .views import ClubViewSet


router = DefaultRouter()
router.register('clubes', ClubViewSet, basename='club')

urlpatterns = router.urls
