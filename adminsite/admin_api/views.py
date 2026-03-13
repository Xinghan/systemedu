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
from .models import GenerationTask
from .serializers import (
    CloneProjectSerializer,
    GenerateTreeSerializer,
    ImportKnowledgeTreeSerializer,
    ProjectCreateUpdateSerializer,
    ProjectDetailSerializer,
    ProjectListSerializer,
)
from .tasks import run_generate_task


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
    """Kick off async AI knowledge tree generation. Returns 202 with task_id."""

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

        task = GenerationTask.objects.create(
            project=project,
            created_by=request.user,
            granularity=granularity,
            instructions=instructions,
        )

        run_generate_task(str(task.id))

        return Response(
            {"task_id": str(task.id), "status": task.status},
            status=status.HTTP_202_ACCEPTED,
        )


class GenerationTaskStatusView(APIView):
    """Poll the status of an async generation task."""

    permission_classes = [IsAdminUser]

    def get(self, request, task_id):
        try:
            task = GenerationTask.objects.get(pk=task_id)
        except GenerationTask.DoesNotExist:
            return Response(
                {"detail": "Task not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        data = {
            "task_id": str(task.id),
            "status": task.status,
            "created_at": task.created_at.isoformat() if task.created_at else None,
            "started_at": task.started_at.isoformat() if task.started_at else None,
            "completed_at": task.completed_at.isoformat() if task.completed_at else None,
        }

        if task.status == GenerationTask.Status.COMPLETED:
            data["tree_data"] = task.result_json
            data["milestones_created"] = task.milestones_created
            data["knodes_created"] = task.knodes_created
        elif task.status == GenerationTask.Status.FAILED:
            data["error"] = task.error_message

        return Response(data)


class ActiveTasksListView(APIView):
    """List active (pending/running) generation tasks."""

    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = GenerationTask.objects.filter(
            status__in=[GenerationTask.Status.PENDING, GenerationTask.Status.RUNNING],
        ).select_related("project")

        project_id = request.query_params.get("project_id")
        if project_id:
            qs = qs.filter(project_id=project_id)

        tasks = [
            {
                "task_id": str(t.id),
                "status": t.status,
                "project_id": t.project_id,
                "project_title": t.project.title,
                "granularity": t.granularity,
                "created_at": t.created_at.isoformat() if t.created_at else None,
                "started_at": t.started_at.isoformat() if t.started_at else None,
            }
            for t in qs
        ]
        return Response(tasks)


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
