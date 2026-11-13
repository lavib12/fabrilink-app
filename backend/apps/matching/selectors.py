import re
from decimal import Decimal

from django.db.models import Q, QuerySet

from apps.catalog.models import FabricRoll
from apps.companies.models import Company, CompanyTypeChoices, VerificationStatusChoices

from .models import SourcingRequest, SourcingRequestStatus

# Words that describe nearly every listing and would match everything.
STOP_WORDS = {"fabric", "fabrics", "the", "and", "with", "for", "100", "percent"}
GSM_TOLERANCE = Decimal("0.25")
MAX_MATCHES = 20


def requests_visible_to(user, company: Company | None) -> QuerySet[SourcingRequest]:
    """Buyers see their own requests; verified factories see open ones; admins see all."""
    qs = SourcingRequest.objects.select_related("buyer")
    if user.is_staff or user.role == "ADMIN":
        return qs
    if company is None:
        return qs.none()
    if company.company_type == CompanyTypeChoices.BUYER:
        return qs.filter(buyer=company)
    if (
        company.company_type == CompanyTypeChoices.FACTORY
        and company.verification_status == VerificationStatusChoices.APPROVED
    ):
        return qs.filter(status=SourcingRequestStatus.OPEN)
    return qs.none()


def _keywords(text: str) -> list[str]:
    words = re.findall(r"[a-zA-Z]{3,}", text.lower())
    return [w for w in dict.fromkeys(words) if w not in STOP_WORDS][:6]


def find_matching_rolls(request: SourcingRequest) -> QuerySet[FabricRoll]:
    """
    Suggests purchasable rolls for a request: any keyword in the title, composition or
    fabric type, GSM within ±25% of the target, and enough yards in stock.
    """
    qs = (
        FabricRoll.objects.select_related(
            "factory", "fabric_type", "location_address", "target_buyer"
        )
        .prefetch_related("images")
        .filter(
            is_deleted=False,
            status__in=["ACTIVE", "RESERVED_PARTIAL"],
            available_yards__gt=0,
        )
        # Public rolls plus custom profiles built for this buyer only.
        .filter(Q(target_buyer__isnull=True) | Q(target_buyer=request.buyer))
    )

    words = _keywords(f"{request.fabric_name} {request.color_preference}")
    if words:
        text_match = Q()
        for w in words:
            text_match |= (
                Q(title__icontains=w)
                | Q(composition__icontains=w)
                | Q(fabric_type__name__icontains=w)
                | Q(color_name__icontains=w)
                | Q(pattern__icontains=w)
            )
        qs = qs.filter(text_match)

    if request.target_gsm:
        spread = Decimal(request.target_gsm) * GSM_TOLERANCE
        qs = qs.filter(
            gsm__gte=int(request.target_gsm - spread), gsm__lte=int(request.target_gsm + spread)
        )

    if request.required_yards:
        qs = qs.filter(available_yards__gte=request.required_yards)

    return qs.order_by("-created_at")[:MAX_MATCHES]
