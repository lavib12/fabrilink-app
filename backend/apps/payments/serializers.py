import re
from decimal import Decimal

from django.conf import settings
from django.urls import reverse
from rest_framework import serializers

from .models import PaymentSettings, PaymentSubmission


class PaymentSettingsSerializer(serializers.ModelSerializer):
    bkash_account_type_label = serializers.CharField(source="get_bkash_account_type_display", read_only=True)
    nagad_account_type_label = serializers.CharField(source="get_nagad_account_type_display", read_only=True)
    # True once a live SSLCommerz store is configured. Until then the app takes bKash/Nagad
    # by Send Money + TrxID and hides card payments.
    gateway_live = serializers.SerializerMethodField()

    class Meta:
        model = PaymentSettings
        exclude = ["id"]
        read_only_fields = ["updated_at"]

    def get_gateway_live(self, obj) -> bool:
        return not settings.SSLCOMMERZ_SANDBOX

    def _wallet(self, value):
        digits = re.sub(r"\D", "", value or "")
        if digits.startswith("880"):
            digits = digits[2:]
        if digits and not re.fullmatch(r"01[3-9]\d{8}", digits):
            raise serializers.ValidationError("Enter an 11-digit number such as 01712345678.")
        return digits

    def validate_bkash_number(self, value):
        return self._wallet(value)

    def validate_nagad_number(self, value):
        return self._wallet(value)

    def validate_bank_routing_number(self, value):
        value = re.sub(r"\s", "", value or "")
        if value and not re.fullmatch(r"\d{9}", value):
            raise serializers.ValidationError("A Bangladesh routing number has 9 digits.")
        return value

    def validate_bank_swift_code(self, value):
        value = re.sub(r"\s", "", value or "").upper()
        if value and not re.fullmatch(r"[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?", value):
            raise serializers.ValidationError("A SWIFT/BIC code has 8 or 11 characters, e.g. BALBBDDH.")
        return value

    def validate_bank_account_number(self, value):
        return re.sub(r"\s", "", value or "")


class PaymentSubmissionSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source="order.order_number", read_only=True)
    order_total = serializers.DecimalField(
        source="order.total_amount", max_digits=12, decimal_places=2, read_only=True
    )
    order_id = serializers.CharField(source="order.id", read_only=True)
    buyer_name = serializers.CharField(source="buyer.name", read_only=True)
    buyer_phone = serializers.CharField(source="buyer.contact_phone", read_only=True)
    method_label = serializers.CharField(source="get_method_display", read_only=True)
    reviewed_by_email = serializers.CharField(source="reviewed_by.email", read_only=True, default=None)
    receipt_url = serializers.SerializerMethodField()

    def get_receipt_url(self, obj) -> str | None:
        if not obj.receipt_id:
            return None
        path = reverse("payments:receipt_file", args=[obj.receipt_id])
        request = self.context.get("request")
        return request.build_absolute_uri(path) if request else path

    class Meta:
        model = PaymentSubmission
        fields = [
            "id",
            "order_id",
            "order_number",
            "order_total",
            "buyer_name",
            "buyer_phone",
            "method",
            "method_label",
            "amount",
            "currency",
            "transaction_id",
            "sender_account",
            "sender_name",
            "sender_bank_name",
            "sender_bank_country",
            "sender_swift_code",
            "transfer_date",
            "note",
            "sender_address",
            "charges_option",
            "payment_purpose",
            "receipt_url",
            "status",
            "review_note",
            "reviewed_by_email",
            "reviewed_at",
            "created_at",
        ]
        read_only_fields = fields


class PaymentSubmitSerializer(serializers.Serializer):
    """Shape only; method-specific rules live in services._clean()."""

    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    currency = serializers.CharField(required=False, allow_blank=True, max_length=3)
    transaction_id = serializers.CharField(max_length=64)
    sender_account = serializers.CharField(required=False, allow_blank=True, max_length=50)
    sender_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    sender_bank_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    sender_bank_country = serializers.CharField(required=False, allow_blank=True, max_length=80)
    sender_swift_code = serializers.CharField(required=False, allow_blank=True, max_length=15)
    transfer_date = serializers.DateField(required=False, allow_null=True)
    note = serializers.CharField(required=False, allow_blank=True, max_length=1000)
    sender_address = serializers.CharField(required=False, allow_blank=True, max_length=255)
    charges_option = serializers.CharField(required=False, allow_blank=True, max_length=3)
    payment_purpose = serializers.CharField(required=False, allow_blank=True, max_length=140)
    receipt_id = serializers.UUIDField(required=False, allow_null=True)


class PaymentRecordSerializer(serializers.Serializer):
    transaction_id = serializers.CharField(max_length=64)
    amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0.01"), required=False
    )
    note = serializers.CharField(required=False, allow_blank=True, max_length=500)


class PaymentReviewSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["VERIFY", "REJECT"])
    note = serializers.CharField(required=False, allow_blank=True, max_length=500)
