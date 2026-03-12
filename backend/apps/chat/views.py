from django.http import StreamingHttpResponse
from langchain_core.messages import AIMessage, HumanMessage
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from agents.graph import learning_graph
from agents.state import LearningState
from apps.projects.models import KnowledgeNode, Project

from .models import ChatMessage, LearningSession
from .serializers import (
    ChatMessageSerializer,
    LearningSessionSerializer,
    SendMessageSerializer,
)


class SendMessageView(APIView):
    """Send a message to the AI tutor and get a response."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = SendMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Validate project
        try:
            project = Project.objects.get(pk=data["project_id"], is_published=True)
        except Project.DoesNotExist:
            return Response(
                {"detail": "Project not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Get or create session
        knode = None
        knode_title = project.title
        knode_summary = project.description
        if data.get("knode_id"):
            try:
                knode = KnowledgeNode.objects.get(pk=data["knode_id"])
                knode_title = knode.title
                knode_summary = knode.summary
            except KnowledgeNode.DoesNotExist:
                return Response(
                    {"detail": "Knowledge node not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )

        if data.get("session_id"):
            try:
                session = LearningSession.objects.get(
                    pk=data["session_id"], user=request.user,
                )
            except LearningSession.DoesNotExist:
                return Response(
                    {"detail": "Session not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )
        else:
            session = LearningSession.objects.create(
                user=request.user,
                project=project,
                knode=knode,
            )

        # Save user message
        ChatMessage.objects.create(
            session=session, role="user", content=data["message"],
        )

        # Build message history from session
        history = session.chat_messages.all()
        messages = []
        for msg in history:
            if msg.role == "user":
                messages.append(HumanMessage(content=msg.content))
            else:
                messages.append(AIMessage(content=msg.content))

        # Build state and invoke agent
        state: LearningState = {
            "user_id": request.user.pk,
            "project_id": project.pk,
            "knode_id": knode.pk if knode else 0,
            "user_age": request.user.age or 12,
            "knode_title": knode_title,
            "knode_summary": knode_summary,
            "messages": messages,
            "response": "",
        }

        result = learning_graph.invoke(state)

        # Save AI response
        ai_message = ChatMessage.objects.create(
            session=session, role="assistant", content=result["response"],
        )
        session.messages_count = session.chat_messages.count()
        session.save(update_fields=["messages_count"])

        return Response({
            "session_id": session.pk,
            "message": ChatMessageSerializer(ai_message).data,
        })


class SessionHistoryView(generics.RetrieveAPIView):
    """Get a learning session with all its messages."""

    serializer_class = LearningSessionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return LearningSession.objects.filter(
            user=self.request.user,
        ).prefetch_related("chat_messages")
