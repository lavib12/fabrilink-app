"""
SSLCommerz hosted checkout: the buyer pays on SSLCommerz's page (bKash, Nagad, cards,
internet banking), SSLCommerz sends them back, and we confirm the payment with
SSLCommerz's validation API before marking the order paid.
"""

import secrets
from decimal import Decimal

import requests
from django.conf import settings
from django.db import transaction

from apps.orders.models import Order, OrderStatusChoices
from common.exceptions import InvalidStateTransitionError, PermissionDeniedError, ValidationError

from .models import (
    GATEWAY_METHODS,
    GatewayPayment,
    GatewayStatus,
    PaymentSubmission,
    SubmissionStatus,
)
from .services import review_payment

# Which SSLCommerz channel to open straight away for each app payment method.
CHANNEL = {"BKASH": "bkash", "NAGAD": "nagad", "SSLCOMMERZ": ""}


def _base() -> str:
    return "https://sandbox.sslcommerz.com" if settings.SSLCOMMERZ_SANDBOX else "https://securepay.sslcommerz.com"


def _clip(value, n=50) -> str:
    return (str(value or "").strip() or "N/A")[:n]


def start_gateway_payment(*, order: Order, buyer, urls: dict[str, str]) -> GatewayPayment:
    """Creates an SSLCommerz session and returns the attempt with its payment page URL in detail['url']."""
    if order.buyer_id != getattr(buyer, "id", None):
        raise PermissionDeniedError("You can only pay for your own orders.")
    if order.payment_method not in GATEWAY_METHODS:
        raise ValidationError("This order isn't paid online.")
    if order.status != OrderStatusChoices.REQUESTED:
        raise InvalidStateTransitionError("This order isn't waiting for payment.")
    if order.payment_submissions.filter(status=SubmissionStatus.SUBMITTED).exists():
        raise InvalidStateTransitionError("A payment for this order is already being checked.")

    tran_id = f"FL{order.order_number[-8:]}{secrets.token_hex(4).upper()}"
    address = buyer.addresses.filter(is_default=True).first() or buyer.addresses.first()
    user = buyer.user
    payload = {
        "store_id": settings.SSLCOMMERZ_STORE_ID,
        "store_passwd": settings.SSLCOMMERZ_STORE_PASSWORD,
        "total_amount": f"{order.total_amount:.2f}",
        "currency": "BDT",
        "tran_id": tran_id,
        "success_url": urls["success"],
        "fail_url": urls["fail"],
        "cancel_url": urls["cancel"],
        "ipn_url": urls["ipn"],
        "cus_name": _clip(buyer.name),
        "cus_email": _clip(user.email),
        "cus_add1": _clip(getattr(address, "street_address", "") or "Dhaka"),
        "cus_city": _clip(getattr(address, "district", "") or "Dhaka"),
        "cus_postcode": _clip(getattr(address, "postal_code", "") or "1000", 30),
        "cus_country": "Bangladesh",
        "cus_phone": _clip(buyer.contact_phone or user.phone, 20),
        "shipping_method": "Courier",
        "num_of_item": "1",
        "ship_name": _clip(buyer.name),
        "ship_add1": _clip(getattr(address, "street_address", "") or "Dhaka"),
        "ship_city": _clip(getattr(address, "district", "") or "Dhaka"),
        "ship_postcode": _clip(getattr(address, "postal_code", "") or "1000"),
        "ship_country": "Bangladesh",
        "product_name": f"Fabric order {order.order_number}",
        "product_category": "Fabric",
        "product_profile": "physical-goods",
        "value_a": str(order.id),
    }
    if CHANNEL.get(order.payment_method):
        payload["multi_card_name"] = CHANNEL[order.payment_method]

    try:
        res = requests.post(f"{_base()}/gwprocess/v4/api.php", data=payload, timeout=30)
        data = res.json()
    except (requests.RequestException, ValueError):
        raise ValidationError("Couldn't reach the payment gateway. Please try again.") from None
    if data.get("status") != "SUCCESS" or not data.get("GatewayPageURL"):
        raise ValidationError(f"The payment gateway refused the request: {data.get('failedreason') or 'unknown error'}.")

    # Open bKash / Nagad directly (like Daraz) when SSLCommerz offers a link for that channel;
    # otherwise show SSLCommerz's page with every option.
    page_url = data["GatewayPageURL"]
    channel = CHANNEL.get(order.payment_method)
    if channel:
        direct = next(
            (g.get("redirectGatewayURL") for g in data.get("desc") or [] if g.get("gw") == channel and g.get("redirectGatewayURL")),
            None,
        )
        page_url = direct or page_url

    return GatewayPayment.objects.create(
        order=order,
        tran_id=tran_id,
        method=order.payment_method,
        amount=order.total_amount,
        sandbox=settings.SSLCOMMERZ_SANDBOX,
        detail={"url": page_url, "sessionkey": data.get("sessionkey", "")},
    )


def validate_with_sslcommerz(val_id: str) -> dict:
    try:
        res = requests.get(
            f"{_base()}/validator/api/validationserverAPI.php",
            params={
                "val_id": val_id,
                "store_id": settings.SSLCOMMERZ_STORE_ID,
                "store_passwd": settings.SSLCOMMERZ_STORE_PASSWORD,
                "format": "json",
            },
            timeout=30,
        )
        return res.json()
    except (requests.RequestException, ValueError):
        return {}


@transaction.atomic
def complete_gateway_payment(*, tran_id: str, val_id: str = "", outcome: str = "success") -> GatewayPayment | None:
    """
    Handles SSLCommerz's redirect or IPN. Safe to call more than once for the same payment.
    Only a validation-API result that matches the transaction and amount counts as paid.
    """
    gp = GatewayPayment.objects.select_for_update().select_related("order").filter(tran_id=tran_id).first()
    if gp is None:
        return None
    if gp.status == GatewayStatus.SUCCESS:
        return gp

    if outcome != "success" or not val_id:
        gp.status = GatewayStatus.CANCELLED if outcome == "cancel" else GatewayStatus.FAILED
        gp.save(update_fields=["status", "updated_at"])
        return gp

    v = validate_with_sslcommerz(val_id)
    ok = (
        v.get("status") in ("VALID", "VALIDATED")
        and v.get("tran_id") == gp.tran_id
        and v.get("currency_type", "BDT") == "BDT"
        and Decimal(str(v.get("currency_amount") or v.get("amount") or "0")) >= gp.amount
    )
    gp.val_id = val_id
    gp.detail = {**gp.detail, "validation": {k: v.get(k) for k in (
        "status", "amount", "currency_amount", "card_type", "card_no", "bank_tran_id", "risk_level", "risk_title", "tran_date"
    )}}
    if not ok:
        gp.status = GatewayStatus.INVALID
        gp.save(update_fields=["status", "val_id", "detail", "updated_at"])
        return gp

    gp.status = GatewayStatus.SUCCESS
    gp.bank_tran_id = str(v.get("bank_tran_id") or "")[:80]
    gp.card_type = str(v.get("card_type") or "")[:60]
    gp.card_no = str(v.get("card_no") or "")[:60]
    gp.save()

    order = Order.objects.select_for_update().get(id=gp.order_id)
    if order.status != OrderStatusChoices.REQUESTED:
        return gp  # cancelled or already paid another way; the payment stays on record for a refund

    note = f"Paid online via SSLCommerz ({gp.card_type or gp.method})."
    if gp.sandbox:
        note = "TEST PAYMENT on the SSLCommerz sandbox: no real money was received. " + note
    if str(v.get("risk_level")) == "1":
        note += f" Flagged as risky by SSLCommerz: {v.get('risk_title') or 'check before shipping'}."
    submission = PaymentSubmission.objects.create(
        order=order,
        buyer=order.buyer,
        method=gp.method,
        amount=gp.amount,
        currency="BDT",
        transaction_id=(gp.bank_tran_id or gp.val_id)[:64],
        sender_account=gp.card_no[:50],
        note=note,
        payment_purpose=f"Payment for fabric, order {order.order_number}",
    )
    # Real, low-risk payments confirm the order straight away. Sandbox (test) payments and
    # risky ones wait for an admin so no fabric ships without real money.
    if not gp.sandbox and str(v.get("risk_level")) != "1":
        review_payment(submission=submission, action="VERIFY", actor=None, note="Confirmed by SSLCommerz")
    return gp
