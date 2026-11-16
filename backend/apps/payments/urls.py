from django.urls import path

from .views import (
    OrderPaymentView,
    PaymentAccountsView,
    PaymentReviewView,
    PaymentSubmissionListView,
)

app_name = "payments"

urlpatterns = [
    path("accounts/", PaymentAccountsView.as_view(), name="accounts"),
    path("orders/<uuid:order_id>/", OrderPaymentView.as_view(), name="order_payments"),
    path("submissions/", PaymentSubmissionListView.as_view(), name="submission_list"),
    path(
        "submissions/<uuid:submission_id>/review/",
        PaymentReviewView.as_view(),
        name="submission_review",
    ),
]
