from decimal import Decimal
from typing import Any

from django.db import transaction

from common.exceptions import DomainException, NotFoundError

from .models import Company, CompanyAddress, CreditStatusChoices, VerificationStatusChoices


@transaction.atomic
def update_company_kyc(*, company: Company, data: dict[str, Any]) -> Company:
    """Updates company trade details and marks status back to PENDING for re-verification if rejected."""
    for key, value in data.items():
        if value is not None and hasattr(company, key):
            setattr(company, key, value)

    if company.verification_status == VerificationStatusChoices.REJECTED:
        company.verification_status = VerificationStatusChoices.PENDING
        company.rejection_reason = ""

    company.save()
    return company


@transaction.atomic
def verify_company(
    *,
    company_id: str,
    action: str,
    rejection_reason: str = "",
    credit_limit: Decimal | None = None,
    credit_terms_days: int | None = None,
) -> Company:
    """Admin action to approve, reject or suspend a company."""
    company = Company.objects.select_for_update().filter(id=company_id).first()
    if not company:
        raise NotFoundError("Company not found.")

    if action == "APPROVE":
        company.verification_status = VerificationStatusChoices.APPROVED
        company.rejection_reason = ""
        company.user.is_verified = True
        company.user.save(update_fields=["is_verified"])
        if credit_limit is not None:
            company.credit_limit = credit_limit
        if credit_terms_days is not None:
            company.credit_terms_days = credit_terms_days
        # A credit limit is only usable once the credit line is active.
        if company.credit_status != CreditStatusChoices.BLOCKED:
            company.credit_status = (
                CreditStatusChoices.ACTIVE
                if company.credit_limit and company.credit_limit > 0
                else CreditStatusChoices.INELIGIBLE
            )
    elif action == "REJECT":
        company.verification_status = VerificationStatusChoices.REJECTED
        company.rejection_reason = rejection_reason or "Document verification failed."
    elif action == "SUSPEND":
        company.verification_status = VerificationStatusChoices.SUSPENDED
        company.rejection_reason = rejection_reason or "Account suspended by administrator."
    else:
        raise DomainException(f"Unsupported verification action: {action}")

    if action in ("REJECT", "SUSPEND") and company.user.is_verified:
        company.user.is_verified = False
        company.user.save(update_fields=["is_verified"])

    company.save()
    return company


@transaction.atomic
def create_company_address(*, company: Company, data: dict[str, Any]) -> CompanyAddress:
    """Creates a new company premises or delivery address."""
    if data.get("is_default", False):
        CompanyAddress.objects.filter(company=company).update(is_default=False)

    address = CompanyAddress.objects.create(
        company=company,
        **data,
    )
    return address
