import pytest
from rest_framework import status

from apps.projects.models import KnowledgeNode, Milestone, Project

PROJECTS_URL = "/api/projects/"


@pytest.fixture
def project(db):
    return Project.objects.create(
        title="Train an Unsupervised Model",
        subtitle="Learn K-Means from scratch",
        description="Build a clustering model step by step.",
        category="ai",
        min_age=10,
        max_age=18,
        estimated_hours=20,
        is_published=True,
    )


@pytest.fixture
def unpublished_project(db):
    return Project.objects.create(
        title="Draft Project",
        description="Not ready yet.",
        is_published=False,
    )


@pytest.fixture
def milestone(project):
    return Milestone.objects.create(
        project=project,
        title="Understand Data",
        description="Learn what data is.",
        order=0,
        xp_reward=100,
    )


@pytest.fixture
def knode(project, milestone):
    return KnowledgeNode.objects.create(
        project=project,
        milestone=milestone,
        title="What is Data?",
        summary="Introduction to the concept of data.",
        difficulty_level=1,
        content_type="text",
        acceptance_type="quiz",
        estimated_minutes=10,
        xp_reward=20,
        order=0,
    )


class TestProjectList:
    def test_list_published_projects(self, api_client, project, unpublished_project):
        resp = api_client.get(PROJECTS_URL)
        assert resp.status_code == status.HTTP_200_OK
        titles = [p["title"] for p in resp.data]
        assert project.title in titles
        assert unpublished_project.title not in titles

    def test_filter_by_category(self, api_client, project):
        resp = api_client.get(PROJECTS_URL, {"category": "ai"})
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data) == 1
        assert resp.data[0]["category"] == "ai"

    def test_filter_by_nonexistent_category(self, api_client, project):
        resp = api_client.get(PROJECTS_URL, {"category": "xyz"})
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data) == 0

    def test_list_includes_milestone_count(self, api_client, project, milestone):
        resp = api_client.get(PROJECTS_URL)
        assert resp.data[0]["milestone_count"] == 1

    def test_list_no_auth_required(self, api_client, project):
        resp = api_client.get(PROJECTS_URL)
        assert resp.status_code == status.HTTP_200_OK


class TestProjectDetail:
    def test_get_project_with_milestones_and_knodes(self, api_client, project, milestone, knode):
        resp = api_client.get(f"{PROJECTS_URL}{project.pk}/")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["title"] == project.title
        assert len(resp.data["milestones"]) == 1
        assert resp.data["milestones"][0]["title"] == milestone.title
        assert len(resp.data["milestones"][0]["knodes"]) == 1
        assert resp.data["milestones"][0]["knodes"][0]["title"] == knode.title

    def test_unpublished_project_not_found(self, api_client, unpublished_project):
        resp = api_client.get(f"{PROJECTS_URL}{unpublished_project.pk}/")
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_detail_no_auth_required(self, api_client, project):
        resp = api_client.get(f"{PROJECTS_URL}{project.pk}/")
        assert resp.status_code == status.HTTP_200_OK


class TestKnowledgeNodeDetail:
    def test_get_knode_authenticated(self, auth_client, knode):
        resp = auth_client.get(f"{PROJECTS_URL}knodes/{knode.pk}/")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["title"] == knode.title
        assert resp.data["difficulty_level"] == 1
        assert resp.data["content_type"] == "text"

    def test_get_knode_unauthenticated(self, api_client, knode):
        resp = api_client.get(f"{PROJECTS_URL}knodes/{knode.pk}/")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_knode_prerequisites_field(self, auth_client, knode, project, milestone):
        prereq = KnowledgeNode.objects.create(
            project=project,
            milestone=milestone,
            title="Prerequisite Node",
            order=1,
        )
        knode.prerequisites.add(prereq)
        resp = auth_client.get(f"{PROJECTS_URL}knodes/{knode.pk}/")
        assert prereq.pk in resp.data["prerequisites"]


class TestModels:
    def test_project_str(self, project):
        assert str(project) == "Train an Unsupervised Model"

    def test_milestone_str(self, milestone):
        assert "Understand Data" in str(milestone)

    def test_knode_str(self, knode):
        assert str(knode) == "What is Data?"

    def test_milestone_ordering(self, project):
        m2 = Milestone.objects.create(project=project, title="M2", order=1)
        m0 = Milestone.objects.create(project=project, title="M0 extra", order=2)
        milestones = list(project.milestones.values_list("order", flat=True))
        assert milestones == sorted(milestones)
