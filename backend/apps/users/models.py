from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Custom user model with learning profile fields."""

    display_name = models.CharField(max_length=100, blank=True)
    avatar_url = models.URLField(blank=True)
    age = models.PositiveSmallIntegerField(null=True, blank=True)
    grade_level = models.PositiveSmallIntegerField(null=True, blank=True)
    total_xp = models.PositiveIntegerField(default=0)
    level = models.PositiveSmallIntegerField(default=1)
    streak_days = models.PositiveIntegerField(default=0)
    parent_email = models.EmailField(blank=True)
    last_active_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "users"

    def __str__(self) -> str:
        return self.display_name or self.username
