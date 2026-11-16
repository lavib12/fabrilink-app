from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.catalog.models import FabricCategory, FabricRoll, FabricType
from apps.companies.models import Company, CompanyTypeChoices, VerificationStatusChoices
from apps.orders.services import add_item_to_cart, checkout_cart
from apps.payments.models import PaymentSettings
from apps.users.models import RoleChoices, User


def _client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.fixture
def world(db):
    def company(email, phone, role, ctype):
        user = User.objects.create_user(email=email, phone=phone, role=role)
        co = Company.objects.create(
            user=user, name=email.split("@")[0], company_type=ctype,
            verification_status=VerificationStatusChoices.APPROVED,
        )
        return user, co

    buyer_user, buyer = company("b@p.com", "+8801740000001", RoleChoices.BUYER, CompanyTypeChoices.BUYER)
    other_user, other = company("o@p.com", "+8801740000002", RoleChoices.BUYER, CompanyTypeChoices.BUYER)
    mill_user, mill = company("f@p.com", "+8801740000003", RoleChoices.FACTORY, CompanyTypeChoices.FACTORY)
    admin = User.objects.create_superuser(email="a@p.com", phone="+8801740000004", role=RoleChoices.ADMIN)
    cat = FabricCategory.objects.create(name="Woven", slug="woven-p")
    ftype = FabricType.objects.create(category=cat, name="Twill", slug="twill-p")
    roll = FabricRoll.objects.create(
        factory=mill, fabric_type=ftype, roll_code="ROL-P-1", title="Twill", composition="100% Cotton",
        gsm=200, width_inches=Decimal("58"), color_name="Khaki", total_yards=Decimal("200"),
        available_yards=Decimal("200"), min_cut_length_yards=Decimal("10"), price_per_yard=Decimal("300"),
    )

    def order(method, yards="20", who=buyer):
        add_item_to_cart(buyer=who, roll_id=str(roll.id), requested_yards=Decimal(yards))
        return checkout_cart(buyer=who, payment_method=method)

    return {"buyer_user": buyer_user, "buyer": buyer, "other_user": other_user, "other": other,
            "mill_user": mill_user, "admin": admin, "roll": roll, "order": order}


def _url(order):
    return f"/api/v1/payments/orders/{order.id}/"


def _bkash(order, **over):
    return {"amount": str(order.total_amount), "sender_account": "+880 1712-345678",
            "transaction_id": "9a7b3c1d2e", **over}


def test_manual_methods_wait_for_payment_and_cod_does_not(world):
    bkash = world["order"]("BKASH")
    cod = world["order"]("COD")
    assert bkash.status == "REQUESTED"
    assert cod.status == "PAID_CREDIT_APPROVED"

    res = _client(world["buyer_user"]).get(f"/api/v1/orders/{bkash.id}/")
    assert res.data["data"]["payment_status"] == "AWAITING"
    res = _client(world["buyer_user"]).get(f"/api/v1/orders/{cod.id}/")
    assert res.data["data"]["payment_status"] == "NOT_REQUIRED"


def test_mill_does_not_see_unpaid_orders(world):
    world["order"]("BKASH")
    assert _client(world["mill_user"]).get("/api/v1/orders/").data["data"] == []


def test_bkash_submission_is_normalised_and_verified_by_admin(world):
    order = world["order"]("BKASH")
    res = _client(world["buyer_user"]).post(_url(order), _bkash(order), format="json")
    assert res.status_code == 201, res.data
    sub = res.data["data"]
    assert sub["sender_account"] == "01712345678"
    assert sub["transaction_id"] == "9A7B3C1D2E"
    assert sub["status"] == "SUBMITTED"

    # Only admins see the review queue.
    assert _client(world["buyer_user"]).get("/api/v1/payments/submissions/").status_code == 403
    queue = _client(world["admin"]).get("/api/v1/payments/submissions/?status=SUBMITTED").data["data"]
    assert [s["id"] for s in queue] == [sub["id"]]

    res = _client(world["admin"]).post(
        f"/api/v1/payments/submissions/{sub['id']}/review/", {"action": "VERIFY"}, format="json"
    )
    assert res.data["data"]["status"] == "VERIFIED"
    detail = _client(world["buyer_user"]).get(f"/api/v1/orders/{order.id}/").data["data"]
    assert detail["status"] == "PAID_CREDIT_APPROVED"
    assert detail["payment_status"] == "VERIFIED"
    # Now the mill can see it to prepare the pickup.
    assert len(_client(world["mill_user"]).get("/api/v1/orders/").data["data"]) == 1


def test_bad_wallet_details_are_explained_per_field(world):
    order = world["order"]("NAGAD")
    res = _client(world["buyer_user"]).post(
        _url(order), _bkash(order, sender_account="12345", transaction_id="x!"), format="json"
    )
    assert res.status_code == 400
    assert set(res.data["error"]["details"]) == {"sender_account", "transaction_id"}


def test_rejected_payment_can_be_resubmitted_but_trx_ids_cannot_be_reused(world):
    order = world["order"]("BKASH")
    buyer = _client(world["buyer_user"])
    sub = buyer.post(_url(order), _bkash(order), format="json").data["data"]
    # Can't submit twice while one is being checked.
    assert buyer.post(_url(order), _bkash(order, transaction_id="AAAA1111"), format="json").status_code == 409

    _client(world["admin"]).post(
        f"/api/v1/payments/submissions/{sub['id']}/review/",
        {"action": "REJECT", "note": "No such TrxID"}, format="json",
    )
    detail = buyer.get(f"/api/v1/orders/{order.id}/").data["data"]
    assert detail["status"] == "REQUESTED" and detail["payment_status"] == "REJECTED"
    assert buyer.post(_url(order), _bkash(order, transaction_id="BBBB2222"), format="json").status_code == 201

    # Another order can't reuse a TrxID that's under review.
    other_order = world["order"]("BKASH", yards="10")
    assert buyer.post(_url(other_order), _bkash(other_order, transaction_id="BBBB2222"), format="json").status_code == 409


def test_international_bank_transfer(world):
    order = world["order"]("BANK_TRANSFER")
    body = {
        "amount": "95.50", "currency": "usd", "transaction_id": "FT24318ABC/77",
        "sender_name": "Rahim Textiles LLC", "sender_bank_name": "Emirates NBD",
        "sender_bank_country": "United Arab Emirates", "sender_swift_code": "ebil aead",
        "sender_account": "AE07 0331 2345 6789 0123 456",
        "transfer_date": str(timezone.localdate()),
    }
    res = _client(world["buyer_user"]).post(_url(order), body, format="json")
    assert res.status_code == 201, res.data
    data = res.data["data"]
    assert data["currency"] == "USD"
    assert data["sender_swift_code"] == "EBILAEAD"
    assert data["sender_account"] == "AE070331234567890123456"


def test_bank_transfer_needs_sender_bank_and_a_past_date(world):
    order = world["order"]("BANK_TRANSFER")
    body = {"amount": "1000", "transaction_id": "REF12345",
            "transfer_date": str(timezone.localdate() + timedelta(days=2)),
            "sender_swift_code": "BAD"}
    res = _client(world["buyer_user"]).post(_url(order), body, format="json")
    assert res.status_code == 400
    assert {"sender_name", "sender_bank_name", "transfer_date", "sender_swift_code"} <= set(res.data["error"]["details"])


def test_only_owner_can_pay_and_cod_needs_no_proof(world):
    order = world["order"]("BKASH")
    assert _client(world["other_user"]).post(_url(order), _bkash(order), format="json").status_code == 404
    cod = world["order"]("COD", yards="10")
    assert _client(world["buyer_user"]).post(_url(cod), _bkash(cod), format="json").status_code == 400


def test_unpaid_order_can_be_cancelled_and_restocks(world):
    order = world["order"]("BKASH")
    world["roll"].refresh_from_db()
    assert world["roll"].available_yards == Decimal("180")
    res = _client(world["buyer_user"]).patch(
        f"/api/v1/orders/{order.id}/status/", {"status": "CANCELLED"}, format="json"
    )
    assert res.status_code == 200
    world["roll"].refresh_from_db()
    assert world["roll"].available_yards == Decimal("200")


def test_accounts_endpoint_returns_admin_settings(world):
    s = PaymentSettings.load()
    s.bkash_number = "01811111111"
    s.bank_swift_code = "BRAKBDDH"
    s.save()
    data = _client(world["buyer_user"]).get("/api/v1/payments/accounts/").data["data"]
    assert data["bkash_number"] == "01811111111"
    assert data["bank_swift_code"] == "BRAKBDDH"
    assert data["bkash_account_type_label"].startswith("Merchant")
