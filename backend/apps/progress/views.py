from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.projects.models import Project

from .models import UserAchievement, UserNodeProgress, UserProjectEnrollment
from .serializers import (
    EnrollmentSerializer,
    NodeProgressSerializer,
    UserAchievementSerializer,
)


class EnrollProjectView(APIView):
    """Enroll the current user in a project."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, project_id):
        try:
            project = Project.objects.get(pk=project_id, is_published=True)
        except Project.DoesNotExist:
            return Response(
                {"detail": "Project not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        enrollment, created = UserProjectEnrollment.objects.get_or_create(
            user=request.user,
            project=project,
            defaults={"status": "active"},
        )
        if not created:
            return Response(
                {"detail": "Already enrolled."},
                status=status.HTTP_409_CONFLICT,
            )

        # Initialize node progress for all knodes in the project
        knodes = project.knodes.all()
        first_milestone = project.milestones.order_by("order").first()
        progresses = []
        for knode in knodes:
            # Unlock first milestone's knodes with no prerequisites
            node_status = "locked"
            if knode.milestone == first_milestone and not knode.prerequisites.exists():
                node_status = "available"
            progresses.append(
                UserNodeProgress(
                    user=request.user,
                    knode=knode,
                    status=node_status,
                )
            )
        UserNodeProgress.objects.bulk_create(progresses)

        return Response(
            EnrollmentSerializer(enrollment).data,
            status=status.HTTP_201_CREATED,
        )


class MyEnrollmentsView(generics.ListAPIView):
    """List current user's project enrollments."""

    serializer_class = EnrollmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return UserProjectEnrollment.objects.filter(
            user=self.request.user
        ).select_related("project")


class ProjectProgressView(generics.ListAPIView):
    """List user's node progress for a specific project."""

    serializer_class = NodeProgressSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return UserNodeProgress.objects.filter(
            user=self.request.user,
            knode__project_id=self.kwargs["project_id"],
        ).select_related("knode")


class MyAchievementsView(generics.ListAPIView):
    """List current user's achievements."""

    serializer_class = UserAchievementSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return UserAchievement.objects.filter(
            user=self.request.user
        ).select_related("achievement")
