import pytest
from rest_framework import status

from apps.projects.models import KnowledgeNode, Milestone, Project
from apps.progress.models import (
    Achievement,
    UserAchievement,
    UserNodeProgress,
    UserProjectEnrollment,
)


@pytest.fixture
def project(db):
    return Project.objects.create(
        title="Test Project",
        description="A test project.",
        category="ai",
        is_published=True,
    )


@pytest.fixture
def milestone(project):
    return Milestone.objects.create(
        project=project, title="Milestone 1", order=0, xp_reward=100,
    )


@pytest.fixture
def knode(project, milestone):
    return KnowledgeNode.objects.create(
        project=project,
        milestone=milestone,
        title="Node 1",
        order=0,
        xp_reward=20,
    )


@pytest.fixture
def knode2(project, milestone, knode):
    """A second knode that requires knode as prerequisite."""
    node = KnowledgeNode.objects.create(
        project=project,
        milestone=milestone,
        title="Node 2",
        order=1,
        xp_reward=30,
    )
    node.prerequisites.add(knode)
    return node


@pytest.fixture
def achievement(db):
    return Achievement.objects.create(
        title="First Steps",
        description="Complete your first knowledge node.",
        criteria_type="nodes_completed",
        criteria_value=1,
    )


class TestEnroll:
    def test_enroll_success(self, auth_client, user, project, milestone, knode, knode2):
        resp = auth_client.post(f"/api/progress/enroll/{project.pk}/")
        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data["status"] == "active"
        assert resp.data["project"] == project.pk

        # Check enrollment created
        assert UserProjectEnrollment.objects.filter(user=user, project=project).exists()

        # Check node progress initialized
        progresses = UserNodeProgress.objects.filter(user=user)
        assert progresses.count() == 2

        # First node (no prereqs) should be available
        p1 = progresses.get(knode=knode)
        assert p1.status == "available"

        # Second node (has prereq) should be locked
        p2 = progresses.get(knode=knode2)
        assert p2.status == "locked"

    def test_enroll_duplicate(self, auth_client, user, project, milestone, knode):
        auth_client.post(f"/api/progress/enroll/{project.pk}/")
        resp = auth_client.post(f"/api/progress/enroll/{project.pk}/")
        assert resp.status_code == status.HTTP_409_CONFLICT

    def test_enroll_nonexistent_project(self, auth_client):
        resp = auth_client.post("/api/progress/enroll/9999/")
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_enroll_unauthenticated(self, api_client, project):
        resp = api_client.post(f"/api/progress/enroll/{project.pk}/")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


class TestMyEnrollments:
    def test_list_enrollments(self, auth_client, user, project):
        UserProjectEnrollment.objects.create(user=user, project=project, status="active")
        resp = auth_client.get("/api/progress/enrollments/")
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data) == 1
        assert resp.data[0]["project_title"] == project.title

    def test_list_enrollments_empty(self, auth_client):
        resp = auth_client.get("/api/progress/enrollments/")
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data) == 0

    def test_enrollments_unauthenticated(self, api_client):
        resp = api_client.get("/api/progress/enrollments/")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


class TestProjectProgress:
    def test_get_project_progress(self, auth_client, user, project, knode):
        UserNodeProgress.objects.create(user=user, knode=knode, status="available")
        resp = auth_client.get(f"/api/progress/projects/{project.pk}/")
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data) == 1
        assert resp.data[0]["knode_title"] == knode.title
        assert resp.data[0]["status"] == "available"

    def test_progress_only_own_data(self, auth_client, user, project, knode, db):
        """Other users' progress should not appear."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        other = User.objects.create_user(username="other", password="pass123")
        UserNodeProgress.objects.create(user=other, knode=knode, status="passed")
        resp = auth_client.get(f"/api/progress/projects/{project.pk}/")
        assert len(resp.data) == 0


class TestAchievements:
    def test_list_achievements(self, auth_client, user, achievement):
        UserAchievement.objects.create(user=user, achievement=achievement)
        resp = auth_client.get("/api/progress/achievements/")
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data) == 1
        assert resp.data[0]["achievement"]["title"] == "First Steps"

    def test_achievements_empty(self, auth_client):
        resp = auth_client.get("/api/progress/achievements/")
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data) == 0


class TestModels:
    def test_enrollment_str(self, user, project, db):
        e = UserProjectEnrollment.objects.create(user=user, project=project)
        assert "exploring" in str(e)

    def test_node_progress_str(self, user, knode, db):
        p = UserNodeProgress.objects.create(user=user, knode=knode, status="available")
        assert "available" in str(p)

    def test_achievement_str(self, achievement):
        assert str(achievement) == "First Steps"

    def test_user_achievement_str(self, user, achievement, db):
        ua = UserAchievement.objects.create(user=user, achievement=achievement)
        assert "First Steps" in str(ua)
