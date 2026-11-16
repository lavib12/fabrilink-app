from decimal import Decimal
from io import BytesIO

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APIClient

from apps.catalog.models import FabricCategory, FabricRoll, FabricType, UploadedImage
from apps.companies.models import Company, CompanyTypeChoices, VerificationStatusChoices
from apps.users.models import RoleChoices, User

UPLOAD = "/api/v1/catalog/images/"


def _photo(size=(3000, 2000), fmt="PNG", mode="RGBA"):
    buf = BytesIO()
    Image.new(mode, size, (200, 30, 60, 255) if mode == "RGBA" else (200, 30, 60)).save(buf, format=fmt)
    return SimpleUploadedFile(f"fabric.{fmt.lower()}", buf.getvalue(), content_type=f"image/{fmt.lower()}")


def _user(email, phone, role, ctype):
    user = User.objects.create_user(email=email, phone=phone, role=role)
    Company.objects.create(
        user=user, name=email, company_type=ctype, verification_status=VerificationStatusChoices.APPROVED
    )
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.fixture
def mill(db):
    return _user("mill@u.com", "+8801730000001", RoleChoices.FACTORY, CompanyTypeChoices.FACTORY)


def test_factory_uploads_photo_shrunk_to_jpeg_and_it_is_served(mill):
    res = mill.post(UPLOAD, {"image": _photo()}, format="multipart")
    assert res.status_code == 201
    data = res.data["data"]
    assert max(data["width"], data["height"]) == 1600
    assert data["url"].endswith(f"/api/v1/catalog/images/{data['id']}/")

    served = APIClient().get(f"/api/v1/catalog/images/{data['id']}/")
    assert served.status_code == 200
    assert served["Content-Type"] == "image/jpeg"
    assert Image.open(BytesIO(served.content)).format == "JPEG"
    assert UploadedImage.objects.get(id=data["id"]).size_bytes == len(served.content)


def test_buyer_cannot_upload_and_junk_is_rejected(db, mill):
    buyer = _user("buyer@u.com", "+8801730000002", RoleChoices.BUYER, CompanyTypeChoices.BUYER)
    assert buyer.post(UPLOAD, {"image": _photo()}, format="multipart").status_code == 403
    junk = SimpleUploadedFile("x.jpg", b"not a picture", content_type="image/jpeg")
    assert mill.post(UPLOAD, {"image": junk}, format="multipart").status_code == 400
    assert mill.post(UPLOAD, {}, format="multipart").status_code == 400


def test_listing_keeps_all_uploaded_photos_in_order(mill):
    urls = [mill.post(UPLOAD, {"image": _photo((800, 600))}, format="multipart").data["data"]["url"] for _ in range(2)]
    cat = FabricCategory.objects.create(name="Knit", slug="knit-u")
    ftype = FabricType.objects.create(category=cat, name="Jersey", slug="jersey-u")
    res = mill.post(
        "/api/v1/catalog/rolls/",
        {
            "title": "Single jersey", "fabric_type": str(ftype.id), "composition": "100% Cotton",
            "gsm": 160, "width_inches": "60", "color_name": "Red", "color_hex": "#C81E3C",
            "total_yards": "50", "min_cut_length_yards": "5", "price_per_yard": "250",
            "image_urls": urls,
        },
        format="json",
    )
    assert res.status_code == 201, res.data
    images = res.data["data"]["images"]
    assert [i["image_url"] for i in images] == urls
    assert images[0]["is_primary"] and not images[1]["is_primary"]
    assert FabricRoll.objects.get(id=res.data["data"]["id"]).images.count() == 2
    assert Decimal(res.data["data"]["total_yards"]) == Decimal("50")
