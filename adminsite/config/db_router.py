"""Database router to prevent admin service from creating migrations for shared models.

During testing (TESTING=True), the router allows all migrations so that pytest
can create the test database tables.
"""

from django.conf import settings


class AdminDBRouter:
    """Block migration operations on shared backend models from admin service."""

    SHARED_APPS = {"users", "projects", "progress", "knowledge"}

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        if getattr(settings, "TESTING", False):
            return None
        if app_label in self.SHARED_APPS:
            return False
        return None
