from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from apps.catalog.models import FabricCategory, FabricRoll, FabricType
from apps.companies.models import Company, CompanyTypeChoices, VerificationStatusChoices
from apps.companies.services import verify_company
from apps.matching.models import SourcingRequest
from apps.orders.services import add_item_to_cart, checkout_cart, credit_summary
from apps.users.models import RoleChoices, User

URL = "/api/v1/matching/requests/"


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
    buyer_user, buyer = _company(
        "b@m.com", "+8801710000001", RoleChoices.BUYER, CompanyTypeChoices.BUYER
    )
    other_user, other = _company(
        "o@m.com", "+8801710000002", RoleChoices.BUYER, CompanyTypeChoices.BUYER
    )
    mill_user, mill = _company(
        "f@m.com", "+8801710000003", RoleChoices.FACTORY, CompanyTypeChoices.FACTORY
    )
    pending_mill_user, _ = _company(
        "p@m.com",
        "+8801710000004",
        RoleChoices.FACTORY,
        CompanyTypeChoices.FACTORY,
        status=VerificationStatusChoices.PENDING,
    )
    cat = FabricCategory.objects.create(name="Woven", slug="woven-m")
    ftype = FabricType.objects.create(category=cat, name="Linen Plain", slug="linen-m")

    def roll(code, title, gsm, yards, target=None):
        return FabricRoll.objects.create(
            factory=mill,
            fabric_type=ftype,
            roll_code=code,
            title=title,
            composition="100% Linen",
            gsm=gsm,
            width_inches=Decimal("58"),
            color_name="Natural",
            total_yards=Decimal(yards),
            available_yards=Decimal(yards),
            min_cut_length_yards=Decimal("5"),
            price_per_yard=Decimal("400"),
            target_buyer=target,
            is_custom_profile=target is not None,
        )

    return {
        "buyer_user": buyer_user,
        "buyer": buyer,
        "other_user": other_user,
        "other": other,
        "mill_user": mill_user,
        "pending_mill_user": pending_mill_user,
        "match": roll("ROL-M-1", "French flax linen", 180, "80"),
        "too_heavy": roll("ROL-M-2", "Heavy linen canvas", 400, "80"),
        "too_short": roll("ROL-M-3", "Linen voile", 170, "10"),
        "private_other": roll("ROL-M-4", "Linen exclusive", 180, "80", target=other),
    }


def test_buyer_posts_and_lists_own_request(world):
    client = _client(world["buyer_user"])
    res = client.post(
        URL,
        {"fabric_name": "French linen", "target_gsm": 180, "required_yards": "50"},
        format="json",
    )
    assert res.status_code == 201
    assert res.data["data"]["status"] == "OPEN"

    # The other buyer can't see it.
    assert _client(world["other_user"]).get(URL).data["data"] == []
    assert len(client.get(URL).data["data"]) == 1


def test_verified_factory_sees_open_requests_but_pending_factory_does_not(world):
    SourcingRequest.objects.create(buyer=world["buyer"], fabric_name="Tencel twill")
    assert len(_client(world["mill_user"]).get(URL).data["data"]) == 1
    assert _client(world["pending_mill_user"]).get(URL).data["data"] == []


def test_factory_cannot_post_request(world):
    res = _client(world["mill_user"]).post(URL, {"fabric_name": "Linen"}, format="json")
    assert res.status_code == 403


def test_matches_respect_gsm_yards_and_privacy(world):
    req = SourcingRequest.objects.create(
        buyer=world["buyer"], fabric_name="linen", target_gsm=180, required_yards=Decimal("50")
    )
    res = _client(world["buyer_user"]).get(f"{URL}{req.id}/matches/")
    assert res.status_code == 200
    ids = {r["id"] for r in res.data["data"]}
    assert ids == {str(world["match"].id)}
    # Other people's matches aren't visible.
    assert _client(world["mill_user"]).get(f"{URL}{req.id}/matches/").status_code == 403


def test_only_owner_closes_request(world):
    req = SourcingRequest.objects.create(buyer=world["buyer"], fabric_name="linen")
    assert _client(world["mill_user"]).post(f"{URL}{req.id}/close/").status_code == 403
    res = _client(world["buyer_user"]).post(
        f"{URL}{req.id}/close/", {"fulfilled": True}, format="json"
    )
    assert res.data["data"]["status"] == "FULFILLED"
    assert _client(world["buyer_user"]).post(f"{URL}{req.id}/close/").status_code == 400


def test_approval_with_credit_limit_activates_credit_line(world):
    _, pending = _company(
        "n@m.com",
        "+8801710000005",
        RoleChoices.BUYER,
        CompanyTypeChoices.BUYER,
        status=VerificationStatusChoices.PENDING,
    )
    company = verify_company(
        company_id=str(pending.id), action="APPROVE", credit_limit=Decimal("40000")
    )
    assert company.credit_status == "ACTIVE"

    add_item_to_cart(buyer=company, roll_id=str(world["match"].id), requested_yards=Decimal("10"))
    order = checkout_cart(buyer=company, payment_method="B2B_CREDIT")
    summary = credit_summary(company)
    assert summary["outstanding"] == order.total_amount
    assert summary["available"] == Decimal("40000") - order.total_amount


def test_credit_endpoint_is_buyer_only(world):
    assert _client(world["buyer_user"]).get("/api/v1/orders/credit/").status_code == 200
    assert _client(world["mill_user"]).get("/api/v1/orders/credit/").status_code == 403
