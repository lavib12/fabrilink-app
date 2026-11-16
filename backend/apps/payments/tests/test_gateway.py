from decimal import Decimal
from unittest import mock

import pytest
from django.test import override_settings
from rest_framework.test import APIClient

from apps.catalog.models import FabricCategory, FabricRoll, FabricType
from apps.companies.models import Company, CompanyTypeChoices, VerificationStatusChoices
from apps.orders.services import add_item_to_cart, checkout_cart
from apps.payments.models import GatewayPayment
from apps.users.models import RoleChoices, User


class _Resp:
    def __init__(self, data):
        self._data = data

    def json(self):
        return self._data


def _client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.fixture
def world(db):
    def company(email, phone, role, ctype):
        user = User.objects.create_user(email=email, phone=phone, role=role)
        co = Company.objects.create(
            user=user, name=email, company_type=ctype, contact_phone=phone,
            verification_status=VerificationStatusChoices.APPROVED,
        )
        return user, co

    buyer_user, buyer = company("b@gw.com", "+8801790000001", RoleChoices.BUYER, CompanyTypeChoices.BUYER)
    other_user, _ = company("o@gw.com", "+8801790000002", RoleChoices.BUYER, CompanyTypeChoices.BUYER)
    mill_user, mill = company("f@gw.com", "+8801790000003", RoleChoices.FACTORY, CompanyTypeChoices.FACTORY)
    cat = FabricCategory.objects.create(name="Woven", slug="woven-gw")
    ftype = FabricType.objects.create(category=cat, name="Lawn", slug="lawn-gw")
    roll = FabricRoll.objects.create(
        factory=mill, fabric_type=ftype, roll_code="ROL-GW-1", title="Lawn", composition="Cotton", gsm=90,
        width_inches=Decimal("58"), color_name="White", total_yards=Decimal("200"),
        available_yards=Decimal("200"), min_cut_length_yards=Decimal("10"), price_per_yard=Decimal("300"),
    )

    def order(method):
        add_item_to_cart(buyer=buyer, roll_id=str(roll.id), requested_yards=Decimal("10"))
        return checkout_cart(buyer=buyer, payment_method=method)

    return {"buyer": buyer_user, "other": other_user, "mill": mill_user, "order": order}


SESSION_OK = {
    "status": "SUCCESS",
    "GatewayPageURL": "https://sandbox.sslcommerz.com/EasyCheckOut/abc",
    "sessionkey": "K",
    "desc": [
        {"gw": "visacard", "redirectGatewayURL": "https://sandbox.sslcommerz.com/visa"},
        {"gw": "bkash", "redirectGatewayURL": "https://sandbox.sslcommerz.com/bkash-direct"},
    ],
}


def _start(world, order):
    with mock.patch("apps.payments.gateway.requests.post", return_value=_Resp(SESSION_OK)) as post:
        res = _client(world["buyer"]).post(f"/api/v1/payments/orders/{order.id}/gateway/")
    return res, post


def _validation(gp, **over):
    return {"status": "VALID", "tran_id": gp.tran_id, "amount": str(gp.amount), "currency_type": "BDT",
            "card_type": "BKASH-BKash", "card_no": "", "bank_tran_id": "BKX123", "risk_level": "0", **over}


def test_card_and_wallet_orders_wait_for_payment(world):
    assert world["order"]("SSLCOMMERZ").status == "REQUESTED"
    assert world["order"]("BKASH").status == "REQUESTED"
    assert world["order"]("COD").status == "PAID_CREDIT_APPROVED"


def test_start_opens_bkash_channel_with_callbacks(world):
    order = world["order"]("BKASH")
    res, post = _start(world, order)
    assert res.status_code == 201, res.data
    # bKash orders go straight to the bKash page, not the all-options page.
    assert res.data["data"]["url"] == "https://sandbox.sslcommerz.com/bkash-direct"
    sent = post.call_args.kwargs["data"]
    assert sent["multi_card_name"] == "bkash"
    assert sent["total_amount"] == f"{order.total_amount:.2f}"
    assert sent["success_url"].endswith("/api/v1/payments/gateway/success/")
    assert sent["ipn_url"].endswith("/api/v1/payments/gateway/ipn/")


def test_card_orders_get_the_all_options_page(world):
    order = world["order"]("SSLCOMMERZ")
    res, _ = _start(world, order)
    assert res.data["data"]["url"] == SESSION_OK["GatewayPageURL"]


def test_only_owner_and_only_online_methods_can_start(world):
    order = world["order"]("NAGAD")
    with mock.patch("apps.payments.gateway.requests.post", return_value=_Resp(SESSION_OK)):
        assert _client(world["other"]).post(f"/api/v1/payments/orders/{order.id}/gateway/").status_code == 404
    bank = world["order"]("BANK_TRANSFER")
    assert _start(world, bank)[0].status_code == 400


@override_settings(SSLCOMMERZ_SANDBOX=False)
def test_live_payment_confirms_order_and_returns_to_app(world):
    order = world["order"]("BKASH")
    _start(world, order)
    gp = GatewayPayment.objects.get(order=order)
    with mock.patch("apps.payments.gateway.requests.get", return_value=_Resp(_validation(gp))):
        page = APIClient().post("/api/v1/payments/gateway/success/", {"tran_id": gp.tran_id, "val_id": "V1"})
        # The IPN arriving too must not double-process.
        APIClient().post("/api/v1/payments/gateway/ipn/", {"tran_id": gp.tran_id, "val_id": "V1", "status": "VALID"})
    assert page.status_code == 200
    assert f"fabrilink://order/{order.id}?payment=success" in page.content.decode()
    order.refresh_from_db()
    assert order.status == "PAID_CREDIT_APPROVED"
    assert order.payment_submissions.count() == 1
    assert order.payment_submissions.get().status == "VERIFIED"


def test_sandbox_payment_waits_for_admin(world):
    order = world["order"]("SSLCOMMERZ")
    _start(world, order)
    gp = GatewayPayment.objects.get(order=order)
    with mock.patch("apps.payments.gateway.requests.get", return_value=_Resp(_validation(gp, card_type="VISA-Dutch Bangla"))):
        APIClient().post("/api/v1/payments/gateway/success/", {"tran_id": gp.tran_id, "val_id": "V2"})
    order.refresh_from_db()
    assert order.status == "REQUESTED"
    sub = order.payment_submissions.get()
    assert sub.status == "SUBMITTED"
    assert sub.note.startswith("TEST PAYMENT")


@override_settings(SSLCOMMERZ_SANDBOX=False)
def test_wrong_amount_or_unvalidated_payment_is_not_accepted(world):
    order = world["order"]("BKASH")
    _start(world, order)
    gp = GatewayPayment.objects.get(order=order)
    with mock.patch("apps.payments.gateway.requests.get", return_value=_Resp(_validation(gp, amount="10.00"))):
        page = APIClient().post("/api/v1/payments/gateway/success/", {"tran_id": gp.tran_id, "val_id": "V3"})
    assert "payment=fail" in page.content.decode()
    order.refresh_from_db()
    assert order.status == "REQUESTED"
    gp.refresh_from_db()
    assert gp.status == "INVALID"


def test_cancel_keeps_order_waiting_and_buyer_can_retry(world):
    order = world["order"]("NAGAD")
    _start(world, order)
    gp = GatewayPayment.objects.get(order=order)
    page = APIClient().post("/api/v1/payments/gateway/cancel/", {"tran_id": gp.tran_id})
    assert "payment=cancel" in page.content.decode()
    gp.refresh_from_db()
    assert gp.status == "CANCELLED"
    assert _start(world, order)[0].status_code == 201


@override_settings(SSLCOMMERZ_SANDBOX=False)
def test_risky_live_payment_waits_for_admin(world):
    order = world["order"]("SSLCOMMERZ")
    _start(world, order)
    gp = GatewayPayment.objects.get(order=order)
    with mock.patch("apps.payments.gateway.requests.get", return_value=_Resp(_validation(gp, risk_level="1", risk_title="Safe card"))):
        APIClient().post("/api/v1/payments/gateway/ipn/", {"tran_id": gp.tran_id, "val_id": "V4", "status": "VALID"})
    order.refresh_from_db()
    assert order.status == "REQUESTED"
    assert "risky" in order.payment_submissions.get().note
