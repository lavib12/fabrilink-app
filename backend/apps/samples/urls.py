from django.urls import path

from .views import SampleRequestDetailView, SampleRequestListView, SampleRequestStatusView

app_name = "samples"

urlpatterns = [
    path("requests/", SampleRequestListView.as_view(), name="request_list"),
    path("requests/<uuid:sample_id>/", SampleRequestDetailView.as_view(), name="request_detail"),
    path(
        "requests/<uuid:sample_id>/status/",
        SampleRequestStatusView.as_view(),
        name="request_status",
    ),
]
