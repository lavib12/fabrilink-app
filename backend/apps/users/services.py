from typing import Any

from django.conf import settings
from django.db import transaction
from rest_framework_simplejwt.tokens import RefreshToken

from apps.companies.models import Company, CompanyTypeChoices, VerificationStatusChoices
from common.exceptions import ConflictError, DomainException, ValidationError

from .models import RoleChoices, User, UserProfile


@transaction.atomic
def register_user(
    *,
    email: str,
    phone: str,
    password: str,
    role: str,
    company_name: str,
    first_name: str = "",
    last_name: str = "",
    preferred_language: str = "bn",
) -> tuple[User, dict[str, str]]:
    """
    Registers a new user, creates their profile, creates an initial company profile,
    and returns the User along with a JWT token pair.
    """
    if User.objects.filter(email__iexact=email).exists():
        raise ConflictError("A user with this email address already exists.")

    if User.objects.filter(phone=phone).exists():
        raise ConflictError("A user with this phone number already exists.")

    user = User.objects.create_user(
        email=email.lower().strip(),
        phone=phone.strip(),
        password=password,
        role=role,
    )

    UserProfile.objects.create(
        user=user,
        first_name=first_name.strip(),
        last_name=last_name.strip(),
        preferred_language=preferred_language,
    )

    # Determine company type from role
    co_type = (
        CompanyTypeChoices.FACTORY if role == RoleChoices.FACTORY else CompanyTypeChoices.BUYER
    )

    # Buyers can order straight away unless BUYER_KYC_REQUIRED is switched on. Factories
    # always go through KYC because they list fabric and receive payouts.
    approve_now = co_type == CompanyTypeChoices.BUYER and not settings.BUYER_KYC_REQUIRED
    Company.objects.create(
        user=user,
        name=company_name.strip(),
        company_type=co_type,
        contact_email=user.email,
        contact_phone=user.phone,
        verification_status=(
            VerificationStatusChoices.APPROVED if approve_now else VerificationStatusChoices.PENDING
        ),
    )

    refresh = RefreshToken.for_user(user)
    tokens = {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
    }

    return user, tokens


def authenticate_user(*, email: str, password: str) -> tuple[User, dict[str, str]]:
    """Authenticates a user and generates fresh JWT tokens."""
    user = User.objects.filter(email__iexact=email.strip()).first()
    if not user or not user.check_password(password):
        raise ValidationError("Invalid email or password.")

    if not user.is_active:
        raise DomainException("User account is inactive. Please contact support.")

    refresh = RefreshToken.for_user(user)
    tokens = {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
    }
    return user, tokens


@transaction.atomic
def update_user_profile(
    *,
    user: User,
    data: dict[str, Any],
) -> UserProfile:
    """Updates user profile data."""
    profile, _ = UserProfile.objects.get_or_create(user=user)
    allowed_fields = ["first_name", "last_name", "designation", "preferred_language"]
    for field in allowed_fields:
        if field in data:
            setattr(profile, field, data[field])
    if "avatar" in data and data["avatar"]:
        profile.avatar = data["avatar"]
    profile.save()
    return profile
