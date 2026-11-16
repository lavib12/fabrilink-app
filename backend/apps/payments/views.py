from drf_spectacular.utils import extend_schema
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.companies.selectors import get_user_primary_company
from apps.orders.models import Order
from common.exceptions import NotFoundError, PermissionDeniedError

from .models import PaymentSettings, PaymentSubmission
from .serializers import (
    PaymentRecordSerializer,
    PaymentReviewSerializer,
    PaymentSettingsSerializer,
    PaymentSubmissionSerializer,
    PaymentSubmitSerializer,
)
from .services import record_payment_by_admin, review_payment, submit_payment


def _is_admin(user) -> bool:
    return bool(user.is_staff or user.role == "ADMIN")


class PaymentAccountsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(responses={200: PaymentSettingsSerializer})
    def get(self, request):
        return Response({"success": True, "data": PaymentSettingsSerializer(PaymentSettings.load()).data})


class OrderPaymentView(APIView):
    """The buyer's payment proofs for one order, and submitting a new one."""

    permission_classes = [permissions.IsAuthenticated]

    def _order(self, request, order_id):
        order = Order.objects.select_related("buyer").filter(id=order_id).first()
        if order is None:
            raise NotFoundError("Order not found.")
        if not _is_admin(request.user) and order.buyer.user_id != request.user.id:
            raise NotFoundError("Order not found.")
        return order

    @extend_schema(responses={200: PaymentSubmissionSerializer(many=True)})
    def get(self, request, order_id):
        order = self._order(request, order_id)
        qs = order.payment_submissions.select_related("order", "buyer", "reviewed_by")
        return Response({"success": True, "data": PaymentSubmissionSerializer(qs, many=True).data})

    @extend_schema(request=PaymentSubmitSerializer, responses={201: PaymentSubmissionSerializer})
    def post(self, request, order_id):
        order = self._order(request, order_id)
        serializer = PaymentSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        submission = submit_payment(
            order=order, buyer=get_user_primary_company(request.user.id), data=serializer.validated_data
        )
        return Response(
            {
                "success": True,
                "message": "Payment details sent. We'll confirm them shortly.",
                "data": PaymentSubmissionSerializer(submission).data,
            },
            status=status.HTTP_201_CREATED,
        )


class OrderRecordPaymentView(APIView):
    """Admin: mark an order paid from a transaction ID received by phone, SMS or an old app."""

    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(request=PaymentRecordSerializer, responses={201: PaymentSubmissionSerializer})
    def post(self, request, order_id):
        if not _is_admin(request.user):
            raise PermissionDeniedError("Only administrators can record payments.")
        order = Order.objects.filter(id=order_id).first()
        if order is None:
            raise NotFoundError("Order not found.")
        serializer = PaymentRecordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        submission = record_payment_by_admin(
            order=order,
            actor=request.user,
            transaction_id=serializer.validated_data["transaction_id"],
            amount=serializer.validated_data.get("amount"),
            note=serializer.validated_data.get("note", ""),
        )
        return Response(
            {"success": True, "data": PaymentSubmissionSerializer(submission).data},
            status=status.HTTP_201_CREATED,
        )


class PaymentSubmissionListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(responses={200: PaymentSubmissionSerializer(many=True)})
    def get(self, request):
        if not _is_admin(request.user):
            raise PermissionDeniedError("Only administrators can review payments.")
        qs = PaymentSubmission.objects.select_related("order", "buyer", "reviewed_by")
        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return Response({"success": True, "data": PaymentSubmissionSerializer(qs, many=True).data})


class PaymentReviewView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(request=PaymentReviewSerializer, responses={200: PaymentSubmissionSerializer})
    def post(self, request, submission_id):
        if not _is_admin(request.user):
            raise PermissionDeniedError("Only administrators can review payments.")
        submission = PaymentSubmission.objects.filter(id=submission_id).first()
        if submission is None:
            raise NotFoundError("Payment not found.")
        serializer = PaymentReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        submission = review_payment(
            submission=submission,
            action=serializer.validated_data["action"],
            actor=request.user,
            note=serializer.validated_data.get("note", ""),
        )
        return Response({"success": True, "data": PaymentSubmissionSerializer(submission).data})
