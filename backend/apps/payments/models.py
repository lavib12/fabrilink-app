from django.conf import settings
from django.db import models

from apps.companies.models import Company
from apps.orders.models import Order
from common.models import TimeStampedModel, UUIDModel


class ManualPaymentMethod(models.TextChoices):
    BKASH = "BKASH", "bKash"
    NAGAD = "NAGAD", "Nagad"
    BANK_TRANSFER = "BANK_TRANSFER", "Bank transfer"


# Orders paid with these stay "awaiting payment" until an admin checks the proof.
MANUAL_METHODS = {m.value for m in ManualPaymentMethod}


class WalletAccountType(models.TextChoices):
    PERSONAL = "PERSONAL", "Personal (Send Money)"
    MERCHANT = "MERCHANT", "Merchant (Payment)"
    AGENT = "AGENT", "Agent (Cash In)"


class PaymentSettings(models.Model):
    """
    Where buyers send money. One row, edited by an admin at /admin/ so numbers
    can change without a new app build or deploy.
    """

    bkash_number = models.CharField(max_length=20, blank=True)
    bkash_account_type = models.CharField(
        max_length=20, choices=WalletAccountType.choices, default=WalletAccountType.MERCHANT
    )
    nagad_number = models.CharField(max_length=20, blank=True)
    nagad_account_type = models.CharField(
        max_length=20, choices=WalletAccountType.choices, default=WalletAccountType.MERCHANT
    )

    bank_account_name = models.CharField(max_length=150, blank=True)
    bank_account_number = models.CharField(max_length=50, blank=True)
    bank_name = models.CharField(max_length=150, blank=True)
    bank_branch = models.CharField(max_length=150, blank=True)
    bank_routing_number = models.CharField(
        max_length=20, blank=True, help_text="Bangladesh Bank routing number (9 digits) for BEFTN/RTGS."
    )
    bank_swift_code = models.CharField(
        max_length=11, blank=True, help_text="SWIFT/BIC for transfers from abroad, e.g. BRAKBDDH."
    )
    bank_iban = models.CharField(
        max_length=34, blank=True, help_text="Only if your bank issues one (most Bangladeshi banks don't)."
    )
    bank_address = models.CharField(max_length=255, blank=True)
    bank_currencies = models.CharField(
        max_length=100, default="BDT, USD", help_text="Currencies this account can receive."
    )
    intermediary_bank = models.CharField(
        max_length=255,
        blank=True,
        help_text="Correspondent bank for USD/EUR wires, if your bank asks senders to use one.",
    )

    instructions = models.TextField(
        blank=True, help_text="Extra note shown to buyers on the payment screen."
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Payment receiving accounts"
        verbose_name_plural = "Payment receiving accounts"

    def __str__(self):
        return "Payment receiving accounts"

    @classmethod
    def load(cls) -> "PaymentSettings":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class ChargesOption(models.TextChoices):
    OUR = "OUR", "OUR: sender pays all charges"
    SHA = "SHA", "SHA: charges shared"
    BEN = "BEN", "BEN: receiver pays all charges"


class SubmissionStatus(models.TextChoices):
    SUBMITTED = "SUBMITTED", "Waiting for review"
    VERIFIED = "VERIFIED", "Verified"
    REJECTED = "REJECTED", "Rejected"


class PaymentSubmission(UUIDModel, TimeStampedModel):
    """A buyer's proof that they sent money for an order (bKash/Nagad TrxID or bank reference)."""

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="payment_submissions")
    buyer = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="payment_submissions")
    method = models.CharField(max_length=20, choices=ManualPaymentMethod.choices)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default="BDT")

    transaction_id = models.CharField(
        max_length=64, db_index=True, help_text="bKash/Nagad TrxID, or the bank's transfer reference."
    )
    sender_account = models.CharField(
        max_length=50, blank=True, help_text="Wallet number, or the sender's bank account / IBAN."
    )
    sender_name = models.CharField(max_length=150, blank=True)
    sender_bank_name = models.CharField(max_length=150, blank=True)
    sender_bank_country = models.CharField(max_length=80, blank=True)
    sender_swift_code = models.CharField(max_length=11, blank=True)
    transfer_date = models.DateField(null=True, blank=True)
    note = models.TextField(blank=True)

    # International wires: originator details required by the FATF travel rule (R.16)
    # and the SWIFT charge option the sender chose.
    sender_address = models.CharField(max_length=255, blank=True)
    charges_option = models.CharField(
        max_length=3, choices=ChargesOption.choices, blank=True, help_text="SWIFT field 71A."
    )
    payment_purpose = models.CharField(max_length=140, blank=True)
    receipt = models.ForeignKey(
        "catalog.UploadedImage",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="payment_submissions",
        help_text="Screenshot or bank slip; private to the buyer and admins.",
    )

    status = models.CharField(
        max_length=20,
        choices=SubmissionStatus.choices,
        default=SubmissionStatus.SUBMITTED,
        db_index=True,
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_payments",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_note = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Payment submission"
        verbose_name_plural = "Payment submissions"

    def __str__(self):
        return f"{self.get_method_display()} {self.transaction_id} for {self.order.order_number}"
