from django.http import HttpResponse
from django.urls import reverse
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

from .gateway import complete_gateway_payment, start_gateway_payment
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

    @extend_schema(request=PaymentSettingsSerializer, responses={200: PaymentSettingsSerializer})
    def patch(self, request):
        """Admins edit where buyers send money, from the app."""
        if not _is_admin(request.user):
            raise PermissionDeniedError("Only administrators can change payment accounts.")
        serializer = PaymentSettingsSerializer(PaymentSettings.load(), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"success": True, "message": "Payment accounts saved.", "data": serializer.data})


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


class GatewayStartView(APIView):
    """Buyer: get the SSLCommerz payment page for an order (bKash / Nagad / card)."""

    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(request=None, responses={201: dict})
    def post(self, request, order_id):
        order = Order.objects.select_related("buyer").filter(id=order_id).first()
        if order is None or order.buyer.user_id != request.user.id:
            raise NotFoundError("Order not found.")

        def url(name, **kw):
            return request.build_absolute_uri(reverse(name, kwargs=kw))

        gp = start_gateway_payment(
            order=order,
            buyer=order.buyer,
            urls={
                "success": url("payments:gateway_return", outcome="success"),
                "fail": url("payments:gateway_return", outcome="fail"),
                "cancel": url("payments:gateway_return", outcome="cancel"),
                "ipn": url("payments:gateway_ipn"),
            },
        )
        return Response(
            {"success": True, "data": {"url": gp.detail["url"], "tran_id": gp.tran_id, "sandbox": gp.sandbox}},
            status=status.HTTP_201_CREATED,
        )


RETURN_PAGE = """<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>FabriLink</title>
<meta http-equiv="refresh" content="1;url={link}">
<style>body{{font-family:system-ui,sans-serif;background:#f3f1ec;color:#17262b;display:flex;min-height:100vh;
align-items:center;justify-content:center;margin:0;text-align:center;padding:24px}}
a{{display:inline-block;margin-top:18px;background:#0e6f69;color:#fff;padding:14px 22px;border-radius:12px;
text-decoration:none;font-weight:600}}</style></head><body><div><h2>{title}</h2><p>{body}</p>
<a href="{link}">{button}</a></div><script>window.location.replace("{link}");</script></body></html>"""

RETURN_TEXT = {
    "success": ("Payment received", "পেমেন্ট সম্পন্ন হয়েছে। অ্যাপে ফিরে যাচ্ছি…"),
    "fail": ("Payment didn't go through", "পেমেন্ট হয়নি। অ্যাপে ফিরে আবার চেষ্টা করুন।"),
    "cancel": ("Payment cancelled", "পেমেন্ট বাতিল করা হয়েছে। অ্যাপে ফিরে যাচ্ছি…"),
}


class GatewayReturnView(APIView):
    """SSLCommerz sends the buyer's browser here after paying; we confirm and hand back to the app."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    parser_classes = [FormParser, MultiPartParser]

    def _handle(self, request, outcome):
        data = request.data if request.method == "POST" else request.query_params
        gp = complete_gateway_payment(
            tran_id=data.get("tran_id", ""), val_id=data.get("val_id", ""), outcome=outcome
        )
        result = "success" if gp is not None and gp.status == "SUCCESS" else ("cancel" if outcome == "cancel" else "fail")
        title, body = RETURN_TEXT[result]
        link = f"fabrilink://order/{gp.order_id}?payment={result}" if gp is not None else "fabrilink://buyer/orders"
        html = RETURN_PAGE.format(link=link, title=title, body=body, button="Open FabriLink / অ্যাপে ফিরুন")
        return HttpResponse(html)

    @extend_schema(exclude=True)
    def post(self, request, outcome):
        return self._handle(request, outcome)

    @extend_schema(exclude=True)
    def get(self, request, outcome):
        return self._handle(request, outcome)


class GatewayIPNView(APIView):
    """SSLCommerz server-to-server notice, so payments count even if the buyer closes the page."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    parser_classes = [FormParser, MultiPartParser]

    @extend_schema(exclude=True)
    def post(self, request):
        status_ = (request.data.get("status") or "").upper()
        outcome = "success" if status_ in ("VALID", "VALIDATED") else ("cancel" if status_ == "CANCELLED" else "fail")
        gp = complete_gateway_payment(
            tran_id=request.data.get("tran_id", ""), val_id=request.data.get("val_id", ""), outcome=outcome
        )
        return Response({"received": gp is not None})


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
