from .models import UserNodeProgress, UserProjectEnrollment


def enroll_user_in_project(user, project) -> UserProjectEnrollment:
    """Create enrollment and initialize all node progress records.

    Reusable by both the enroll endpoint and the fork flow.
    Raises ValueError if already enrolled.
    """
    enrollment, created = UserProjectEnrollment.objects.get_or_create(
        user=user,
        project=project,
        defaults={"status": "active"},
    )
    if not created:
        raise ValueError("Already enrolled.")

    # Initialize node progress for all knodes in the project
    knodes = project.knodes.all()
    first_milestone = project.milestones.order_by("order").first()
    progresses = []
    for knode in knodes:
        # Unlock first milestone's knodes with no prerequisites
        node_status = "locked"
        if first_milestone and knode.milestone == first_milestone and not knode.prerequisites.exists():
            node_status = "available"
        progresses.append(
            UserNodeProgress(
                user=user,
                knode=knode,
                status=node_status,
            )
        )
    UserNodeProgress.objects.bulk_create(progresses)

    return enrollment
