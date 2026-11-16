from rest_framework import serializers

from .models import SampleRequest, SampleStatus


class SampleRequestSerializer(serializers.ModelSerializer):
    buyer_name = serializers.CharField(source="buyer.name", read_only=True)
    buyer_phone = serializers.CharField(source="buyer.contact_phone", read_only=True)
    factory_id = serializers.CharField(source="factory.id", read_only=True)
    factory_name = serializers.CharField(source="factory.name", read_only=True)
    roll_id = serializers.CharField(source="fabric_roll.id", read_only=True)
    roll_code = serializers.CharField(source="fabric_roll.roll_code", read_only=True)
    roll_title = serializers.CharField(source="fabric_roll.title", read_only=True)
    roll_color_name = serializers.CharField(source="fabric_roll.color_name", read_only=True)
    roll_color_hex = serializers.CharField(source="fabric_roll.color_hex", read_only=True)

    class Meta:
        model = SampleRequest
        fields = [
            "id",
            "buyer_name",
            "buyer_phone",
            "factory_id",
            "factory_name",
            "roll_id",
            "roll_code",
            "roll_title",
            "roll_color_name",
            "roll_color_hex",
            "swatch_size",
            "notes",
            "delivery_address",
            "sample_price",
            "status",
            "factory_note",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class SampleRequestCreateSerializer(serializers.Serializer):
    fabric_roll = serializers.UUIDField()
    swatch_size = serializers.ChoiceField(
        choices=SampleRequest._meta.get_field("swatch_size").choices, required=False
    )
    notes = serializers.CharField(required=False, allow_blank=True, max_length=1000)
    delivery_address = serializers.CharField(required=False, allow_blank=True, max_length=500)


class SampleStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=SampleStatus.choices)
    note = serializers.CharField(required=False, allow_blank=True, max_length=500)
