import json

from rest_framework import serializers

from apps.projects.models import KnowledgeNode, Milestone, Project


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
            "is_published", "is_template", "milestone_count", "created_at",
        ]


class ProjectCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = [
            "id", "title", "subtitle", "description", "cover_image",
            "category", "min_age", "max_age", "estimated_hours",
            "is_published", "is_template",
        ]

    def validate_is_published(self, value):
        if not value:
            return value
        # When publishing, check project has milestones and knodes
        instance = self.instance
        if instance:
            if not instance.milestones.exists():
                raise serializers.ValidationError(
                    "Cannot publish: project has no knowledge tree. "
                    "Import or generate a knowledge tree first."
                )
            if not KnowledgeNode.objects.filter(project=instance).exists():
                raise serializers.ValidationError(
                    "Cannot publish: project has no knowledge nodes."
                )
        return value


class ProjectDetailSerializer(serializers.ModelSerializer):
    milestones = MilestoneSerializer(many=True, read_only=True)

    class Meta:
        model = Project
        fields = [
            "id", "title", "subtitle", "description", "cover_image",
            "category", "min_age", "max_age", "estimated_hours",
            "is_published", "is_template", "milestones", "created_at", "updated_at",
        ]


class CloneProjectSerializer(serializers.Serializer):
    new_title = serializers.CharField(max_length=200, required=False)


class GenerateTreeSerializer(serializers.Serializer):
    GRANULARITY_CHOICES = ("coarse", "medium", "fine")

    granularity = serializers.ChoiceField(
        choices=GRANULARITY_CHOICES, default="medium",
    )
    instructions = serializers.CharField(required=False, default="", allow_blank=True)


class ImportKnowledgeTreeSerializer(serializers.Serializer):
    tree_data = serializers.JSONField(required=False)
    replace = serializers.BooleanField(default=False)
    file = serializers.FileField(required=False)

    def validate(self, attrs):
        tree_data = attrs.get("tree_data")
        file = attrs.get("file")

        if not tree_data and not file:
            raise serializers.ValidationError(
                "Provide either 'tree_data' (JSON) or 'file' (uploaded .json file)."
            )

        if file:
            try:
                content = file.read().decode("utf-8")
                attrs["tree_data"] = json.loads(content)
            except (json.JSONDecodeError, UnicodeDecodeError) as e:
                raise serializers.ValidationError({"file": f"Invalid JSON file: {e}"})

        return attrs
