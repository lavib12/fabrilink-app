from drf_spectacular.utils import extend_schema
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.serializers import FabricRollListSerializer
from apps.companies.models import CompanyTypeChoices, VerificationStatusChoices
from apps.companies.selectors import get_user_primary_company
from common.exceptions import InvalidStateTransitionError, NotFoundError, PermissionDeniedError

from .models import SourcingRequest, SourcingRequestStatus
from .selectors import find_matching_rolls, requests_visible_to
from .serializers import SourcingRequestSerializer


def _get_visible_request(request, request_id) -> SourcingRequest:
    company = get_user_primary_company(request.user.id)
    obj = requests_visible_to(request.user, company).filter(id=request_id).first()
    if obj is None:
        raise NotFoundError("Sourcing request not found.")
    return obj


class SourcingRequestListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        responses={200: SourcingRequestSerializer(many=True)},
        description="Buyers: your requests. Verified factories: open requests from buyers. Admins: all.",
    )
    def get(self, request):
        company = get_user_primary_company(request.user.id)
        qs = requests_visible_to(request.user, company)
        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return Response({"success": True, "data": SourcingRequestSerializer(qs, many=True).data})

    @extend_schema(request=SourcingRequestSerializer, responses={201: SourcingRequestSerializer})
    def post(self, request):
        company = get_user_primary_company(request.user.id)
        if not company or company.company_type != CompanyTypeChoices.BUYER:
            raise PermissionDeniedError("Only buyer accounts can post sourcing requests.")
        if company.verification_status != VerificationStatusChoices.APPROVED:
            raise PermissionDeniedError(
                "Your company's KYC verification must be approved before posting requests.",
                code="company_not_verified",
            )
        serializer = SourcingRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        obj = serializer.save(buyer=company)
        return Response(
            {
                "success": True,
                "message": "Sourcing request posted. Verified mills can now see it.",
                "data": SourcingRequestSerializer(obj).data,
            },
            status=status.HTTP_201_CREATED,
        )


class SourcingRequestDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(responses={200: SourcingRequestSerializer})
    def get(self, request, request_id):
        obj = _get_visible_request(request, request_id)
        return Response({"success": True, "data": SourcingRequestSerializer(obj).data})


class SourcingRequestCloseView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(request=None, responses={200: SourcingRequestSerializer})
    def post(self, request, request_id):
        obj = _get_visible_request(request, request_id)
        is_admin = request.user.is_staff or request.user.role == "ADMIN"
        if obj.buyer.user_id != request.user.id and not is_admin:
            raise PermissionDeniedError("Only the buyer who posted this request can close it.")
        if obj.status != SourcingRequestStatus.OPEN:
            raise InvalidStateTransitionError("This request is already closed.")
        obj.status = (
            SourcingRequestStatus.FULFILLED
            if request.data.get("fulfilled") in (True, "true", "1")
            else SourcingRequestStatus.CLOSED
        )
        obj.save(update_fields=["status", "updated_at"])
        return Response({"success": True, "data": SourcingRequestSerializer(obj).data})


class SourcingRequestMatchesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(responses={200: FabricRollListSerializer(many=True)})
    def get(self, request, request_id):
        obj = _get_visible_request(request, request_id)
        is_admin = request.user.is_staff or request.user.role == "ADMIN"
        # Matches can include the buyer's private custom profiles, so only they see them.
        if obj.buyer.user_id != request.user.id and not is_admin:
            raise PermissionDeniedError("Only the buyer who posted this request can see matches.")
        rolls = find_matching_rolls(obj)
        return Response({"success": True, "data": FabricRollListSerializer(rolls, many=True).data})
