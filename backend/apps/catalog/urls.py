from django.urls import path

from .uploads import ImageFileView, ImageUploadView
from .views import (
    FabricCategoryListView,
    FabricRollDetailView,
    FabricRollListView,
)

app_name = "catalog"

urlpatterns = [
    path("images/", ImageUploadView.as_view(), name="image_upload"),
    path("images/<uuid:image_id>/", ImageFileView.as_view(), name="image_file"),
    path("categories/", FabricCategoryListView.as_view(), name="category_list"),
    path("rolls/", FabricRollListView.as_view(), name="roll_list"),
    path("rolls/<uuid:roll_id>/", FabricRollDetailView.as_view(), name="roll_detail"),
]
