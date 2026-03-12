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

    class Meta:
        model = Project
        fields = [
            "id", "title", "subtitle", "description", "cover_image",
            "category", "min_age", "max_age", "estimated_hours",
            "is_published", "milestone_count", "created_at",
        ]


class ProjectDetailSerializer(serializers.ModelSerializer):
    milestones = MilestoneSerializer(many=True, read_only=True)

    class Meta:
        model = Project
        fields = [
            "id", "title", "subtitle", "description", "cover_image",
            "category", "min_age", "max_age", "estimated_hours",
            "is_published", "milestones", "created_at", "updated_at",
        ]
