import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.catalog.models import FabricCategory, FabricRoll, FabricType
from apps.companies.models import (
    Company,
    CompanyAddress,
    CompanyTypeChoices,
    VerificationStatusChoices,
)
from apps.users.models import RoleChoices, User


@pytest.fixture
def factory_user(db):
    user = User.objects.create_user(
        email="square_textiles@test.com",
        phone="+8801711000888",
        password="TestPassword123!",
        role=RoleChoices.FACTORY,
    )
    company = Company.objects.create(
        user=user,
        name="Square Fashions Ltd.",
        company_type=CompanyTypeChoices.FACTORY,
        verification_status=VerificationStatusChoices.APPROVED,
        trade_license_number="TRAD/GAZ/2026/0998",
        bin_number="001293847-0101",
        contact_email="square_textiles@test.com",
        contact_phone="+8801711000888",
    )
    CompanyAddress.objects.create(
        company=company,
        address_type="FACTORY_PREMISES",
        division="Dhaka",
        district="Gazipur",
        upazila_thana="Kaliakair",
        street_address="Gorai Industrial Zone, Dhaka-Tangail Hwy",
        postal_code="1750",
        landmark="Near Square Pharma Plant",
        is_default=True,
    )
    return user, company


@pytest.fixture
def buyer_user(db):
    user = User.objects.create_user(
        email="boutique_owner@test.com",
        phone="+8801711000999",
        password="TestPassword123!",
        role=RoleChoices.BUYER,
    )
    company = Company.objects.create(
        user=user,
        name="Dhaka Vintage Boutique",
        company_type=CompanyTypeChoices.BUYER,
        verification_status=VerificationStatusChoices.APPROVED,
        contact_email="boutique_owner@test.com",
        contact_phone="+8801711000999",
    )
    return user, company


@pytest.fixture
def other_buyer_user(db):
    user = User.objects.create_user(
        email="sylhet_trends@test.com",
        phone="+8801711000777",
        password="TestPassword123!",
        role=RoleChoices.BUYER,
    )
    company = Company.objects.create(
        user=user,
        name="Sylhet Trendz",
        company_type=CompanyTypeChoices.BUYER,
        verification_status=VerificationStatusChoices.APPROVED,
        contact_email="sylhet_trends@test.com",
        contact_phone="+8801711000777",
    )
    return user, company


@pytest.fixture
def fabric_setup(db, factory_user, buyer_user, other_buyer_user):
    _, f_comp = factory_user
    _, b_comp = buyer_user
    _, other_comp = other_buyer_user

    cat = FabricCategory.objects.create(name="Woven", slug="woven")
    ft = FabricType.objects.create(category=cat, name="Twill", slug="twill")

    # Public roll
    r_public = FabricRoll.objects.create(
        factory=f_comp,
        fabric_type=ft,
        roll_code="ROL-PUB-01",
        title="Heavy Cotton Twill Khaki",
        composition="100% Cotton",
        gsm=280,
        width_inches=58.0,
        color_name="Khaki",
        color_hex="#C3B091",
        total_yards=200.0,
        available_yards=200.0,
        price_per_yard=280.0,
        status="ACTIVE",
    )

    # Custom profile built specifically for b_comp
    r_custom = FabricRoll.objects.create(
        factory=f_comp,
        fabric_type=ft,
        roll_code="ROL-CUST-01",
        title="Custom Bio-Washed Twill for Dhaka Vintage",
        composition="98% Cotton 2% Spandex",
        gsm=260,
        width_inches=56.0,
        color_name="Navy Blue",
        color_hex="#000080",
        total_yards=120.0,
        available_yards=120.0,
        price_per_yard=340.0,
        status="ACTIVE",
        is_custom_profile=True,
        target_buyer=b_comp,
        buyer_spec_notes="Custom elastic stretch formulation for Dhaka Vintage Winter Collection.",
    )

    return f_comp, b_comp, other_comp, r_public, r_custom


@pytest.mark.django_db
class TestFactoryStorefront:
    def test_get_factory_storefront_public_details(self, fabric_setup):
        f_comp, _, _, _, _ = fabric_setup
        client = APIClient()

        res = client.get(f"/api/v1/companies/factories/{f_comp.id}/")
        assert res.status_code == status.HTTP_200_OK
        data = res.data["data"]
        assert data["name"] == "Square Fashions Ltd."
        assert data["stats"]["total_active_rolls"] == 2
        assert data["stats"]["total_available_yards"] == 320.0
        assert len(data["addresses"]) == 1
        assert data["addresses"][0]["district"] == "Gazipur"

    def test_factory_store_rolls_filtering_for_authenticated_buyer(
        self, fabric_setup, buyer_user, other_buyer_user
    ):
        f_comp, b_comp, other_comp, r_public, r_custom = fabric_setup
        b_user, _ = buyer_user
        other_user, _ = other_buyer_user

        # Buyer 1 visits factory store - sees public roll + their custom profile
        client_b1 = APIClient()
        client_b1.force_authenticate(user=b_user)
        res_b1 = client_b1.get(f"/api/v1/catalog/rolls/?factory_id={f_comp.id}")
        assert res_b1.status_code == status.HTTP_200_OK
        ids_b1 = [r["id"] for r in res_b1.data["data"]]
        assert str(r_public.id) in ids_b1
        assert str(r_custom.id) in ids_b1

        # Other buyer visits factory store - sees public roll ONLY, NOT Buyer 1's custom profile
        client_b2 = APIClient()
        client_b2.force_authenticate(user=other_user)
        res_b2 = client_b2.get(f"/api/v1/catalog/rolls/?factory_id={f_comp.id}")
        assert res_b2.status_code == status.HTTP_200_OK
        ids_b2 = [r["id"] for r in res_b2.data["data"]]
        assert str(r_public.id) in ids_b2
        assert str(r_custom.id) not in ids_b2

        # Anonymous visitor visits factory store - sees public roll ONLY
        client_anon = APIClient()
        res_anon = client_anon.get(f"/api/v1/catalog/rolls/?factory_id={f_comp.id}")
        assert res_anon.status_code == status.HTTP_200_OK
        ids_anon = [r["id"] for r in res_anon.data["data"]]
        assert str(r_public.id) in ids_anon
        assert str(r_custom.id) not in ids_anon

    def test_list_all_factory_stores(self, fabric_setup):
        f_comp, _, _, _, _ = fabric_setup
        client = APIClient()
        res = client.get("/api/v1/companies/factories/")
        assert res.status_code == status.HTTP_200_OK
        data = res.data["data"]
        assert len(data) >= 1
        factory_names = [f["name"] for f in data]
        assert "Square Fashions Ltd." in factory_names
