from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from apps.catalog.models import FabricCategory, FabricRoll, FabricType
from apps.companies.models import Company, CompanyTypeChoices
from apps.orders.models import OrderStatusChoices
from apps.orders.services import add_item_to_cart, checkout_cart
from apps.users.models import RoleChoices, User


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def mill_company(db):
    user = User.objects.create_user(
        email="mill2@test.com", phone="+8801700999003", role=RoleChoices.FACTORY
    )
    return Company.objects.create(
        user=user, name="Test Mill Ltd", company_type=CompanyTypeChoices.FACTORY
    )


@pytest.fixture
def buyer_company(db):
    user = User.objects.create_user(
        email="boutique2@test.com", phone="+8801700999004", role=RoleChoices.BUYER
    )
    return Company.objects.create(
        user=user, name="Test Boutique", company_type=CompanyTypeChoices.BUYER
    )


@pytest.fixture
def admin_user(db):
    return User.objects.create_superuser(
        email="admin2@test.com", phone="+8801700999005", role=RoleChoices.ADMIN
    )


@pytest.fixture
def hub_user(db):
    return User.objects.create_user(
        email="hub2@test.com", phone="+8801700999006", role=RoleChoices.HUB_STAFF
    )


@pytest.fixture
def sample_order(db, mill_company, buyer_company):
    category = FabricCategory.objects.create(name="Knit", slug="knit-order")
    ftype = FabricType.objects.create(category=category, name="Single Jersey", slug="jersey-order")
    roll = FabricRoll.objects.create(
        factory=mill_company,
        fabric_type=ftype,
        roll_code="ROL-TEST-200",
        title="Single Jersey 100% Cotton",
        composition="100% Cotton",
        gsm=180,
        width_inches=Decimal("60.00"),
        color_name="Navy",
        color_hex="#000080",
        total_yards=Decimal("100.00"),
        available_yards=Decimal("100.00"),
        min_cut_length_yards=Decimal("10.00"),
        price_per_yard=Decimal("200.00"),
    )
    add_item_to_cart(buyer=buyer_company, roll_id=str(roll.id), requested_yards=Decimal("20.00"))
    # Cash on delivery goes straight to the fulfilment pipeline.
    return checkout_cart(buyer=buyer_company, payment_method="COD")


def test_admin_can_view_all_orders(api_client, admin_user, sample_order):
    api_client.force_authenticate(user=admin_user)
    response = api_client.get("/api/v1/orders/")
    assert response.status_code == 200
    assert response.json()["success"] is True
    assert len(response.json()["data"]) >= 1


def test_hub_can_update_order_status(api_client, hub_user, sample_order):
    api_client.force_authenticate(user=hub_user)
    response = api_client.patch(
        f"/api/v1/orders/{sample_order.id}/status/",
        {
            "status": OrderStatusChoices.CUTTING,
            "notes": "Cutter table #2 started.",
            "location": "Tejgaon Hub",
        },
        format="json",
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["status"] == "CUTTING"
    assert len(data["tracking_events"]) >= 2
    assert data["tracking_events"][-1]["to_status"] == "CUTTING"
