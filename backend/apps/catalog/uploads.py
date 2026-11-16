"""Listing photo upload: validate, shrink, store, and serve."""

from io import BytesIO

from django.http import HttpResponse
from django.urls import reverse
from drf_spectacular.utils import extend_schema
from PIL import Image, ImageOps, UnidentifiedImageError
from rest_framework import permissions, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.companies.models import CompanyTypeChoices
from apps.companies.selectors import get_user_primary_company
from common.exceptions import NotFoundError, PermissionDeniedError, ValidationError

from .models import UploadedImage

MAX_UPLOAD_BYTES = 12 * 1024 * 1024
MAX_SIDE = 1600
JPEG_QUALITY = 82


def _shrink_to_jpeg(raw: bytes) -> tuple[bytes, int, int]:
    try:
        img = Image.open(BytesIO(raw))
        img.load()
    except (UnidentifiedImageError, OSError):
        raise ValidationError("That file isn't a photo we can read. Use a JPG or PNG.") from None
    img = ImageOps.exif_transpose(img)  # keep phone photos the right way up
    if img.mode not in ("RGB", "L"):
        background = Image.new("RGB", img.size, (255, 255, 255))
        if img.mode in ("RGBA", "LA", "P"):
            img = img.convert("RGBA")
            background.paste(img, mask=img.split()[-1])
            img = background
        else:
            img = img.convert("RGB")
    img.thumbnail((MAX_SIDE, MAX_SIDE))
    out = BytesIO()
    img.save(out, format="JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
    return out.getvalue(), img.width, img.height


class ImageUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        request={"multipart/form-data": {"type": "object", "properties": {"image": {"type": "string", "format": "binary"}}}},
        responses={201: dict},
        description="Factories and admins upload a listing photo; returns a public URL to use as image_url.",
    )
    def post(self, request):
        user = request.user
        is_admin = user.is_staff or user.role == "ADMIN"
        company = get_user_primary_company(user.id)
        if not is_admin and (company is None or company.company_type != CompanyTypeChoices.FACTORY):
            raise PermissionDeniedError("Only factories can upload listing photos.")

        upload = request.FILES.get("image")
        if upload is None:
            raise ValidationError("Attach a photo in the 'image' field.")
        if upload.size > MAX_UPLOAD_BYTES:
            raise ValidationError("That photo is too large. Use one under 12 MB.")

        data, width, height = _shrink_to_jpeg(upload.read())
        image = UploadedImage.objects.create(
            uploaded_by=user,
            company=company,
            content_type="image/jpeg",
            data=data,
            width=width,
            height=height,
            size_bytes=len(data),
        )
        url = request.build_absolute_uri(reverse("catalog:image_file", args=[image.id]))
        return Response(
            {"success": True, "data": {"id": str(image.id), "url": url, "width": width, "height": height}},
            status=status.HTTP_201_CREATED,
        )


class ImageFileView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    @extend_schema(exclude=True)
    def get(self, request, image_id):
        image = UploadedImage.objects.filter(id=image_id).only("data", "content_type").first()
        if image is None:
            raise NotFoundError("Image not found.")
        response = HttpResponse(bytes(image.data), content_type=image.content_type)
        # Uploads never change, so phones and browsers can keep them.
        response["Cache-Control"] = "public, max-age=31536000, immutable"
        return response
