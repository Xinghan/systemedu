from django.conf import settings
from django.db import models


class Project(models.Model):
    """An industrial-grade learning project."""

    CATEGORY_CHOICES = [
        ("ai", "AI & Machine Learning"),
        ("biotech", "Biotechnology"),
        ("aerospace", "Aerospace"),
        ("music", "Music & Audio"),
        ("climate", "Climate & Environment"),
        ("robotics", "Robotics"),
        ("chemistry", "Chemistry"),
        ("math", "Mathematics"),
        ("cs", "Computer Science"),
        ("other", "Other"),
    ]

    title = models.CharField(max_length=200)
    subtitle = models.CharField(max_length=300, blank=True)
    description = models.TextField()
    cover_image = models.URLField(blank=True)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default="other")
    min_age = models.PositiveSmallIntegerField(default=6)
    max_age = models.PositiveSmallIntegerField(default=18)
    estimated_hours = models.PositiveSmallIntegerField(default=10)
    is_published = models.BooleanField(default=False)
    is_template = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_projects",
    )
    forked_from = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="forks",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "projects"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.title


class Milestone(models.Model):
    """A major deliverable within a project."""

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="milestones")
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    order = models.PositiveSmallIntegerField(default=0)
    acceptance_criteria = models.TextField(blank=True)
    xp_reward = models.PositiveIntegerField(default=100)

    class Meta:
        db_table = "milestones"
        ordering = ["project", "order"]
        unique_together = [("project", "order")]

    def __str__(self) -> str:
        return f"{self.project.title} - {self.title}"


class KnowledgeNode(models.Model):
    """An atomic learning unit within a milestone."""

    CONTENT_TYPE_CHOICES = [
        ("text", "Text / Reading"),
        ("interactive", "Interactive Exercise"),
        ("code", "Coding Task"),
        ("experiment", "Experiment / Hands-on"),
        ("quiz", "Quiz"),
        ("video", "Video"),
    ]

    ACCEPTANCE_TYPE_CHOICES = [
        ("quiz", "Quiz"),
        ("code_submit", "Code Submission"),
        ("essay", "Essay / Written Response"),
        ("demo", "Demo / Presentation"),
        ("peer_review", "Peer Review"),
        ("auto", "Auto-verified (read-through)"),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="knodes")
    milestone = models.ForeignKey(Milestone, on_delete=models.CASCADE, related_name="knodes")
    title = models.CharField(max_length=200)
    summary = models.TextField(blank=True)
    difficulty_level = models.PositiveSmallIntegerField(default=1)  # 1-10
    content_type = models.CharField(max_length=20, choices=CONTENT_TYPE_CHOICES, default="text")
    acceptance_type = models.CharField(max_length=20, choices=ACCEPTANCE_TYPE_CHOICES, default="quiz")
    estimated_minutes = models.PositiveSmallIntegerField(default=15)
    xp_reward = models.PositiveIntegerField(default=20)
    order = models.PositiveSmallIntegerField(default=0)
    prerequisites = models.ManyToManyField("self", symmetrical=False, blank=True, related_name="unlocks")

    class Meta:
        db_table = "knowledge_nodes"
        ordering = ["milestone", "order"]

    def __str__(self) -> str:
        return self.title
