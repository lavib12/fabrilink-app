from django.urls import path

from .views import (
    OrderPaymentView,
    OrderRecordPaymentView,
    PaymentAccountsView,
    PaymentReviewView,
    PaymentSubmissionListView,
    ReceiptFileView,
    ReceiptUploadView,
)

app_name = "payments"

urlpatterns = [
    path("accounts/", PaymentAccountsView.as_view(), name="accounts"),
    path("receipts/", ReceiptUploadView.as_view(), name="receipt_upload"),
    path("receipts/<uuid:receipt_id>/", ReceiptFileView.as_view(), name="receipt_file"),
    path("orders/<uuid:order_id>/", OrderPaymentView.as_view(), name="order_payments"),
    path("orders/<uuid:order_id>/record/", OrderRecordPaymentView.as_view(), name="order_record"),
    path("submissions/", PaymentSubmissionListView.as_view(), name="submission_list"),
    path(
        "submissions/<uuid:submission_id>/review/",
        PaymentReviewView.as_view(),
        name="submission_review",
    ),
]
