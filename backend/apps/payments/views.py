from django.http import HttpResponse
from drf_spectacular.utils import extend_schema
from rest_framework import permissions, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.models import UploadedImage
from apps.catalog.uploads import MAX_UPLOAD_BYTES, _shrink_to_jpeg
from apps.companies.models import CompanyTypeChoices
from apps.companies.selectors import get_user_primary_company
from apps.orders.models import Order
from common.exceptions import NotFoundError, PermissionDeniedError, ValidationError

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


def _ser(request, obj, many=False):
    return PaymentSubmissionSerializer(obj, many=many, context={"request": request}).data


class PaymentAccountsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(responses={200: PaymentSettingsSerializer})
    def get(self, request):
        return Response({"success": True, "data": PaymentSettingsSerializer(PaymentSettings.load()).data})


class ReceiptUploadView(APIView):
    """Buyer uploads a payment screenshot or bank slip before submitting the proof."""

    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        request={"multipart/form-data": {"type": "object", "properties": {"image": {"type": "string", "format": "binary"}}}},
        responses={201: dict},
    )
    def post(self, request):
        company = get_user_primary_company(request.user.id)
        if company is None or company.company_type != CompanyTypeChoices.BUYER:
            raise PermissionDeniedError("Only buyers upload payment receipts.")
        upload = request.FILES.get("image")
        if upload is None:
            raise ValidationError("Attach the receipt image in the 'image' field.")
        if upload.size > MAX_UPLOAD_BYTES:
            raise ValidationError("That image is too large. Use one under 12 MB.")
        data, width, height = _shrink_to_jpeg(upload.read())
        image = UploadedImage.objects.create(
            uploaded_by=request.user,
            company=company,
            is_private=True,
            content_type="image/jpeg",
            data=data,
            width=width,
            height=height,
            size_bytes=len(data),
        )
        return Response({"success": True, "data": {"id": str(image.id)}}, status=status.HTTP_201_CREATED)


class ReceiptFileView(APIView):
    """Serves a receipt only to the buyer who uploaded it and to admins."""

    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(exclude=True)
    def get(self, request, receipt_id):
        image = UploadedImage.objects.filter(id=receipt_id, is_private=True).first()
        if image is None:
            raise NotFoundError("Receipt not found.")
        if not _is_admin(request.user):
            company = get_user_primary_company(request.user.id)
            if company is None or image.company_id != company.id:
                raise NotFoundError("Receipt not found.")
        response = HttpResponse(bytes(image.data), content_type=image.content_type)
        response["Cache-Control"] = "private, max-age=86400"
        return response


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
        return Response({"success": True, "data": _ser(request, qs, many=True)})

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
                "data": _ser(request, submission),
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
        return Response({"success": True, "data": _ser(request, submission)}, status=status.HTTP_201_CREATED)


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
        return Response({"success": True, "data": _ser(request, qs, many=True)})


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
        return Response({"success": True, "data": _ser(request, submission)})
