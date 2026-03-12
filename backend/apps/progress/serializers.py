from rest_framework import serializers

from .models import Achievement, UserAchievement, UserNodeProgress, UserProjectEnrollment


class EnrollmentSerializer(serializers.ModelSerializer):
    project_title = serializers.CharField(source="project.title", read_only=True)

    class Meta:
        model = UserProjectEnrollment
        fields = [
            "id", "project", "project_title", "status",
            "total_xp_earned", "started_at", "completed_at",
        ]
        read_only_fields = ["id", "total_xp_earned", "started_at", "completed_at"]


class NodeProgressSerializer(serializers.ModelSerializer):
    knode_title = serializers.CharField(source="knode.title", read_only=True)

    class Meta:
        model = UserNodeProgress
        fields = [
            "id", "knode", "knode_title", "status",
            "attempts", "best_score", "ai_feedback",
            "started_at", "passed_at",
        ]
        read_only_fields = ["id", "attempts", "best_score", "ai_feedback", "started_at", "passed_at"]


class AchievementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Achievement
        fields = ["id", "title", "description", "icon", "criteria_type", "criteria_value"]


class UserAchievementSerializer(serializers.ModelSerializer):
    achievement = AchievementSerializer(read_only=True)

    class Meta:
        model = UserAchievement
        fields = ["id", "achievement", "earned_at"]
