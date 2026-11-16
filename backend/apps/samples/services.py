from django.db import transaction

from apps.catalog.models import FabricRoll
from apps.catalog.selectors import can_view_fabric_roll
from apps.companies.models import Company, CompanyTypeChoices, VerificationStatusChoices
from common.exceptions import (
    ConflictError,
    InvalidStateTransitionError,
    NotFoundError,
    PermissionDeniedError,
    ValidationError,
)

from .models import OPEN_SAMPLE_STATUSES, SampleRequest, SampleStatus

# Who may move a request from one status to the next.
FACTORY_TRANSITIONS = {
    SampleStatus.REQUESTED: {SampleStatus.ACCEPTED, SampleStatus.DECLINED},
    SampleStatus.ACCEPTED: {SampleStatus.SHIPPED, SampleStatus.DECLINED},
    SampleStatus.SHIPPED: {SampleStatus.DELIVERED},
}
BUYER_TRANSITIONS = {
    SampleStatus.REQUESTED: {SampleStatus.CANCELLED},
    SampleStatus.ACCEPTED: {SampleStatus.CANCELLED},
    SampleStatus.SHIPPED: {SampleStatus.DELIVERED},
}


def _is_admin(user) -> bool:
    return bool(user.is_staff or user.role == "ADMIN")


def requests_visible_to(user, company: Company | None):
    qs = SampleRequest.objects.select_related("buyer", "factory", "fabric_roll")
    if _is_admin(user):
        return qs
    if company is None:
        return qs.none()
    if company.company_type == CompanyTypeChoices.BUYER:
        return qs.filter(buyer=company)
    if company.company_type == CompanyTypeChoices.FACTORY:
        return qs.filter(factory=company)
    return qs.none()


@transaction.atomic
def create_sample_request(
    *, user, buyer: Company | None, roll_id, swatch_size=None, notes="", delivery_address=""
) -> SampleRequest:
    if buyer is None or buyer.company_type != CompanyTypeChoices.BUYER:
        raise PermissionDeniedError("Only buyer accounts can request samples.")
    if buyer.verification_status != VerificationStatusChoices.APPROVED:
        raise PermissionDeniedError(
            "Your company's KYC verification must be approved before requesting samples.",
            code="company_not_verified",
        )

    roll = FabricRoll.objects.select_related("factory").filter(id=roll_id).first()
    if roll is None or not can_view_fabric_roll(roll, user, buyer):
        raise NotFoundError("The specified fabric roll was not found.")
    if not roll.is_sample_available:
        raise ValidationError("The mill doesn't offer samples for this roll.")

    if SampleRequest.objects.filter(
        buyer=buyer, fabric_roll=roll, status__in=OPEN_SAMPLE_STATUSES
    ).exists():
        raise ConflictError("You already have an open sample request for this roll.")

    if not delivery_address:
        address = buyer.addresses.filter(is_default=True).first() or buyer.addresses.first()
        if address:
            delivery_address = f"{address.street_address}, {address.district}"

    return SampleRequest.objects.create(
        buyer=buyer,
        factory=roll.factory,
        fabric_roll=roll,
        swatch_size=swatch_size or SampleRequest._meta.get_field("swatch_size").default,
        notes=(notes or "").strip(),
        delivery_address=(delivery_address or "").strip(),
        sample_price=roll.sample_price or 0,
    )


@transaction.atomic
def update_sample_status(*, user, company: Company | None, sample: SampleRequest, status, note=""):
    current = SampleStatus(sample.status)
    target = SampleStatus(status)

    if _is_admin(user):
        allowed = FACTORY_TRANSITIONS.get(current, set()) | BUYER_TRANSITIONS.get(current, set())
    elif company is not None and company.id == sample.factory_id:
        allowed = FACTORY_TRANSITIONS.get(current, set())
    elif company is not None and company.id == sample.buyer_id:
        allowed = BUYER_TRANSITIONS.get(current, set())
    else:
        raise PermissionDeniedError("You can't update this sample request.")

    if target not in allowed:
        raise InvalidStateTransitionError(
            f"A sample request can't move from {current.label} to {target.label}."
        )

    sample.status = target
    fields = ["status", "updated_at"]
    if note and (company is None or company.id != sample.buyer_id):
        sample.factory_note = note.strip()
        fields.append("factory_note")
    sample.save(update_fields=fields)
    return sample
