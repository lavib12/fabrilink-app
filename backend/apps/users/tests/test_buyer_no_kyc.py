from decimal import Decimal

import pytest
from django.test import override_settings
from rest_framework.test import APIClient

from apps.catalog.models import FabricCategory, FabricRoll, FabricType
from apps.companies.models import Company, CompanyTypeChoices, VerificationStatusChoices
from apps.users.models import RoleChoices, User

REGISTER = "/api/v1/auth/register/"


def _register(client, email, phone, role):
    return client.post(
        REGISTER,
        {"email": email, "phone": phone, "password": "Str0ng!Passw0rd", "role": role,
         "company_name": f"{role.title()} Co", "first_name": "Test", "last_name": "User"},
        format="json",
        HTTP_X_CLIENT_PLATFORM="mobile",
    )


@pytest.fixture
def roll(db):
    mill_user = User.objects.create_user(email="m@nokyc.com", phone="+8801780000009", role=RoleChoices.FACTORY)
    mill = Company.objects.create(
        user=mill_user, name="Mill", company_type=CompanyTypeChoices.FACTORY,
        verification_status=VerificationStatusChoices.APPROVED,
    )
    cat = FabricCategory.objects.create(name="Knit", slug="knit-nokyc")
    ftype = FabricType.objects.create(category=cat, name="Jersey", slug="jersey-nokyc")
    return FabricRoll.objects.create(
        factory=mill, fabric_type=ftype, roll_code="ROL-NK-1", title="Jersey", composition="Cotton", gsm=160,
        width_inches=Decimal("60"), color_name="Black", total_yards=Decimal("100"),
        available_yards=Decimal("100"), min_cut_length_yards=Decimal("10"), price_per_yard=Decimal("200"),
    )


def test_new_buyer_is_approved_and_can_order_right_away(roll):
    client = APIClient()
    res = _register(client, "newb@nokyc.com", "+8801780000001", "BUYER")
    assert res.status_code == 201, res.data
    company = Company.objects.get(user__email="newb@nokyc.com")
    assert company.verification_status == "APPROVED"

    client.force_authenticate(user=company.user)
    client.post("/api/v1/orders/cart/items/", {"fabric_roll_id": str(roll.id), "requested_yards": "10"}, format="json")
    assert client.post("/api/v1/orders/checkout/", {"payment_method": "COD"}, format="json").status_code == 201


def test_new_factory_still_needs_kyc(db):
    res = _register(APIClient(), "newf@nokyc.com", "+8801780000002", "FACTORY")
    assert res.status_code == 201, res.data
    assert Company.objects.get(user__email="newf@nokyc.com").verification_status == "PENDING"


@override_settings(BUYER_KYC_REQUIRED=True)
def test_switch_brings_buyer_kyc_back(db):
    res = _register(APIClient(), "kyc@nokyc.com", "+8801780000003", "BUYER")
    assert res.status_code == 201, res.data
    assert Company.objects.get(user__email="kyc@nokyc.com").verification_status == "PENDING"
