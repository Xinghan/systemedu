from rest_framework import generics, status
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.projects.models import Project
from apps.projects.services import (
    KnowledgeTreeValidationError,
    clone_project,
    export_knowledge_tree,
    get_tree_graph,
    save_knowledge_tree,
)

from .permissions import IsAdminUser
from .serializers import (
    CloneProjectSerializer,
    GenerateTreeSerializer,
    ImportKnowledgeTreeSerializer,
    ProjectCreateUpdateSerializer,
    ProjectDetailSerializer,
    ProjectListSerializer,
)
from .services import generate_knowledge_tree


class AdminLoginView(TokenObtainPairView):
    """JWT login for admin users. Rejects non-staff users."""

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            # Verify the user is staff
            from django.contrib.auth import get_user_model
            User = get_user_model()
            try:
                user = User.objects.get(username=request.data.get("username"))
                if not user.is_staff:
                    return Response(
                        {"detail": "Admin access required."},
                        status=status.HTTP_403_FORBIDDEN,
                    )
            except User.DoesNotExist:
                pass
        return response


class AdminRefreshView(TokenRefreshView):
    pass


class ProjectListCreateView(generics.ListCreateAPIView):
    """List all projects / create a new project."""

    permission_classes = [IsAdminUser]
    queryset = Project.objects.all()

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ProjectCreateUpdateSerializer
        return ProjectListSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ProjectDetailUpdateDeleteView(generics.RetrieveUpdateDestroyAPIView):
    """Get / update / delete a project."""

    permission_classes = [IsAdminUser]
    queryset = Project.objects.prefetch_related("milestones__knodes")

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return ProjectCreateUpdateSerializer
        return ProjectDetailSerializer


class ImportKnowledgeTreeView(APIView):
    """Import a knowledge tree JSON for a project."""

    permission_classes = [IsAdminUser]
    parser_classes = [JSONParser, MultiPartParser]

    def post(self, request, pk):
        try:
            project = Project.objects.get(pk=pk)
        except Project.DoesNotExist:
            return Response(
                {"detail": "Project not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = ImportKnowledgeTreeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tree_data = serializer.validated_data["tree_data"]
        replace = serializer.validated_data["replace"]

        # Check for existing tree if not replacing
        if not replace and project.milestones.exists():
            return Response(
                {"detail": "Knowledge tree already exists. Use 'replace': true to overwrite."},
                status=status.HTTP_409_CONFLICT,
            )

        try:
            result = save_knowledge_tree(project, tree_data, replace=replace)
        except KnowledgeTreeValidationError as e:
            return Response(
                {"detail": "Validation failed.", "errors": e.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "project_id": project.pk,
                "milestones_created": result["milestones_created"],
                "knodes_created": result["knodes_created"],
            },
            status=status.HTTP_201_CREATED,
        )


class TreePreviewView(APIView):
    """Return graph data (nodes + edges) for knowledge tree visualization."""

    permission_classes = [IsAdminUser]

    def get(self, request, pk):
        try:
            project = Project.objects.get(pk=pk)
        except Project.DoesNotExist:
            return Response(
                {"detail": "Project not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        graph = get_tree_graph(project)
        return Response(graph)


class ExportKnowledgeTreeView(APIView):
    """Export a project's knowledge tree as importable JSON."""

    permission_classes = [IsAdminUser]

    def get(self, request, pk):
        try:
            project = Project.objects.get(pk=pk)
        except Project.DoesNotExist:
            return Response(
                {"detail": "Project not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not project.milestones.exists():
            return Response(
                {"detail": "Project has no knowledge tree to export."},
                status=status.HTTP_404_NOT_FOUND,
            )

        tree_data = export_knowledge_tree(project)
        return Response(tree_data)


class GenerateKnowledgeTreeView(APIView):
    """Use AI (Qwen) to generate a knowledge tree JSON for a project."""

    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        try:
            project = Project.objects.get(pk=pk)
        except Project.DoesNotExist:
            return Response(
                {"detail": "Project not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = GenerateTreeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        granularity = serializer.validated_data["granularity"]
        instructions = serializer.validated_data["instructions"]

        try:
            tree_data = generate_knowledge_tree(
                project,
                granularity=granularity,
                instructions=instructions,
            )
        except ValueError as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            error_type = type(e).__name__
            return Response(
                {"detail": f"AI generation failed: {error_type}: {e}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response({"tree_data": tree_data})


class CloneProjectView(APIView):
    """Clone a project (typically a template) with its full knowledge tree."""

    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        try:
            source = Project.objects.get(pk=pk)
        except Project.DoesNotExist:
            return Response(
                {"detail": "Project not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = CloneProjectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_title = serializer.validated_data.get("new_title")
        new_project = clone_project(
            source,
            new_title=new_title,
            created_by=request.user,
        )

        return Response(
            ProjectDetailSerializer(new_project).data,
            status=status.HTTP_201_CREATED,
        )
