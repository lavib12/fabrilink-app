"""
Phones may still run an older APK that predates manual payments. These tests replay
exactly the requests those versions send and check the new server still serves them.
"""

from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from apps.catalog.models import FabricCategory, FabricRoll, FabricType
from apps.companies.models import Company, CompanyTypeChoices, VerificationStatusChoices
from apps.users.models import RoleChoices, User


def _client(user):
    c = APIClient(HTTP_X_CLIENT_PLATFORM="mobile")
    c.force_authenticate(user=user)
    return c


@pytest.fixture
def world(db):
    buyer_user = User.objects.create_user(email="old@app.com", phone="+8801750000001", role=RoleChoices.BUYER)
    Company.objects.create(
        user=buyer_user, name="Old App Boutique", company_type=CompanyTypeChoices.BUYER,
        verification_status=VerificationStatusChoices.APPROVED,
    )
    mill_user = User.objects.create_user(email="mill@app.com", phone="+8801750000002", role=RoleChoices.FACTORY)
    mill = Company.objects.create(
        user=mill_user, name="Mill", company_type=CompanyTypeChoices.FACTORY,
        verification_status=VerificationStatusChoices.APPROVED,
    )
    admin = User.objects.create_superuser(email="adm@app.com", phone="+8801750000003", role=RoleChoices.ADMIN)
    cat = FabricCategory.objects.create(name="Knit", slug="knit-old")
    ftype = FabricType.objects.create(category=cat, name="Rib", slug="rib-old")
    roll = FabricRoll.objects.create(
        factory=mill, fabric_type=ftype, roll_code="ROL-OLD-1", title="Rib", composition="Cotton",
        gsm=220, width_inches=Decimal("60"), color_name="Grey", total_yards=Decimal("100"),
        available_yards=Decimal("100"), min_cut_length_yards=Decimal("10"), price_per_yard=Decimal("250"),
    )
    return {"buyer": _client(buyer_user), "mill": _client(mill_user), "admin": _client(admin), "roll": roll}


def _old_app_checkout(world, method):
    """Same calls as app versions 1.0 (v1/v2 APKs): add to cart, then checkout."""
    buyer = world["buyer"]
    res = buyer.post(
        "/api/v1/orders/cart/items/",
        {"fabric_roll_id": str(world["roll"].id), "requested_yards": "10"},
        format="json",
    )
    assert res.status_code in (200, 201), res.data
    res = buyer.post("/api/v1/orders/checkout/", {"payment_method": method}, format="json")
    assert res.status_code == 201, res.data
    return res.data["data"]


def test_old_app_order_screens_still_get_every_field_they_read(world):
    order = _old_app_checkout(world, "COD")
    for field in ("id", "order_number", "status", "total_amount", "payment_method", "items", "tracking_events"):
        assert field in order
    listed = world["buyer"].get("/api/v1/orders/").data["data"]
    assert listed[0]["id"] == order["id"]


def test_old_app_bkash_order_can_be_paid_through_admin(world):
    order = _old_app_checkout(world, "BKASH")
    assert order["status"] == "REQUESTED"

    res = world["admin"].post(
        f"/api/v1/payments/orders/{order['id']}/record/",
        {"transaction_id": "8n4k2p9x1q", "note": "Buyer phoned in TrxID"},
        format="json",
    )
    assert res.status_code == 201, res.data
    assert res.data["data"]["status"] == "VERIFIED"
    assert res.data["data"]["transaction_id"] == "8N4K2P9X1Q"

    detail = world["buyer"].get(f"/api/v1/orders/{order['id']}/").data["data"]
    assert detail["status"] == "PAID_CREDIT_APPROVED"
    assert len(world["mill"].get("/api/v1/orders/").data["data"]) == 1


def test_old_app_buyer_can_still_cancel_unpaid_order(world):
    order = _old_app_checkout(world, "NAGAD")
    res = world["buyer"].patch(f"/api/v1/orders/{order['id']}/status/", {"status": "CANCELLED"}, format="json")
    assert res.status_code == 200
    world["roll"].refresh_from_db()
    assert world["roll"].available_yards == Decimal("100")


def test_record_payment_rules(world):
    order = _old_app_checkout(world, "BKASH")
    url = f"/api/v1/payments/orders/{order['id']}/record/"
    assert world["buyer"].post(url, {"transaction_id": "AAAA1111"}, format="json").status_code == 403
    assert world["admin"].post(url, {"transaction_id": "x"}, format="json").status_code == 400
    assert world["admin"].post(url, {"transaction_id": "AAAA1111"}, format="json").status_code == 201
    # Already paid now.
    assert world["admin"].post(url, {"transaction_id": "BBBB2222"}, format="json").status_code == 400

    cod = _old_app_checkout(world, "COD")
    assert world["admin"].post(
        f"/api/v1/payments/orders/{cod['id']}/record/", {"transaction_id": "CCCC3333"}, format="json"
    ).status_code == 400
