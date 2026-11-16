import pytest
from rest_framework.test import APIClient

from apps.users.models import RoleChoices, User

URL = "/api/v1/payments/accounts/"


def _client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.fixture
def users(db):
    admin = User.objects.create_superuser(email="a@acc.com", phone="+8801770000001", role=RoleChoices.ADMIN)
    buyer = User.objects.create_user(email="b@acc.com", phone="+8801770000002", role=RoleChoices.BUYER)
    return admin, buyer


def test_admin_saves_accounts_and_buyers_see_them(users):
    admin, buyer = users
    body = {
        "bkash_number": "+880 1811-222333", "bkash_account_type": "PERSONAL",
        "bank_account_name": "Test Name", "bank_account_number": "0123 4567 890",
        "bank_name": "Test Bank PLC", "bank_branch": "Test Branch",
        "bank_routing_number": "070 274 003", "bank_swift_code": "testbddh",
    }
    res = _client(admin).patch(URL, body, format="json")
    assert res.status_code == 200, res.data
    seen = _client(buyer).get(URL).data["data"]
    assert seen["bkash_number"] == "01811222333"
    assert seen["bkash_account_type_label"].startswith("Personal")
    assert seen["bank_account_number"] == "01234567890"
    assert seen["bank_routing_number"] == "070274003"
    assert seen["bank_swift_code"] == "TESTBDDH"


def test_gateway_live_flag_follows_sandbox_setting(users):
    _, buyer = users
    from django.test import override_settings

    assert _client(buyer).get(URL).data["data"]["gateway_live"] is False
    with override_settings(SSLCOMMERZ_SANDBOX=False):
        assert _client(buyer).get(URL).data["data"]["gateway_live"] is True


def test_only_admin_can_edit_and_bad_values_are_explained(users):
    admin, buyer = users
    assert _client(buyer).patch(URL, {"bkash_number": "01811222333"}, format="json").status_code == 403
    res = _client(admin).patch(
        URL, {"bkash_number": "12345", "bank_routing_number": "12", "bank_swift_code": "XX"}, format="json"
    )
    assert res.status_code == 400
    assert {"bkash_number", "bank_routing_number", "bank_swift_code"} <= set(res.data["error"]["details"])
