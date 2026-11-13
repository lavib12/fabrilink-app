from django.db.models import Sum
from rest_framework import serializers

from .models import Company, CompanyAddress


class CompanyAddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyAddress
        fields = [
            "id",
            "company",
            "address_type",
            "division",
            "district",
            "upazila_thana",
            "street_address",
            "postal_code",
            "landmark",
            "gps_lat",
            "gps_lng",
            "is_default",
            "created_at",
        ]
        # `company` is always taken from the authenticated user, never from the payload.
        read_only_fields = ["id", "company", "created_at"]


class CompanySerializer(serializers.ModelSerializer):
    addresses = CompanyAddressSerializer(many=True, read_only=True)

    class Meta:
        model = Company
        fields = [
            "id",
            "name",
            "company_type",
            "trade_license_number",
            "tin_number",
            "bin_number",
            "trade_license_file",
            "tin_file",
            "bin_file",
            "verification_status",
            "rejection_reason",
            "contact_email",
            "contact_phone",
            "credit_limit",
            "credit_terms_days",
            "credit_status",
            "addresses",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "verification_status",
            "rejection_reason",
            "credit_limit",
            "credit_terms_days",
            "credit_status",
            "created_at",
            "updated_at",
        ]


class CompanyKYCUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = [
            "name",
            "trade_license_number",
            "tin_number",
            "bin_number",
            "trade_license_file",
            "tin_file",
            "bin_file",
            "contact_email",
            "contact_phone",
        ]


class CompanyVerificationActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["APPROVE", "REJECT", "SUSPEND"])
    rejection_reason = serializers.CharField(required=False, allow_blank=True)
    credit_limit = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
    credit_terms_days = serializers.IntegerField(required=False)


class FactoryStoreSerializer(serializers.ModelSerializer):
    addresses = CompanyAddressSerializer(many=True, read_only=True)
    stats = serializers.SerializerMethodField()

    class Meta:
        model = Company
        fields = [
            "id",
            "name",
            "company_type",
            "verification_status",
            "contact_email",
            "contact_phone",
            "trade_license_number",
            "tin_number",
            "bin_number",
            "addresses",
            "stats",
            "created_at",
        ]

    def get_stats(self, obj):
        from apps.catalog.models import FabricRoll
        from apps.companies.selectors import get_user_primary_company

        active_rolls = FabricRoll.objects.filter(
            factory=obj,
            status__in=["ACTIVE", "RESERVED_PARTIAL"],
            available_yards__gt=0,
            is_deleted=False,
        )
        total_rolls = active_rolls.count()
        total_yards = float(active_rolls.aggregate(total=Sum("available_yards"))["total"] or 0)
        fabric_types_count = active_rolls.values("fabric_type").distinct().count()

        compositions = list(
            active_rolls.exclude(composition="")
            .values_list("composition", flat=True)
            .distinct()[:5]
        )

        request = self.context.get("request")
        custom_profiles_count = 0
        if request and request.user.is_authenticated:
            buyer_comp = get_user_primary_company(request.user.id)
            if buyer_comp and buyer_comp.company_type == "BUYER":
                custom_profiles_count = active_rolls.filter(
                    target_buyer=buyer_comp, is_custom_profile=True
                ).count()

        return {
            "total_active_rolls": total_rolls,
            "total_available_yards": round(total_yards, 2),
            "fabric_types_count": fabric_types_count,
            "compositions": compositions,
            "custom_profiles_count_for_you": custom_profiles_count,
        }
