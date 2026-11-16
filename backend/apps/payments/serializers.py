from decimal import Decimal

from rest_framework import serializers

from .models import PaymentSettings, PaymentSubmission


class PaymentSettingsSerializer(serializers.ModelSerializer):
    bkash_account_type_label = serializers.CharField(source="get_bkash_account_type_display", read_only=True)
    nagad_account_type_label = serializers.CharField(source="get_nagad_account_type_display", read_only=True)

    class Meta:
        model = PaymentSettings
        exclude = ["id"]


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


class PaymentRecordSerializer(serializers.Serializer):
    transaction_id = serializers.CharField(max_length=64)
    amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0.01"), required=False
    )
    note = serializers.CharField(required=False, allow_blank=True, max_length=500)


class PaymentReviewSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["VERIFY", "REJECT"])
    note = serializers.CharField(required=False, allow_blank=True, max_length=500)
