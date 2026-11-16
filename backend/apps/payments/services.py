import re
from datetime import date

from django.db import transaction
from django.utils import timezone

from apps.catalog.models import UploadedImage
from apps.orders.models import Order, OrderStatusChoices, OrderTrackingEvent
from common.exceptions import (
    ConflictError,
    InvalidStateTransitionError,
    PermissionDeniedError,
    ValidationError,
)

from .models import (
    MANUAL_METHODS,
    PREPAID_METHODS,
    ManualPaymentMethod,
    PaymentSubmission,
    SubmissionStatus,
)

BD_MOBILE = re.compile(r"^01[3-9]\d{8}$")
WALLET_TRX = re.compile(r"^[A-Z0-9]{8,12}$")
BANK_REF = re.compile(r"^[A-Za-z0-9/\-_. ]{4,40}$")
SWIFT = re.compile(r"^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$")
CURRENCIES = {"BDT", "USD", "EUR", "GBP", "AED", "SAR", "QAR", "KWD", "MYR", "SGD", "INR", "CNY", "JPY", "AUD", "CAD"}


def is_international(country: str) -> bool:
    return (country or "").strip().lower() not in ("", "bangladesh", "bd", "বাংলাদেশ")


def normalise_bd_mobile(raw: str) -> str:
    """Accepts 01XXXXXXXXX, +8801XXXXXXXXX or 8801XXXXXXXXX with spaces or dashes."""
    digits = re.sub(r"\D", "", raw or "")
    if digits.startswith("880"):
        digits = digits[2:]
    return digits


def _clean(data: dict, method: str) -> dict:
    """Validates the proof for each method and returns the fields to store."""
    errors: dict[str, str] = {}
    out = {
        "amount": data.get("amount"),
        "note": (data.get("note") or "").strip(),
        "transfer_date": data.get("transfer_date"),
        "payment_purpose": (data.get("payment_purpose") or "").strip()[:140],
    }
    trx = (data.get("transaction_id") or "").strip()

    if method in (ManualPaymentMethod.BKASH, ManualPaymentMethod.NAGAD):
        number = normalise_bd_mobile(data.get("sender_account", ""))
        if not BD_MOBILE.match(number):
            errors["sender_account"] = "Enter the 11-digit wallet number you paid from, e.g. 01712345678."
        trx = trx.upper().replace(" ", "")
        if not WALLET_TRX.match(trx):
            errors["transaction_id"] = "Enter the transaction ID from the SMS (8–12 letters and numbers)."
        out.update(sender_account=number, currency="BDT", sender_name=(data.get("sender_name") or "").strip())
    else:
        if not BANK_REF.match(trx):
            errors["transaction_id"] = "Enter the bank's transfer reference (4–40 characters)."
        name = (data.get("sender_name") or "").strip()
        bank = (data.get("sender_bank_name") or "").strip()
        if len(name) < 2:
            errors["sender_name"] = "Enter the account holder's name the money was sent from."
        if len(bank) < 2:
            errors["sender_bank_name"] = "Enter the bank the money was sent from."
        currency = (data.get("currency") or "BDT").upper()
        if currency not in CURRENCIES:
            errors["currency"] = "Choose a supported currency."
        swift = (data.get("sender_swift_code") or "").strip().upper().replace(" ", "")
        if swift and not SWIFT.match(swift):
            errors["sender_swift_code"] = "A SWIFT/BIC code has 8 or 11 characters, e.g. HSBCGB2L."
        if not out["transfer_date"]:
            errors["transfer_date"] = "Enter the date you made the transfer."
        country = (data.get("sender_bank_country") or "Bangladesh").strip()
        account = (data.get("sender_account") or "").strip().replace(" ", "")
        address = (data.get("sender_address") or "").strip()
        charges = (data.get("charges_option") or "").strip().upper()
        if charges and charges not in ("OUR", "SHA", "BEN"):
            errors["charges_option"] = "Choose OUR, SHA or BEN."
        if is_international(country):
            # FATF Recommendation 16: a cross-border wire must carry the originator's
            # name, account number and address.
            if len(account) < 5:
                errors["sender_account"] = "For a transfer from abroad, enter the sender's account number or IBAN."
            if len(address) < 5:
                errors["sender_address"] = "For a transfer from abroad, enter the sender's address."
        out.update(
            sender_name=name,
            sender_bank_name=bank,
            sender_account=account,
            sender_bank_country=country,
            sender_swift_code=swift,
            sender_address=address,
            charges_option=charges,
            currency=currency,
        )

    transfer_date = out["transfer_date"]
    if isinstance(transfer_date, date) and transfer_date > timezone.localdate():
        errors["transfer_date"] = "The transfer date can't be in the future."
    if out["amount"] is None or out["amount"] <= 0:
        errors["amount"] = "Enter the amount you sent."

    if errors:
        raise ValidationError("Please check the payment details.", details=errors)
    out["transaction_id"] = trx
    return out


def latest_submission(order: Order) -> PaymentSubmission | None:
    return order.payment_submissions.order_by("-created_at").first()


@transaction.atomic
def submit_payment(*, order: Order, buyer, data: dict) -> PaymentSubmission:
    order = Order.objects.select_for_update().get(id=order.id)
    if order.buyer_id != buyer.id:
        raise PermissionDeniedError("You can only pay for your own orders.")
    if order.payment_method not in MANUAL_METHODS:
        raise ValidationError("This order doesn't need a payment proof.")
    if order.status != OrderStatusChoices.REQUESTED:
        raise InvalidStateTransitionError("This order isn't waiting for payment.")

    last = latest_submission(order)
    if last and last.status in (SubmissionStatus.SUBMITTED, SubmissionStatus.VERIFIED):
        raise ConflictError("A payment for this order is already being checked.")

    method = order.payment_method
    fields = _clean(data, method)
    if not fields["payment_purpose"]:
        fields["payment_purpose"] = f"Payment for fabric, order {order.order_number}"

    receipt_id = data.get("receipt_id")
    if receipt_id:
        receipt = UploadedImage.objects.filter(id=receipt_id, is_private=True, company=buyer).first()
        if receipt is None:
            raise ValidationError("Attach the receipt again.", details={"receipt_id": "Receipt not found."})
        fields["receipt"] = receipt
    reused = PaymentSubmission.objects.filter(
        method=method, transaction_id__iexact=fields["transaction_id"]
    ).exclude(status=SubmissionStatus.REJECTED)
    if reused.exists():
        raise ConflictError("This transaction ID has already been used for another payment.")

    submission = PaymentSubmission.objects.create(order=order, buyer=buyer, method=method, **fields)
    OrderTrackingEvent.objects.create(
        order=order,
        from_status=order.status,
        to_status=order.status,
        title="Payment details submitted",
        description=f"{submission.get_method_display()} · Ref {submission.transaction_id}. Waiting for FabriLink to confirm.",
        location="FabriLink Accounts",
    )
    return submission


@transaction.atomic
def record_payment_by_admin(*, order: Order, actor, transaction_id: str, amount=None, note: str = "") -> PaymentSubmission:
    """
    An admin confirms money that arrived outside the app's proof form, e.g. the buyer
    phoned in their TrxID, or is still on an older app version without the payment screen.
    """
    order = Order.objects.select_for_update().get(id=order.id)
    if order.payment_method not in PREPAID_METHODS:
        raise ValidationError("This order doesn't need a payment proof.")
    if order.status != OrderStatusChoices.REQUESTED:
        raise InvalidStateTransitionError("This order isn't waiting for payment.")
    if order.payment_submissions.filter(status=SubmissionStatus.SUBMITTED).exists():
        raise ConflictError("The buyer already sent a payment for review. Verify or reject that one instead.")

    trx = (transaction_id or "").strip().upper()
    if len(trx) < 4:
        raise ValidationError("Enter the transaction ID or bank reference.", details={"transaction_id": "At least 4 characters."})
    if PaymentSubmission.objects.filter(method=order.payment_method, transaction_id__iexact=trx).exclude(
        status=SubmissionStatus.REJECTED
    ).exists():
        raise ConflictError("This transaction ID has already been used for another payment.")

    submission = PaymentSubmission.objects.create(
        order=order,
        buyer=order.buyer,
        method=order.payment_method,
        amount=amount or order.total_amount,
        currency="BDT",
        transaction_id=trx,
        note="Recorded by admin",
        transfer_date=timezone.localdate(),
    )
    return review_payment(submission=submission, action="VERIFY", actor=actor, note=note or "Recorded by admin")


@transaction.atomic
def review_payment(*, submission: PaymentSubmission, action: str, actor, note: str = "") -> PaymentSubmission:
    submission = PaymentSubmission.objects.select_for_update().select_related("order").get(id=submission.id)
    if submission.status != SubmissionStatus.SUBMITTED:
        raise InvalidStateTransitionError("This payment has already been reviewed.")
    order = Order.objects.select_for_update().get(id=submission.order_id)

    submission.reviewed_by = actor
    submission.reviewed_at = timezone.now()
    submission.review_note = (note or "").strip()

    if action == "VERIFY":
        if order.status != OrderStatusChoices.REQUESTED:
            raise InvalidStateTransitionError("The order is no longer waiting for payment.")
        submission.status = SubmissionStatus.VERIFIED
        order.status = OrderStatusChoices.PAID_CREDIT_APPROVED
        order.save(update_fields=["status", "updated_at"])
        OrderTrackingEvent.objects.create(
            order=order,
            from_status=OrderStatusChoices.REQUESTED,
            to_status=OrderStatusChoices.PAID_CREDIT_APPROVED,
            title="Payment confirmed",
            description=f"{submission.get_method_display()} payment {submission.transaction_id} verified. Cutting job sent to the hub.",
            location="FabriLink Accounts",
            actor=actor,
        )
    elif action == "REJECT":
        submission.status = SubmissionStatus.REJECTED
        OrderTrackingEvent.objects.create(
            order=order,
            from_status=order.status,
            to_status=order.status,
            title="Payment not confirmed",
            description=submission.review_note or "We couldn't match this payment. Please check the details and submit again.",
            location="FabriLink Accounts",
            actor=actor,
        )
    else:
        raise ValidationError("Action must be VERIFY or REJECT.")

    submission.save(update_fields=["status", "reviewed_by", "reviewed_at", "review_note", "updated_at"])
    return submission
