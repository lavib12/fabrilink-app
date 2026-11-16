from drf_spectacular.utils import extend_schema
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.companies.selectors import get_user_primary_company
from common.exceptions import NotFoundError

from .serializers import (
    SampleRequestCreateSerializer,
    SampleRequestSerializer,
    SampleStatusUpdateSerializer,
)
from .services import create_sample_request, requests_visible_to, update_sample_status


class SampleRequestListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        responses={200: SampleRequestSerializer(many=True)},
        description="Buyers: samples they asked for. Factories: requests for their rolls. Admins: all.",
    )
    def get(self, request):
        company = get_user_primary_company(request.user.id)
        qs = requests_visible_to(request.user, company)
        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        roll_filter = request.query_params.get("roll")
        if roll_filter:
            qs = qs.filter(fabric_roll_id=roll_filter)
        return Response({"success": True, "data": SampleRequestSerializer(qs, many=True).data})

    @extend_schema(request=SampleRequestCreateSerializer, responses={201: SampleRequestSerializer})
    def post(self, request):
        serializer = SampleRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        sample = create_sample_request(
            user=request.user,
            buyer=get_user_primary_company(request.user.id),
            roll_id=data["fabric_roll"],
            swatch_size=data.get("swatch_size"),
            notes=data.get("notes", ""),
            delivery_address=data.get("delivery_address", ""),
        )
        return Response(
            {
                "success": True,
                "message": "Sample requested. The mill will confirm it soon.",
                "data": SampleRequestSerializer(sample).data,
            },
            status=status.HTTP_201_CREATED,
        )


def _get_visible(request, sample_id):
    company = get_user_primary_company(request.user.id)
    sample = requests_visible_to(request.user, company).filter(id=sample_id).first()
    if sample is None:
        raise NotFoundError("Sample request not found.")
    return company, sample


class SampleRequestDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(responses={200: SampleRequestSerializer})
    def get(self, request, sample_id):
        _, sample = _get_visible(request, sample_id)
        return Response({"success": True, "data": SampleRequestSerializer(sample).data})


class SampleRequestStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(request=SampleStatusUpdateSerializer, responses={200: SampleRequestSerializer})
    def post(self, request, sample_id):
        company, sample = _get_visible(request, sample_id)
        serializer = SampleStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        sample = update_sample_status(
            user=request.user,
            company=company,
            sample=sample,
            status=serializer.validated_data["status"],
            note=serializer.validated_data.get("note", ""),
        )
        return Response({"success": True, "data": SampleRequestSerializer(sample).data})
