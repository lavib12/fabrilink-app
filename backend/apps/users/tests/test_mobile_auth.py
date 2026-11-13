import pytest
from rest_framework.test import APIClient

from apps.users.models import RoleChoices, User

MOBILE = {"HTTP_X_CLIENT_PLATFORM": "mobile"}


@pytest.fixture
def user(db):
    return User.objects.create_user(
        email="mobile@test.com",
        phone="+8801700111222",
        password="MobilePass123!",
        role=RoleChoices.BUYER,
    )


def _login(client, **extra):
    return client.post(
        "/api/v1/auth/login/",
        {"email": "mobile@test.com", "password": "MobilePass123!"},
        format="json",
        **extra,
    )


def test_web_login_does_not_expose_refresh_token_in_body(user):
    res = _login(APIClient())
    assert res.status_code == 200
    assert "refresh_token" not in res.data["data"]


def test_mobile_login_returns_refresh_token_and_rotation_works(user):
    client = APIClient()
    res = _login(client, **MOBILE)
    refresh = res.data["data"]["refresh_token"]
    assert refresh

    # Mobile refresh uses the body token (not cookies) and returns a rotated one.
    client.cookies.clear()
    res2 = client.post("/api/v1/auth/token/refresh/", {"refresh": refresh}, format="json", **MOBILE)
    assert res2.status_code == 200
    assert res2.data["data"]["access_token"]
    new_refresh = res2.data["data"]["refresh_token"]
    assert new_refresh != refresh

    # The old refresh token is blacklisted after rotation.
    res3 = client.post("/api/v1/auth/token/refresh/", {"refresh": refresh}, format="json", **MOBILE)
    assert res3.status_code == 401
