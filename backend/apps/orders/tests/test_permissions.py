from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from apps.catalog.models import FabricCategory, FabricRoll, FabricType
from apps.companies.models import Company, CompanyTypeChoices, VerificationStatusChoices
from apps.orders.services import add_item_to_cart, checkout_cart
from apps.users.models import RoleChoices, User
from common.exceptions import NotFoundError


def _company(email, phone, role, ctype, status=VerificationStatusChoices.APPROVED):
    user = User.objects.create_user(email=email, phone=phone, role=role)
    company = Company.objects.create(
        user=user, name=email.split("@")[0], company_type=ctype, verification_status=status
    )
    return user, company


@pytest.fixture
def setup(db):
    _, mill = _company("m@t.com", "+8801700000001", RoleChoices.FACTORY, CompanyTypeChoices.FACTORY)
    buyer_user, buyer = _company(
        "b@t.com", "+8801700000002", RoleChoices.BUYER, CompanyTypeChoices.BUYER
    )
    other_user, other = _company(
        "o@t.com", "+8801700000003", RoleChoices.BUYER, CompanyTypeChoices.BUYER
    )
    cat = FabricCategory.objects.create(name="Knit", slug="knit-perm")
    ftype = FabricType.objects.create(category=cat, name="Jersey", slug="jersey-perm")
    roll = FabricRoll.objects.create(
        factory=mill,
        fabric_type=ftype,
        roll_code="ROL-PERM-1",
        title="Jersey",
        composition="100% Cotton",
        gsm=180,
        width_inches=Decimal("60"),
        color_name="Navy",
        total_yards=Decimal("100"),
        available_yards=Decimal("100"),
        min_cut_length_yards=Decimal("10"),
        price_per_yard=Decimal("200"),
    )
    private_roll = FabricRoll.objects.create(
        factory=mill,
        fabric_type=ftype,
        roll_code="ROL-PERM-2",
        title="Private",
        composition="100% Cotton",
        gsm=180,
        width_inches=Decimal("60"),
        color_name="Red",
        total_yards=Decimal("50"),
        available_yards=Decimal("50"),
        min_cut_length_yards=Decimal("10"),
        price_per_yard=Decimal("300"),
        target_buyer=buyer,
        is_custom_profile=True,
    )
    add_item_to_cart(buyer=buyer, roll_id=str(roll.id), requested_yards=Decimal("20"))
    order = checkout_cart(buyer=buyer)
    return {
        "buyer_user": buyer_user,
        "other_user": other_user,
        "other": other,
        "roll": roll,
        "private_roll": private_roll,
        "order": order,
    }


def test_other_buyer_cannot_view_order(setup):
    client = APIClient()
    client.force_authenticate(user=setup["other_user"])
    res = client.get(f"/api/v1/orders/{setup['order'].id}/")
    assert res.status_code == 404


def test_buyer_cannot_advance_order_status(setup):
    client = APIClient()
    client.force_authenticate(user=setup["buyer_user"])
    res = client.patch(
        f"/api/v1/orders/{setup['order'].id}/status/", {"status": "COMPLETED"}, format="json"
    )
    assert res.status_code == 403


def test_buyer_cancel_restocks_roll(setup):
    client = APIClient()
    client.force_authenticate(user=setup["buyer_user"])
    res = client.patch(
        f"/api/v1/orders/{setup['order'].id}/status/", {"status": "CANCELLED"}, format="json"
    )
    assert res.status_code == 200
    setup["roll"].refresh_from_db()
    assert setup["roll"].available_yards == Decimal("100")


def test_hub_cannot_move_order_backwards(setup):
    hub = User.objects.create_user(
        email="h@t.com", phone="+8801700000004", role=RoleChoices.HUB_STAFF
    )
    client = APIClient()
    client.force_authenticate(user=hub)
    url = f"/api/v1/orders/{setup['order'].id}/status/"
    assert client.patch(url, {"status": "PACKED"}, format="json").status_code == 200
    assert client.patch(url, {"status": "AT_HUB"}, format="json").status_code == 400


def test_private_profile_hidden_from_other_buyers(setup):
    client = APIClient()
    client.force_authenticate(user=setup["other_user"])
    roll_id = setup["private_roll"].id
    assert client.get(f"/api/v1/catalog/rolls/{roll_id}/").status_code == 404
    res = client.get(
        f"/api/v1/catalog/rolls/?target_buyer_id={setup['private_roll'].target_buyer_id}"
    )
    assert str(roll_id) not in [r["id"] for r in res.data["data"]]
    with pytest.raises(NotFoundError):
        add_item_to_cart(buyer=setup["other"], roll_id=str(roll_id), requested_yards=Decimal("10"))


def test_anonymous_cannot_query_private_profiles_by_buyer(setup):
    res = APIClient().get(
        f"/api/v1/catalog/rolls/?target_buyer_id={setup['private_roll'].target_buyer_id}"
    )
    assert res.status_code == 200
    assert res.data["data"] == []


def test_buyer_cannot_list_buyer_directory(setup):
    client = APIClient()
    client.force_authenticate(user=setup["buyer_user"])
    assert client.get("/api/v1/companies/buyers/").status_code == 403


def test_bad_numeric_filter_returns_400(db):
    assert APIClient().get("/api/v1/catalog/rolls/?min_gsm=abc").status_code == 400


def test_unverified_buyer_cannot_checkout(setup):
    user, company = _company(
        "p@t.com",
        "+8801700000005",
        RoleChoices.BUYER,
        CompanyTypeChoices.BUYER,
        status=VerificationStatusChoices.PENDING,
    )
    add_item_to_cart(buyer=company, roll_id=str(setup["roll"].id), requested_yards=Decimal("10"))
    client = APIClient()
    client.force_authenticate(user=user)
    assert client.post("/api/v1/orders/checkout/", {}, format="json").status_code == 403


def test_address_create_uses_own_company(setup):
    client = APIClient()
    client.force_authenticate(user=setup["buyer_user"])
    res = client.post(
        "/api/v1/companies/addresses/",
        {
            "address_type": "DELIVERY",
            "division": "Dhaka",
            "district": "Dhaka",
            "upazila_thana": "Gulshan",
            "street_address": "Road 11",
            "postal_code": "1212",
            "company": str(setup["other"].id),
        },
        format="json",
    )
    assert res.status_code == 201
    assert res.data["data"]["company"] != str(setup["other"].id)
