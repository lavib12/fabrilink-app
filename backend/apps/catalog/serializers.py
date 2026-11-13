import re

from rest_framework import serializers

from .models import FabricCategory, FabricRoll, FabricRollImage, FabricType


class FabricRollImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = FabricRollImage
        fields = ["id", "image_url", "is_primary", "sort_order"]


class FabricTypeSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = FabricType
        fields = ["id", "name", "slug", "category_name", "default_gsm_range"]


class FabricCategorySerializer(serializers.ModelSerializer):
    fabric_types = FabricTypeSerializer(many=True, read_only=True)

    class Meta:
        model = FabricCategory
        fields = ["id", "name", "slug", "description", "fabric_types"]


class FabricRollListSerializer(serializers.ModelSerializer):
    mill_name = serializers.CharField(source="factory.name", read_only=True)
    factory_id = serializers.CharField(source="factory.id", read_only=True)
    mill_location = serializers.SerializerMethodField()
    fabric_type_name = serializers.CharField(source="fabric_type.name", read_only=True)
    primary_image = serializers.SerializerMethodField()
    target_buyer_name = serializers.CharField(
        source="target_buyer.name", read_only=True, allow_null=True
    )
    target_buyer_id = serializers.CharField(
        source="target_buyer.id", read_only=True, allow_null=True
    )

    class Meta:
        model = FabricRoll
        fields = [
            "id",
            "roll_code",
            "title",
            "fabric_type_name",
            "mill_name",
            "factory_id",
            "mill_location",
            "composition",
            "gsm",
            "width_inches",
            "color_name",
            "color_hex",
            "pattern",
            "finish",
            "available_yards",
            "min_cut_length_yards",
            "price_per_yard",
            "quality_grade",
            "status",
            "is_sample_available",
            "sample_price",
            "primary_image",
            "target_buyer_id",
            "target_buyer_name",
            "is_custom_profile",
            "buyer_spec_notes",
            "created_at",
        ]

    def get_mill_location(self, obj):
        if obj.location_address:
            return f"{obj.location_address.district}, {obj.location_address.division}"
        return "Gazipur, Dhaka"

    def get_primary_image(self, obj):
        # Iterate the prefetched images instead of issuing two queries per roll.
        images = list(obj.images.all())
        primary = next((img for img in images if img.is_primary), None) or (
            images[0] if images else None
        )
        if primary:
            return primary.image_url or (primary.image_file.url if primary.image_file else None)
        return None


class FabricRollDetailSerializer(serializers.ModelSerializer):
    mill_name = serializers.CharField(source="factory.name", read_only=True)
    factory_id = serializers.CharField(source="factory.id", read_only=True)
    mill_contact_phone = serializers.CharField(source="factory.contact_phone", read_only=True)
    mill_location = serializers.SerializerMethodField()
    fabric_type_name = serializers.CharField(source="fabric_type.name", read_only=True)
    category_name = serializers.CharField(source="fabric_type.category.name", read_only=True)
    images = FabricRollImageSerializer(many=True, read_only=True)
    target_buyer_name = serializers.CharField(
        source="target_buyer.name", read_only=True, allow_null=True
    )
    target_buyer_id = serializers.CharField(
        source="target_buyer.id", read_only=True, allow_null=True
    )

    class Meta:
        model = FabricRoll
        fields = [
            "id",
            "roll_code",
            "title",
            "category_name",
            "fabric_type_name",
            "mill_name",
            "factory_id",
            "mill_contact_phone",
            "mill_location",
            "composition",
            "gsm",
            "width_inches",
            "color_name",
            "color_hex",
            "pattern",
            "finish",
            "total_yards",
            "available_yards",
            "min_cut_length_yards",
            "price_per_yard",
            "lot_batch_number",
            "quality_grade",
            "defect_notes",
            "status",
            "is_sample_available",
            "sample_price",
            "target_buyer_id",
            "target_buyer_name",
            "is_custom_profile",
            "buyer_spec_notes",
            "images",
            "created_at",
            "updated_at",
        ]

    def get_mill_location(self, obj):
        if obj.location_address:
            return f"{obj.location_address.street_address}, {obj.location_address.district}, {obj.location_address.division}"
        return "Tejgaon / Gazipur RMG Zone, Bangladesh"


class FabricRollCreateSerializer(serializers.ModelSerializer):
    image_url = serializers.CharField(required=False, allow_blank=True)
    target_buyer_id = serializers.UUIDField(required=False, allow_null=True)

    class Meta:
        model = FabricRoll
        fields = [
            "title",
            "fabric_type",
            "composition",
            "gsm",
            "width_inches",
            "color_name",
            "color_hex",
            "pattern",
            "finish",
            "total_yards",
            "available_yards",
            "min_cut_length_yards",
            "price_per_yard",
            "lot_batch_number",
            "quality_grade",
            "defect_notes",
            "is_sample_available",
            "sample_price",
            "image_url",
            "target_buyer_id",
            "is_custom_profile",
            "buyer_spec_notes",
        ]
        extra_kwargs = {
            "available_yards": {"required": False},
            "min_cut_length_yards": {"required": False},
            "sample_price": {"required": False},
            "is_custom_profile": {"required": False},
            "buyer_spec_notes": {"required": False},
        }

    def validate_color_hex(self, value):
        if not re.fullmatch(r"#[0-9A-Fa-f]{6}", value or ""):
            raise serializers.ValidationError("Use a 6-digit hex colour such as #1E3A8A.")
        return value.upper()

    def validate(self, attrs):
        positive_fields = ["gsm", "width_inches", "total_yards", "price_per_yard"]
        for field in positive_fields:
            if field in attrs and attrs[field] is not None and attrs[field] <= 0:
                raise serializers.ValidationError({field: "Must be greater than zero."})

        total = attrs.get("total_yards")
        available = attrs.get("available_yards")
        if available is not None:
            if available < 0:
                raise serializers.ValidationError({"available_yards": "Cannot be negative."})
            if total is not None and available > total:
                raise serializers.ValidationError(
                    {"available_yards": "Available yards cannot exceed total yards."}
                )

        min_cut = attrs.get("min_cut_length_yards")
        if min_cut is not None:
            if min_cut <= 0:
                raise serializers.ValidationError(
                    {"min_cut_length_yards": "Must be greater than zero."}
                )
            if total is not None and min_cut > total:
                raise serializers.ValidationError(
                    {"min_cut_length_yards": "Minimum cut cannot exceed total yards."}
                )

        sample_price = attrs.get("sample_price")
        if sample_price is not None and sample_price < 0:
            raise serializers.ValidationError({"sample_price": "Cannot be negative."})
        return attrs
