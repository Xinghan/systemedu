from rest_framework import serializers

from .models import ChatMessage, LearningSession


class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = ["id", "role", "content", "created_at"]
        read_only_fields = ["id", "created_at"]


class SendMessageSerializer(serializers.Serializer):
    """Input serializer for sending a chat message."""

    project_id = serializers.IntegerField()
    knode_id = serializers.IntegerField(required=False, default=None)
    session_id = serializers.IntegerField(required=False, default=None)
    message = serializers.CharField(max_length=5000)


class LearningSessionSerializer(serializers.ModelSerializer):
    messages = ChatMessageSerializer(source="chat_messages", many=True, read_only=True)

    class Meta:
        model = LearningSession
        fields = [
            "id", "project", "knode", "session_type",
            "started_at", "ended_at", "messages_count",
            "tokens_used", "messages",
        ]
