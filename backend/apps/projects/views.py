from django.db.models import Count, Q
from rest_framework import generics, permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.progress.services import enroll_user_in_project

from .models import KnowledgeNode, Project
from .serializers import (
    KnowledgeNodeSerializer,
    MyProjectSerializer,
    ProjectDetailSerializer,
    ProjectListSerializer,
)
from .services import clone_project


class ProjectListView(generics.ListAPIView):
    """List published projects, with optional category filter."""

    serializer_class = ProjectListSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = Project.objects.filter(is_published=True).annotate(
            fork_count=Count("forks"),
        )
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category=category)
        return qs


class ProjectDetailView(generics.RetrieveAPIView):
    """Retrieve a single project with its milestones and knowledge nodes."""

    serializer_class = ProjectDetailSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = Project.objects.prefetch_related("milestones__knodes").annotate(
            fork_count=Count("forks"),
        )
        if self.request.user.is_authenticated:
            return qs.filter(Q(is_published=True) | Q(created_by=self.request.user))
        return qs.filter(is_published=True)


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


class ForkProjectView(APIView):
    """Deep-copy a published project into the user's space and auto-enroll."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            project = Project.objects.get(pk=pk, is_published=True)
        except Project.DoesNotExist:
            return Response(
                {"detail": "Project not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Check if already forked
        existing = Project.objects.filter(
            created_by=request.user, forked_from=project,
        ).first()
        if existing:
            return Response(
                {"detail": "Already forked.", "forked_project_id": existing.pk},
                status=status.HTTP_409_CONFLICT,
            )

        forked = clone_project(
            project,
            new_title=project.title,
            created_by=request.user,
            forked_from=project,
        )

        # Auto-enroll
        enroll_user_in_project(request.user, forked)

        return Response(
            ProjectDetailSerializer(forked).data,
            status=status.HTTP_201_CREATED,
        )


class CheckForkView(APIView):
    """Check if the current user has already forked a project."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        forked = Project.objects.filter(
            created_by=request.user, forked_from_id=pk,
        ).first()
        return Response({
            "forked": forked is not None,
            "forked_project_id": forked.pk if forked else None,
        })


class MyProjectsView(generics.ListAPIView):
    """List the current user's forked projects with progress info."""

    serializer_class = MyProjectSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return (
            Project.objects.filter(created_by=user, forked_from__isnull=False)
            .select_related("forked_from")
            .annotate(
                total_knodes_count=Count("knodes"),
                passed_knodes_count=Count(
                    "knodes__user_progress",
                    filter=Q(
                        knodes__user_progress__user=user,
                        knodes__user_progress__status="passed",
                    ),
                ),
            )
        )


class ProgressSummaryView(APIView):
    """Progress summary for a single project."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        from apps.progress.models import UserNodeProgress, UserProjectEnrollment

        try:
            enrollment = UserProjectEnrollment.objects.get(
                user=request.user, project_id=pk,
            )
        except UserProjectEnrollment.DoesNotExist:
            return Response({
                "enrolled": False,
                "status": None,
                "total_knodes": 0,
                "passed_knodes": 0,
                "progress_percent": 0,
                "total_xp_earned": 0,
            })

        total = UserNodeProgress.objects.filter(
            user=request.user, knode__project_id=pk,
        ).count()
        passed = UserNodeProgress.objects.filter(
            user=request.user, knode__project_id=pk, status="passed",
        ).count()

        return Response({
            "enrolled": True,
            "status": enrollment.status,
            "total_knodes": total,
            "passed_knodes": passed,
            "progress_percent": round(passed / total * 100) if total else 0,
            "total_xp_earned": enrollment.total_xp_earned,
        })
