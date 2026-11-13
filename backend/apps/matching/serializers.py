from decimal import Decimal

from rest_framework import serializers

from .models import SourcingRequest


class SourcingRequestSerializer(serializers.ModelSerializer):
    buyer_id = serializers.CharField(source="buyer.id", read_only=True)
    buyer_name = serializers.CharField(source="buyer.name", read_only=True)

    class Meta:
        model = SourcingRequest
        fields = [
            "id",
            "buyer_id",
            "buyer_name",
            "fabric_name",
            "target_gsm",
            "required_yards",
            "color_preference",
            "notes",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "buyer_id", "buyer_name", "status", "created_at", "updated_at"]
        extra_kwargs = {
            "target_gsm": {"min_value": 1, "max_value": 2000},
            "required_yards": {"min_value": Decimal("0.5")},
        }

    def validate_fabric_name(self, value):
        value = value.strip()
        if len(value) < 3:
            raise serializers.ValidationError("Describe the fabric in at least 3 characters.")
        return value
