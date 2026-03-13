from rest_framework import serializers

from .models import KnowledgeNode, Milestone, Project


class KnowledgeNodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = KnowledgeNode
        fields = [
            "id", "title", "summary", "difficulty_level",
            "content_type", "acceptance_type", "estimated_minutes",
            "xp_reward", "order", "prerequisites",
        ]


class MilestoneSerializer(serializers.ModelSerializer):
    knodes = KnowledgeNodeSerializer(many=True, read_only=True)

    class Meta:
        model = Milestone
        fields = [
            "id", "title", "description", "order",
            "acceptance_criteria", "xp_reward", "knodes",
        ]


class ProjectListSerializer(serializers.ModelSerializer):
    milestone_count = serializers.IntegerField(source="milestones.count", read_only=True)
    fork_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Project
        fields = [
            "id", "title", "subtitle", "description", "cover_image",
            "category", "min_age", "max_age", "estimated_hours",
            "is_published", "milestone_count", "fork_count", "created_at",
        ]


class ProjectDetailSerializer(serializers.ModelSerializer):
    milestones = MilestoneSerializer(many=True, read_only=True)
    fork_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Project
        fields = [
            "id", "title", "subtitle", "description", "cover_image",
            "category", "min_age", "max_age", "estimated_hours",
            "is_published", "forked_from", "milestones", "fork_count",
            "created_at", "updated_at",
        ]


class MyProjectSerializer(serializers.ModelSerializer):
    """Serializer for user's forked projects with progress info."""

    forked_from_title = serializers.CharField(source="forked_from.title", read_only=True, default="")
    total_knodes = serializers.IntegerField(source="total_knodes_count", read_only=True, default=0)
    passed_knodes = serializers.IntegerField(source="passed_knodes_count", read_only=True, default=0)
    progress_percent = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            "id", "title", "subtitle", "description", "cover_image",
            "category", "min_age", "max_age", "estimated_hours",
            "forked_from", "forked_from_title",
            "total_knodes", "passed_knodes", "progress_percent",
            "created_at",
        ]

    def get_progress_percent(self, obj):
        total = getattr(obj, "total_knodes_count", 0) or 0
        passed = getattr(obj, "passed_knodes_count", 0) or 0
        if total == 0:
            return 0
        return round(passed / total * 100)
