import pytest
from django.contrib.auth import get_user_model
from rest_framework import status

User = get_user_model()

REGISTER_URL = "/api/auth/register/"
LOGIN_URL = "/api/auth/login/"
PROFILE_URL = "/api/auth/profile/"


@pytest.fixture
def register_payload():
    return {
        "username": "newuser",
        "email": "new@example.com",
        "password": "SecurePass123!",
        "password2": "SecurePass123!",
        "display_name": "New User",
        "age": 12,
        "grade_level": 6,
        "parent_email": "parent@example.com",
    }


class TestRegister:
    def test_register_success(self, api_client, db, register_payload):
        resp = api_client.post(REGISTER_URL, register_payload)
        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data["username"] == "newuser"
        assert resp.data["email"] == "new@example.com"
        assert resp.data["age"] == 12
        assert "password" not in resp.data
        assert User.objects.filter(username="newuser").exists()

    def test_register_password_mismatch(self, api_client, db, register_payload):
        register_payload["password2"] = "WrongPass123!"
        resp = api_client.post(REGISTER_URL, register_payload)
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_register_duplicate_username(self, api_client, user, register_payload):
        register_payload["username"] = user.username
        resp = api_client.post(REGISTER_URL, register_payload)
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_register_weak_password(self, api_client, db, register_payload):
        register_payload["password"] = "123"
        register_payload["password2"] = "123"
        resp = api_client.post(REGISTER_URL, register_payload)
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_register_missing_fields(self, api_client, db):
        resp = api_client.post(REGISTER_URL, {})
        assert resp.status_code == status.HTTP_400_BAD_REQUEST


class TestLogin:
    def test_login_success(self, api_client, user):
        resp = api_client.post(LOGIN_URL, {
            "username": "testuser",
            "password": "testpass123",
        })
        assert resp.status_code == status.HTTP_200_OK
        assert "access" in resp.data
        assert "refresh" in resp.data

    def test_login_wrong_password(self, api_client, user):
        resp = api_client.post(LOGIN_URL, {
            "username": "testuser",
            "password": "wrongpass",
        })
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_login_nonexistent_user(self, api_client, db):
        resp = api_client.post(LOGIN_URL, {
            "username": "noone",
            "password": "whatever",
        })
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


class TestProfile:
    def test_get_profile(self, auth_client, user):
        resp = auth_client.get(PROFILE_URL)
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["username"] == user.username
        assert resp.data["total_xp"] == 0
        assert resp.data["level"] == 1

    def test_update_profile(self, auth_client, user):
        resp = auth_client.patch(PROFILE_URL, {"display_name": "Cool Kid"})
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["display_name"] == "Cool Kid"
        user.refresh_from_db()
        assert user.display_name == "Cool Kid"

    def test_profile_unauthenticated(self, api_client, db):
        resp = api_client.get(PROFILE_URL)
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_cannot_change_xp_via_profile(self, auth_client, user):
        resp = auth_client.patch(PROFILE_URL, {"total_xp": 9999})
        assert resp.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.total_xp == 0  # read-only field
