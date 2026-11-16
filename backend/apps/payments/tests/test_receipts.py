from decimal import Decimal
from io import BytesIO

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APIClient

from apps.catalog.models import FabricCategory, FabricRoll, FabricType
from apps.companies.models import Company, CompanyTypeChoices, VerificationStatusChoices
from apps.orders.services import add_item_to_cart, checkout_cart
from apps.users.models import RoleChoices, User


def _client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _photo():
    buf = BytesIO()
    Image.new("RGB", (900, 1600), (230, 0, 110)).save(buf, format="PNG")
    return SimpleUploadedFile("bkash.png", buf.getvalue(), content_type="image/png")


@pytest.fixture
def world(db):
    def company(email, phone, role, ctype):
        user = User.objects.create_user(email=email, phone=phone, role=role)
        co = Company.objects.create(
            user=user, name=email, company_type=ctype, verification_status=VerificationStatusChoices.APPROVED
        )
        return user, co

    buyer_user, buyer = company("b@r.com", "+8801760000001", RoleChoices.BUYER, CompanyTypeChoices.BUYER)
    other_user, _ = company("o@r.com", "+8801760000002", RoleChoices.BUYER, CompanyTypeChoices.BUYER)
    mill_user, mill = company("f@r.com", "+8801760000003", RoleChoices.FACTORY, CompanyTypeChoices.FACTORY)
    admin = User.objects.create_superuser(email="a@r.com", phone="+8801760000004", role=RoleChoices.ADMIN)
    cat = FabricCategory.objects.create(name="Woven", slug="woven-r")
    ftype = FabricType.objects.create(category=cat, name="Poplin", slug="poplin-r")
    roll = FabricRoll.objects.create(
        factory=mill, fabric_type=ftype, roll_code="ROL-R-1", title="Poplin", composition="Cotton", gsm=110,
        width_inches=Decimal("58"), color_name="White", total_yards=Decimal("100"),
        available_yards=Decimal("100"), min_cut_length_yards=Decimal("10"), price_per_yard=Decimal("200"),
    )
    add_item_to_cart(buyer=buyer, roll_id=str(roll.id), requested_yards=Decimal("10"))
    order = checkout_cart(buyer=buyer, payment_method="BKASH")
    return {"buyer": buyer_user, "other": other_user, "mill": mill_user, "admin": admin, "order": order}


def test_receipt_is_private_to_buyer_and_admin(world):
    res = _client(world["buyer"]).post("/api/v1/payments/receipts/", {"image": _photo()}, format="multipart")
    assert res.status_code == 201
    rid = res.data["data"]["id"]

    body = {"amount": str(world["order"].total_amount), "sender_account": "01712345678",
            "transaction_id": "7K3M9P2Q1R", "receipt_id": rid}
    sub = _client(world["buyer"]).post(f"/api/v1/payments/orders/{world['order'].id}/", body, format="json")
    assert sub.status_code == 201, sub.data
    url = sub.data["data"]["receipt_url"]
    assert url.endswith(f"/api/v1/payments/receipts/{rid}/")

    path = f"/api/v1/payments/receipts/{rid}/"
    assert _client(world["buyer"]).get(path).status_code == 200
    assert _client(world["admin"]).get(path)["Content-Type"] == "image/jpeg"
    assert _client(world["other"]).get(path).status_code == 404
    assert _client(world["mill"]).get(path).status_code == 404
    assert APIClient().get(path).status_code == 401
    # The public listing-photo URL never serves private images.
    assert APIClient().get(f"/api/v1/catalog/images/{rid}/").status_code == 404


def test_cannot_attach_someone_elses_receipt(world):
    rid = _client(world["other"]).post(
        "/api/v1/payments/receipts/", {"image": _photo()}, format="multipart"
    ).data["data"]["id"]
    body = {"amount": "100", "sender_account": "01712345678", "transaction_id": "7K3M9P2Q1R", "receipt_id": rid}
    res = _client(world["buyer"]).post(f"/api/v1/payments/orders/{world['order'].id}/", body, format="json")
    assert res.status_code == 400
    assert "receipt_id" in res.data["error"]["details"]


def test_only_buyers_upload_receipts(world):
    assert _client(world["mill"]).post(
        "/api/v1/payments/receipts/", {"image": _photo()}, format="multipart"
    ).status_code == 403
