from drf_spectacular.utils import extend_schema
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from common.exceptions import NotFoundError
from common.permissions import CanBuildFabricProfileForBuyer, IsAdmin

from .models import Company, CompanyTypeChoices, VerificationStatusChoices
from .selectors import (
    get_user_primary_company,
    list_company_addresses,
    list_pending_companies,
)
from .serializers import (
    CompanyAddressSerializer,
    CompanyKYCUpdateSerializer,
    CompanySerializer,
    CompanyVerificationActionSerializer,
    FactoryStoreSerializer,
)
from .services import (
    create_company_address,
    update_company_kyc,
    verify_company,
)


class MyCompanyView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        responses={200: CompanySerializer},
        description="Get current user company details and verification status",
    )
    def get(self, request):
        company = get_user_primary_company(request.user.id)
        if not company:
            return Response(
                {
                    "success": False,
                    "error": {
                        "code": "no_company",
                        "message": "No company associated with this account.",
                    },
                },
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response({"success": True, "data": CompanySerializer(company).data})

    @extend_schema(
        request=CompanyKYCUpdateSerializer,
        responses={200: CompanySerializer},
        description="Update company KYC details and documents",
    )
    def patch(self, request):
        company = get_user_primary_company(request.user.id)
        if not company:
            return Response(
                {"success": False, "error": {"code": "no_company", "message": "No company found."}},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = CompanyKYCUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = update_company_kyc(company=company, data=serializer.validated_data)
        return Response({"success": True, "data": CompanySerializer(updated).data})


class CompanyAddressListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(responses={200: CompanyAddressSerializer(many=True)})
    def get(self, request):
        company = get_user_primary_company(request.user.id)
        if not company:
            return Response({"success": True, "data": []})
        addresses = list_company_addresses(str(company.id))
        return Response(
            {"success": True, "data": CompanyAddressSerializer(addresses, many=True).data}
        )

    @extend_schema(request=CompanyAddressSerializer, responses={201: CompanyAddressSerializer})
    def post(self, request):
        company = get_user_primary_company(request.user.id)
        if not company:
            return Response(
                {"success": False, "error": {"code": "no_company", "message": "No company found."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = CompanyAddressSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        address = create_company_address(company=company, data=serializer.validated_data)
        return Response(
            {"success": True, "data": CompanyAddressSerializer(address).data},
            status=status.HTTP_201_CREATED,
        )


class AdminKYCQueueView(APIView):
    permission_classes = [IsAdmin]

    @extend_schema(
        responses={200: CompanySerializer(many=True)},
        description="List companies pending KYC approval or filter by status",
    )
    def get(self, request):
        status_param = request.query_params.get("status")
        if status_param == "ALL":
            companies = Company.objects.prefetch_related("addresses").all().order_by("-created_at")
        elif status_param:
            companies = (
                Company.objects.filter(verification_status=status_param)
                .prefetch_related("addresses")
                .order_by("-created_at")
            )
        else:
            companies = list_pending_companies()
        return Response({"success": True, "data": CompanySerializer(companies, many=True).data})


class AdminVerifyCompanyView(APIView):
    permission_classes = [IsAdmin]

    @extend_schema(
        request=CompanyVerificationActionSerializer,
        responses={200: CompanySerializer},
        description="Approve or reject company KYC",
    )
    def post(self, request, company_id):
        serializer = CompanyVerificationActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        company = verify_company(
            company_id=str(company_id),
            action=serializer.validated_data["action"],
            rejection_reason=serializer.validated_data.get("rejection_reason", ""),
            credit_limit=serializer.validated_data.get("credit_limit"),
            credit_terms_days=serializer.validated_data.get("credit_terms_days"),
        )
        return Response({"success": True, "data": CompanySerializer(company).data})


class BuyerListView(APIView):
    """List registered buyer companies (boutiques / brands) for factory users to select when building fabric profiles."""

    # Buyer contact details must not be exposed to other buyers.
    permission_classes = [CanBuildFabricProfileForBuyer]

    @extend_schema(
        responses={200: CompanySerializer(many=True)},
        description="List registered buyer companies so factories can select a buyer to build a custom fabric profile",
    )
    def get(self, request):
        buyers = Company.objects.filter(company_type=CompanyTypeChoices.BUYER).order_by("name")
        return Response(
            {
                "success": True,
                "data": [
                    {
                        "id": str(b.id),
                        "name": b.name,
                        "contact_email": b.contact_email,
                        "contact_phone": b.contact_phone,
                        "verification_status": b.verification_status,
                    }
                    for b in buyers
                ],
            }
        )


class FactoryStoreListView(APIView):
    """List verified garment factories / mills with active surplus stores."""

    permission_classes = [permissions.AllowAny]

    @extend_schema(
        responses={200: FactoryStoreSerializer(many=True)},
        description="List verified garment mills with active surplus fabric stores",
    )
    def get(self, request):
        factories = (
            Company.objects.filter(
                company_type=CompanyTypeChoices.FACTORY,
                verification_status=VerificationStatusChoices.APPROVED,
            )
            .prefetch_related("addresses")
            .order_by("name")
        )
        serializer = FactoryStoreSerializer(factories, many=True, context={"request": request})
        return Response({"success": True, "data": serializer.data})


class FactoryStorefrontDetailView(APIView):
    """Retrieve full storefront details of a garment factory mill."""

    permission_classes = [permissions.AllowAny]

    @extend_schema(
        responses={200: FactoryStoreSerializer},
        description="Get garment factory storefront profile, location, and surplus stats",
    )
    def get(self, request, factory_id):
        factory = (
            Company.objects.filter(
                id=factory_id,
                company_type=CompanyTypeChoices.FACTORY,
                verification_status=VerificationStatusChoices.APPROVED,
            )
            .prefetch_related("addresses")
            .first()
        )
        if not factory:
            raise NotFoundError("Garment factory store not found.")

        serializer = FactoryStoreSerializer(factory, context={"request": request})
        return Response({"success": True, "data": serializer.data})
