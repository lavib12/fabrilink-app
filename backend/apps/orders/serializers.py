from decimal import Decimal

from rest_framework import serializers

from .models import CartItem, Order, OrderItem, OrderStatusChoices, OrderTrackingEvent


class CartItemSerializer(serializers.ModelSerializer):
    roll_code = serializers.CharField(source="fabric_roll.roll_code", read_only=True)
    roll_title = serializers.CharField(source="fabric_roll.title", read_only=True)
    roll_color_name = serializers.CharField(source="fabric_roll.color_name", read_only=True)
    roll_color_hex = serializers.CharField(source="fabric_roll.color_hex", read_only=True)
    roll_gsm = serializers.IntegerField(source="fabric_roll.gsm", read_only=True)
    roll_width = serializers.DecimalField(
        source="fabric_roll.width_inches", max_digits=5, decimal_places=2, read_only=True
    )
    roll_available_yards = serializers.DecimalField(
        source="fabric_roll.available_yards", max_digits=10, decimal_places=2, read_only=True
    )
    roll_min_cut = serializers.DecimalField(
        source="fabric_roll.min_cut_length_yards", max_digits=8, decimal_places=2, read_only=True
    )
    item_subtotal = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = CartItem
        fields = [
            "id",
            "fabric_roll",
            "roll_code",
            "roll_title",
            "roll_color_name",
            "roll_color_hex",
            "roll_gsm",
            "roll_width",
            "roll_available_yards",
            "roll_min_cut",
            "requested_yards",
            "unit_price",
            "item_subtotal",
            "created_at",
        ]
        read_only_fields = ["id", "unit_price", "created_at"]


class AddToCartSerializer(serializers.Serializer):
    fabric_roll_id = serializers.UUIDField()
    requested_yards = serializers.DecimalField(
        max_digits=8, decimal_places=2, min_value=Decimal("0.01")
    )


class CheckoutRequestSerializer(serializers.Serializer):
    payment_method = serializers.ChoiceField(
        choices=["BKASH", "NAGAD", "SSLCOMMERZ", "B2B_CREDIT", "COD"],
        default="BKASH",
    )
    delivery_notes = serializers.CharField(required=False, allow_blank=True)
    item_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        allow_empty=False,
        help_text="Optional subset of cart item IDs to check out. Defaults to the whole cart.",
    )


class OrderStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=OrderStatusChoices.choices)
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    location = serializers.CharField(required=False, allow_blank=True, default="")


class OrderItemSerializer(serializers.ModelSerializer):
    roll_code = serializers.CharField(source="fabric_roll.roll_code", read_only=True)
    roll_title = serializers.CharField(source="fabric_roll.title", read_only=True)
    color_name = serializers.CharField(source="fabric_roll.color_name", read_only=True)

    class Meta:
        model = OrderItem
        fields = [
            "id",
            "fabric_roll",
            "roll_code",
            "roll_title",
            "color_name",
            "requested_yards",
            "unit_price",
            "subtotal",
            "status",
        ]


class OrderTrackingEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderTrackingEvent
        fields = [
            "id",
            "from_status",
            "to_status",
            "title",
            "description",
            "location",
            "created_at",
        ]


class OrderDetailSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    tracking_events = OrderTrackingEventSerializer(many=True, read_only=True)
    buyer_name = serializers.CharField(source="buyer.name", read_only=True)

    class Meta:
        model = Order
        fields = [
            "id",
            "order_number",
            "buyer_name",
            "status",
            "items_subtotal",
            "platform_commission_fee",
            "cutting_fee",
            "delivery_fee",
            "vat_tax_amount",
            "total_amount",
            "currency",
            "payment_method",
            "delivery_notes",
            "cancellation_reason",
            "items",
            "tracking_events",
            "created_at",
            "updated_at",
        ]
