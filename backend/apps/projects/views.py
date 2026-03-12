from rest_framework import generics, permissions

from .models import KnowledgeNode, Project
from .serializers import (
    KnowledgeNodeSerializer,
    ProjectDetailSerializer,
    ProjectListSerializer,
)


class ProjectListView(generics.ListAPIView):
    """List published projects, with optional category filter."""

    serializer_class = ProjectListSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = Project.objects.filter(is_published=True)
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category=category)
        return qs


class ProjectDetailView(generics.RetrieveAPIView):
    """Retrieve a single project with its milestones and knowledge nodes."""

    serializer_class = ProjectDetailSerializer
    permission_classes = [permissions.AllowAny]
    queryset = Project.objects.filter(is_published=True).prefetch_related(
        "milestones__knodes",
    )


class KnowledgeNodeDetailView(generics.RetrieveAPIView):
    """Retrieve a single knowledge node."""

    serializer_class = KnowledgeNodeSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = KnowledgeNode.objects.all()
