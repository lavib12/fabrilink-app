from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.companies.models import Company, CompanyTypeChoices, VerificationStatusChoices
from apps.companies.selectors import get_user_primary_company
from common.exceptions import NotFoundError, PermissionDeniedError, ValidationError
from common.permissions import CanBuildFabricProfileForBuyer
from common.utils import generate_reference_code

from .models import FabricRoll, FabricRollImage
from .selectors import (
    can_view_fabric_roll,
    get_fabric_roll_by_id,
    list_categories,
    list_fabric_rolls,
)
from .serializers import (
    FabricCategorySerializer,
    FabricRollCreateSerializer,
    FabricRollDetailSerializer,
    FabricRollListSerializer,
)

FALLBACK_IMAGE_BY_CATEGORY = {
    "denim-twill": "https://images.unsplash.com/photo-1582533561751-ef6f6ab93a2e?auto=format&fit=crop&w=1000&q=80",
    "knit-fabrics": "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1000&q=80",
    "luxury-silk": "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1000&q=80",
    "woven-fabrics": "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=1000&q=80",
    "eco-conscious-organic": "https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?auto=format&fit=crop&w=1000&q=80",
}
DEFAULT_FALLBACK_IMAGE = FALLBACK_IMAGE_BY_CATEGORY["denim-twill"]


def _is_platform_admin(user) -> bool:
    return bool(user and user.is_authenticated and (user.role == "ADMIN" or user.is_staff))


def _parse_number(params, key: str, cast):
    """Parse an optional numeric query param, returning a 400 instead of a 500 on bad input."""
    raw = params.get(key)
    if raw in (None, ""):
        return None
    try:
        return cast(raw)
    except (TypeError, ValueError):
        raise ValidationError(f"Query parameter '{key}' must be a number.") from None


class FabricCategoryListView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(responses={200: FabricCategorySerializer(many=True)})
    def get(self, request):
        categories = list_categories()
        serializer = FabricCategorySerializer(categories, many=True)
        return Response({"success": True, "data": serializer.data})


class FabricRollListView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        parameters=[
            OpenApiParameter("search", str, required=False),
            OpenApiParameter("fabric_type", str, required=False),
            OpenApiParameter("category", str, required=False),
            OpenApiParameter("min_gsm", int, required=False),
            OpenApiParameter("max_gsm", int, required=False),
            OpenApiParameter("color", str, required=False),
            OpenApiParameter("min_yards", float, required=False),
            OpenApiParameter("max_price", float, required=False),
            OpenApiParameter("factory_id", str, required=False),
            OpenApiParameter("mine", str, required=False),
            OpenApiParameter("target_buyer_id", str, required=False),
            OpenApiParameter("custom_only", str, required=False),
        ],
        responses={200: FabricRollListSerializer(many=True)},
    )
    def get(self, request):
        params = request.query_params
        factory_id = params.get("factory_id")
        buyer_access_id = None
        is_owner = False
        is_admin = _is_platform_admin(request.user)

        if request.user.is_authenticated:
            user_company = get_user_primary_company(request.user.id)
            if user_company:
                if params.get("mine") == "true":
                    factory_id = str(user_company.id)
                    is_owner = True
                elif factory_id and str(user_company.id) == factory_id:
                    is_owner = True
                if user_company.company_type == CompanyTypeChoices.BUYER:
                    buyer_access_id = str(user_company.id)
            if factory_id and is_admin:
                is_owner = True

        custom_only = params.get("custom_only") == "true"

        # Only owners/admins may filter by an arbitrary buyer. Everyone else is pinned
        # to their own company, so private custom profiles can't be enumerated.
        requested_buyer_id = params.get("target_buyer_id")
        if is_owner or is_admin:
            target_buyer_id = requested_buyer_id
        elif buyer_access_id and (custom_only or requested_buyer_id):
            target_buyer_id = buyer_access_id
        else:
            target_buyer_id = None
            if requested_buyer_id or custom_only:
                # Anonymous users / factories browsing the market have no private profiles.
                return Response({"success": True, "data": []})

        rolls = list_fabric_rolls(
            search=params.get("search"),
            fabric_type=params.get("fabric_type"),
            category=params.get("category"),
            min_gsm=_parse_number(params, "min_gsm", int),
            max_gsm=_parse_number(params, "max_gsm", int),
            color=params.get("color"),
            min_yards=_parse_number(params, "min_yards", float),
            max_price=_parse_number(params, "max_price", float),
            factory_id=factory_id,
            target_buyer_id=target_buyer_id,
            custom_only=custom_only,
            buyer_access_id=buyer_access_id,
            is_owner=is_owner,
        )
        serializer = FabricRollListSerializer(rolls, many=True)
        return Response({"success": True, "data": serializer.data})

    @extend_schema(
        request=FabricRollCreateSerializer,
        responses={201: FabricRollDetailSerializer},
        description="Factory user or Central Admin builds a fabric profile or lists a surplus fabric roll for a buyer",
    )
    def post(self, request):
        if not request.user.is_authenticated:
            return Response(
                {
                    "success": False,
                    "error": {"code": "unauthorized", "message": "Authentication required."},
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not CanBuildFabricProfileForBuyer().has_permission(request, self):
            raise PermissionDeniedError(
                "Only users with the Factory or Administrator role are permitted to build fabric profiles."
            )

        is_admin = _is_platform_admin(request.user)
        company = get_user_primary_company(request.user.id)

        if company is None or company.company_type != CompanyTypeChoices.FACTORY:
            if not is_admin:
                raise PermissionDeniedError(
                    "Only registered garment factories or administrators can build fabric profiles."
                )
            # Admins list on behalf of a factory, which must be named explicitly.
            factory_id = request.data.get("factory_id")
            company = (
                Company.objects.filter(
                    id=factory_id, company_type=CompanyTypeChoices.FACTORY
                ).first()
                if factory_id
                else None
            )
            if company is None:
                raise ValidationError(
                    "Administrators must supply a valid 'factory_id' to list a roll on a factory's behalf."
                )
        elif company.verification_status != VerificationStatusChoices.APPROVED and not is_admin:
            raise PermissionDeniedError(
                "Your factory's KYC verification must be approved before you can list fabric.",
                code="company_not_verified",
            )

        serializer = FabricRollCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = serializer.validated_data

        target_buyer_id = validated_data.pop("target_buyer_id", None)
        target_buyer = None
        if target_buyer_id:
            target_buyer = Company.objects.filter(
                id=target_buyer_id, company_type=CompanyTypeChoices.BUYER
            ).first()
            if not target_buyer:
                raise ValidationError(
                    "Selected buyer company does not exist or is not a registered buyer."
                )
            validated_data["target_buyer"] = target_buyer
            validated_data["is_custom_profile"] = True
        else:
            # A custom profile without a target buyer would be invisible to everyone.
            validated_data["is_custom_profile"] = False

        image_url = (validated_data.pop("image_url", None) or "").strip()
        if validated_data.get("available_yards") is None:
            validated_data["available_yards"] = validated_data["total_yards"]

        roll_code = generate_reference_code(prefix="ROL-2026", length=5)
        while FabricRoll.all_objects.filter(roll_code=roll_code).exists():
            roll_code = generate_reference_code(prefix="ROL-2026", length=5)

        roll = FabricRoll.objects.create(
            factory=company,
            roll_code=roll_code,
            **validated_data,
        )

        if not image_url:
            category_slug = ""
            if roll.fabric_type and roll.fabric_type.category:
                category_slug = roll.fabric_type.category.slug
            image_url = FALLBACK_IMAGE_BY_CATEGORY.get(category_slug, DEFAULT_FALLBACK_IMAGE)

        FabricRollImage.objects.create(fabric_roll=roll, image_url=image_url, is_primary=True)

        success_message = (
            f"Custom fabric profile built successfully for {target_buyer.name}."
            if target_buyer
            else "Surplus fabric roll listed successfully."
        )

        return Response(
            {
                "success": True,
                "message": success_message,
                "data": FabricRollDetailSerializer(get_fabric_roll_by_id(str(roll.id))).data,
            },
            status=status.HTTP_201_CREATED,
        )


class FabricRollDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(responses={200: FabricRollDetailSerializer})
    def get(self, request, roll_id):
        roll = get_fabric_roll_by_id(str(roll_id))
        user_company = (
            get_user_primary_company(request.user.id) if request.user.is_authenticated else None
        )
        # Private custom profiles and unlisted rolls are reported as not found
        # so their existence isn't leaked.
        if not roll or not can_view_fabric_roll(roll, request.user, user_company):
            raise NotFoundError(
                "The specified surplus fabric roll was not found or has been sold out."
            )
        serializer = FabricRollDetailSerializer(roll)
        return Response({"success": True, "data": serializer.data})
