"""Models for the admin API (not shared with backend)."""

import uuid

from django.conf import settings
from django.db import models

from apps.projects.models import Project


class GenerationTask(models.Model):
    """Track async AI knowledge tree generation tasks."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        RUNNING = "running", "Running"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.PENDING,
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="generation_tasks",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    granularity = models.CharField(max_length=10, default="medium")
    instructions = models.TextField(blank=True, default="")
    result_json = models.JSONField(null=True, blank=True)
    error_message = models.TextField(blank=True, default="")
    milestones_created = models.IntegerField(null=True, blank=True)
    knodes_created = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"GenerationTask {self.id} [{self.status}]"
