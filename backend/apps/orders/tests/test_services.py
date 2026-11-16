from decimal import Decimal

import pytest

from apps.catalog.models import FabricCategory, FabricRoll, FabricType
from apps.companies.models import Company, CompanyTypeChoices
from apps.orders.services import (
    add_item_to_cart,
    checkout_cart,
    validate_roll_breakdown,
)
from apps.users.models import RoleChoices, User
from common.exceptions import InsufficientStockError, RollBreakdownError


@pytest.fixture
def mill_company(db):
    user = User.objects.create_user(
        email="mill@test.com", phone="+8801700999001", role=RoleChoices.FACTORY
    )
    return Company.objects.create(
        user=user, name="Test Mill Ltd", company_type=CompanyTypeChoices.FACTORY
    )


@pytest.fixture
def buyer_company(db):
    user = User.objects.create_user(
        email="boutique@test.com", phone="+8801700999002", role=RoleChoices.BUYER
    )
    return Company.objects.create(
        user=user, name="Test Boutique", company_type=CompanyTypeChoices.BUYER
    )


@pytest.fixture
def fabric_roll(db, mill_company):
    category = FabricCategory.objects.create(name="Knit", slug="knit")
    ftype = FabricType.objects.create(category=category, name="Single Jersey", slug="jersey")
    return FabricRoll.objects.create(
        factory=mill_company,
        fabric_type=ftype,
        roll_code="ROL-TEST-100",
        title="Single Jersey 100% Cotton",
        composition="100% Cotton",
        gsm=180,
        width_inches=Decimal("60.00"),
        color_name="Black",
        color_hex="#000000",
        total_yards=Decimal("100.00"),
        available_yards=Decimal("100.00"),
        min_cut_length_yards=Decimal("10.00"),
        price_per_yard=Decimal("200.00"),
    )


def test_validate_roll_breakdown_valid(fabric_roll):
    # Valid: 20 yards from 100 yards roll -> leftover 80 yards (>= 10 min cut)
    validate_roll_breakdown(fabric_roll, Decimal("20.00"))

    # Valid: 100 yards (take all) -> leftover 0 yards
    validate_roll_breakdown(fabric_roll, Decimal("100.00"))


def test_validate_roll_breakdown_too_small(fabric_roll):
    # Below min cut (5 yd < 10 yd min)
    with pytest.raises(RollBreakdownError):
        validate_roll_breakdown(fabric_roll, Decimal("5.00"))


def test_validate_roll_breakdown_exceeds_available(fabric_roll):
    # Exceeds 100 yd
    with pytest.raises(InsufficientStockError):
        validate_roll_breakdown(fabric_roll, Decimal("120.00"))


def test_validate_roll_breakdown_bad_leftover_remnant(fabric_roll):
    # 95 yards leaves 5 yards, which is < 10 yd min cut length (unsellable remnant)
    with pytest.raises(RollBreakdownError):
        validate_roll_breakdown(fabric_roll, Decimal("95.00"))


@pytest.mark.django_db
def test_add_to_cart_and_checkout_flow(buyer_company, fabric_roll):
    # 1. Add 25 yards to cart
    cart_item = add_item_to_cart(
        buyer=buyer_company,
        roll_id=str(fabric_roll.id),
        requested_yards=Decimal("25.00"),
    )
    assert cart_item.requested_yards == Decimal("25.00")

    # 2. Checkout
    # bKash orders hold the stock and wait for the buyer's payment proof.
    order = checkout_cart(buyer=buyer_company, payment_method="BKASH")
    assert order.status == "REQUESTED"
    assert order.items.count() == 1
    assert order.items.first().requested_yards == Decimal("25.00")

    # Roll yardage must be reduced atomically from 100 to 75
    fabric_roll.refresh_from_db()
    assert fabric_roll.available_yards == Decimal("75.00")
    assert fabric_roll.status == "RESERVED_PARTIAL"
