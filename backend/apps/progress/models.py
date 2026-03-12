from django.conf import settings
from django.db import models


class UserProjectEnrollment(models.Model):
    """Tracks a user's enrollment and status in a project."""

    STATUS_CHOICES = [
        ("exploring", "Exploring"),
        ("active", "Active"),
        ("paused", "Paused"),
        ("completed", "Completed"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="enrollments"
    )
    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="enrollments"
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="exploring")
    total_xp_earned = models.PositiveIntegerField(default=0)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "user_project_enrollments"
        unique_together = [("user", "project")]

    def __str__(self) -> str:
        return f"{self.user} - {self.project} ({self.status})"


class UserNodeProgress(models.Model):
    """Tracks a user's progress on a single knowledge node."""

    STATUS_CHOICES = [
        ("locked", "Locked"),
        ("available", "Available"),
        ("in_progress", "In Progress"),
        ("submitted", "Submitted"),
        ("passed", "Passed"),
        ("failed", "Failed"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="node_progress"
    )
    knode = models.ForeignKey(
        "projects.KnowledgeNode", on_delete=models.CASCADE, related_name="user_progress"
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="locked")
    attempts = models.PositiveIntegerField(default=0)
    best_score = models.PositiveSmallIntegerField(default=0)  # 0-100
    ai_feedback = models.TextField(blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    passed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "user_node_progress"
        unique_together = [("user", "knode")]

    def __str__(self) -> str:
        return f"{self.user} - {self.knode} ({self.status})"


class Achievement(models.Model):
    """A badge or achievement users can earn."""

    CRITERIA_TYPE_CHOICES = [
        ("project_complete", "Complete a Project"),
        ("streak", "Learning Streak"),
        ("xp_threshold", "XP Threshold"),
        ("nodes_completed", "Nodes Completed Count"),
    ]

    title = models.CharField(max_length=200)
    description = models.TextField()
    icon = models.URLField(blank=True)
    criteria_type = models.CharField(max_length=20, choices=CRITERIA_TYPE_CHOICES)
    criteria_value = models.PositiveIntegerField(default=1)

    class Meta:
        db_table = "achievements"

    def __str__(self) -> str:
        return self.title


class UserAchievement(models.Model):
    """Join table for users and their earned achievements."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="achievements"
    )
    achievement = models.ForeignKey(Achievement, on_delete=models.CASCADE, related_name="earners")
    earned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "user_achievements"
        unique_together = [("user", "achievement")]

    def __str__(self) -> str:
        return f"{self.user} earned {self.achievement}"
