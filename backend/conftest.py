import pytest
from django.contrib.auth import get_user_model


@pytest.fixture
def api_client():
    """DRF API test client."""
    from rest_framework.test import APIClient
    return APIClient()


@pytest.fixture
def user(db):
    """Create a test user."""
    User = get_user_model()
    return User.objects.create_user(
        username="testuser",
        email="test@example.com",
        password="testpass123",
        age=14,
        grade_level=8,
    )


@pytest.fixture
def auth_client(api_client, user):
    """API client authenticated as test user."""
    api_client.force_authenticate(user=user)
    return api_client
