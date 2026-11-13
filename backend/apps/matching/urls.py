from django.urls import path

from .views import (
    SourcingRequestCloseView,
    SourcingRequestDetailView,
    SourcingRequestListView,
    SourcingRequestMatchesView,
)

app_name = "matching"

urlpatterns = [
    path("requests/", SourcingRequestListView.as_view(), name="request_list"),
    path("requests/<uuid:request_id>/", SourcingRequestDetailView.as_view(), name="request_detail"),
    path(
        "requests/<uuid:request_id>/close/",
        SourcingRequestCloseView.as_view(),
        name="request_close",
    ),
    path(
        "requests/<uuid:request_id>/matches/",
        SourcingRequestMatchesView.as_view(),
        name="request_matches",
    ),
]
