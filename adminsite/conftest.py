import django.conf
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

# Allow migrations for shared models during tests
django.conf.settings.TESTING = True


@pytest.fixture
def api_client():
    """Unauthenticated DRF API test client."""
    return APIClient()


@pytest.fixture
def admin_user(db):
    """Create an admin (is_staff=True) user."""
    User = get_user_model()
    return User.objects.create_user(
        username="adminuser",
        email="admin@example.com",
        password="adminpass123",
        is_staff=True,
    )


@pytest.fixture
def admin_client(api_client, admin_user):
    """API client authenticated as admin user."""
    api_client.force_authenticate(user=admin_user)
    return api_client


@pytest.fixture
def regular_user(db):
    """Create a non-admin user."""
    User = get_user_model()
    return User.objects.create_user(
        username="regularuser",
        email="regular@example.com",
        password="regularpass123",
        is_staff=False,
    )


@pytest.fixture
def regular_client(api_client, regular_user):
    """API client authenticated as a regular (non-admin) user."""
    api_client.force_authenticate(user=regular_user)
    return api_client
