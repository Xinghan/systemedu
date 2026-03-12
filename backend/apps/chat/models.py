from django.conf import settings
from django.db import models


class LearningSession(models.Model):
    """A chat session between a user and the AI tutor."""

    SESSION_TYPE_CHOICES = [
        ("tutoring", "Tutoring"),
        ("assessment", "Assessment"),
        ("practice", "Practice"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="learning_sessions"
    )
    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="learning_sessions"
    )
    knode = models.ForeignKey(
        "projects.KnowledgeNode",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="learning_sessions",
    )
    session_type = models.CharField(max_length=20, choices=SESSION_TYPE_CHOICES, default="tutoring")
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    messages_count = models.PositiveIntegerField(default=0)
    tokens_used = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "learning_sessions"
        ordering = ["-started_at"]

    def __str__(self) -> str:
        return f"Session {self.pk}: {self.user} on {self.project}"


class ChatMessage(models.Model):
    """A single message in a learning session."""

    ROLE_CHOICES = [
        ("user", "User"),
        ("assistant", "Assistant"),
    ]

    session = models.ForeignKey(LearningSession, on_delete=models.CASCADE, related_name="chat_messages")
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "chat_messages"
        ordering = ["created_at"]

    def __str__(self) -> str:
        return f"{self.role}: {self.content[:50]}"
