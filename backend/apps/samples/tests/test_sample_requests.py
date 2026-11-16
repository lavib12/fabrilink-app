from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from apps.catalog.models import FabricCategory, FabricRoll, FabricType
from apps.companies.models import Company, CompanyTypeChoices, VerificationStatusChoices
from apps.users.models import RoleChoices, User

URL = "/api/v1/samples/requests/"


def _company(email, phone, role, ctype, status=VerificationStatusChoices.APPROVED):
    user = User.objects.create_user(email=email, phone=phone, role=role)
    company = Company.objects.create(
        user=user, name=email.split("@")[0], company_type=ctype, verification_status=status
    )
    return user, company


def _client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.fixture
def world(db):
    buyer_user, buyer = _company("b@s.com", "+8801720000001", RoleChoices.BUYER, CompanyTypeChoices.BUYER)
    other_user, other = _company("o@s.com", "+8801720000002", RoleChoices.BUYER, CompanyTypeChoices.BUYER)
    pending_user, _ = _company(
        "p@s.com", "+8801720000003", RoleChoices.BUYER, CompanyTypeChoices.BUYER,
        status=VerificationStatusChoices.PENDING,
    )
    mill_user, mill = _company("f@s.com", "+8801720000004", RoleChoices.FACTORY, CompanyTypeChoices.FACTORY)
    rival_user, _ = _company("r@s.com", "+8801720000005", RoleChoices.FACTORY, CompanyTypeChoices.FACTORY)
    cat = FabricCategory.objects.create(name="Woven", slug="woven-s")
    ftype = FabricType.objects.create(category=cat, name="Poplin", slug="poplin-s")

    def roll(code, **extra):
        return FabricRoll.objects.create(
            factory=mill, fabric_type=ftype, roll_code=code, title=f"Poplin {code}",
            composition="100% Cotton", gsm=120, width_inches=Decimal("58"), color_name="White",
            total_yards=Decimal("100"), available_yards=Decimal("100"),
            min_cut_length_yards=Decimal("5"), price_per_yard=Decimal("300"), **extra,
        )

    return {
        "buyer_user": buyer_user, "buyer": buyer, "other_user": other_user, "other": other,
        "pending_user": pending_user, "mill_user": mill_user, "rival_user": rival_user,
        "roll": roll("ROL-S-1"),
        "no_samples": roll("ROL-S-2", is_sample_available=False),
        "private_other": roll("ROL-S-3", target_buyer=other, is_custom_profile=True),
    }


def _request(world, **body):
    return _client(world["buyer_user"]).post(
        URL, {"fabric_roll": str(world["roll"].id), "swatch_size": "HALF_YARD", **body}, format="json"
    )


def test_buyer_requests_sample_and_mill_sees_it(world):
    res = _request(world, notes="Need to check hand-feel")
    assert res.status_code == 201
    data = res.data["data"]
    assert data["status"] == "REQUESTED"
    assert data["swatch_size"] == "HALF_YARD"
    assert data["roll_code"] == "ROL-S-1"

    assert len(_client(world["mill_user"]).get(URL).data["data"]) == 1
    # Other buyers and other mills can't see it.
    assert _client(world["other_user"]).get(URL).data["data"] == []
    assert _client(world["rival_user"]).get(URL).data["data"] == []


def test_duplicate_open_request_is_rejected(world):
    assert _request(world).status_code == 201
    assert _request(world).status_code == 409


def test_unverified_buyer_and_factory_cannot_request(world):
    body = {"fabric_roll": str(world["roll"].id)}
    assert _client(world["pending_user"]).post(URL, body, format="json").status_code == 403
    assert _client(world["mill_user"]).post(URL, body, format="json").status_code == 403


def test_cannot_sample_hidden_or_sample_free_rolls(world):
    c = _client(world["buyer_user"])
    assert c.post(URL, {"fabric_roll": str(world["private_other"].id)}, format="json").status_code == 404
    assert c.post(URL, {"fabric_roll": str(world["no_samples"].id)}, format="json").status_code == 400


def test_status_flow_and_permissions(world):
    sample_id = _request(world).data["data"]["id"]
    status_url = f"{URL}{sample_id}/status/"
    mill = _client(world["mill_user"])
    buyer = _client(world["buyer_user"])

    # The buyer can't accept their own request; a rival mill can't see it at all.
    assert buyer.post(status_url, {"status": "ACCEPTED"}, format="json").status_code == 400
    assert _client(world["rival_user"]).post(status_url, {"status": "ACCEPTED"}, format="json").status_code == 404

    assert mill.post(status_url, {"status": "ACCEPTED"}, format="json").data["data"]["status"] == "ACCEPTED"
    res = mill.post(status_url, {"status": "SHIPPED", "note": "Sundarban courier #A12"}, format="json")
    assert res.data["data"]["status"] == "SHIPPED"
    assert res.data["data"]["factory_note"] == "Sundarban courier #A12"

    assert buyer.post(status_url, {"status": "DELIVERED"}, format="json").data["data"]["status"] == "DELIVERED"
    # Finished requests can't move again, and a new one is allowed.
    assert mill.post(status_url, {"status": "DECLINED"}, format="json").status_code == 400
    assert _request(world).status_code == 201


def test_buyer_can_cancel_before_shipping(world):
    sample_id = _request(world).data["data"]["id"]
    res = _client(world["buyer_user"]).post(f"{URL}{sample_id}/status/", {"status": "CANCELLED"}, format="json")
    assert res.data["data"]["status"] == "CANCELLED"
