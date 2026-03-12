from rest_framework import generics, permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

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


class GenerateTreeSerializer(serializers.Serializer):
    user_age = serializers.IntegerField(default=12, min_value=6, max_value=18)


class GenerateKnowledgeTreeView(APIView):
    """Use AI Planner Agent to auto-generate a knowledge tree for a project."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            project = Project.objects.get(pk=pk)
        except Project.DoesNotExist:
            return Response(
                {"detail": "Project not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Don't regenerate if tree already exists
        if project.milestones.exists():
            return Response(
                {"detail": "Knowledge tree already exists. Delete existing tree first."},
                status=status.HTTP_409_CONFLICT,
            )

        ser = GenerateTreeSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user_age = ser.validated_data["user_age"]

        from agents.planner import generate_knowledge_tree, save_knowledge_tree

        tree_data = generate_knowledge_tree(
            project_title=project.title,
            project_description=project.description,
            user_age=user_age,
        )
        result = save_knowledge_tree(project, tree_data)

        return Response({
            "project_id": project.pk,
            "milestones_created": result["milestones_created"],
            "knodes_created": result["knodes_created"],
        }, status=status.HTTP_201_CREATED)
