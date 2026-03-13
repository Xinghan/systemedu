import io
import json

import pytest
from rest_framework import status

from apps.projects.models import KnowledgeNode, Milestone, Project

PROJECTS_URL = "/api/admin/projects/"
LOGIN_URL = "/api/admin/auth/login/"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def project(db):
    return Project.objects.create(
        title="Test Project",
        description="A test project for admin.",
        category="ai",
        min_age=10,
        max_age=18,
        estimated_hours=20,
        is_published=False,
    )


@pytest.fixture
def project_with_tree(project):
    """Project that already has milestones/knodes."""
    ms = Milestone.objects.create(
        project=project, title="Existing Milestone", order=0, xp_reward=100,
    )
    KnowledgeNode.objects.create(
        project=project, milestone=ms, title="Existing Node", order=0,
    )
    return project


def _make_tree(num_milestones=1, knodes_per_ms=2, prereqs=None):
    """Build a valid tree_data dict."""
    milestones = []
    global_idx = 0
    for ms_i in range(num_milestones):
        knodes = []
        for kn_i in range(knodes_per_ms):
            knode = {
                "title": f"Node {global_idx}",
                "summary": f"Summary for node {global_idx}",
                "difficulty_level": min(global_idx + 1, 10),
                "content_type": "text",
                "acceptance_type": "quiz",
                "estimated_minutes": 15,
                "xp_reward": 20,
                "order": kn_i,
                "prerequisite_indices": (prereqs or {}).get(global_idx, []),
            }
            knodes.append(knode)
            global_idx += 1
        milestones.append({
            "title": f"Milestone {ms_i}",
            "description": f"Desc {ms_i}",
            "order": ms_i,
            "knodes": knodes,
        })
    return {"milestones": milestones}


# ===========================================================================
# Auth Tests
# ===========================================================================

class TestAdminAuth:
    def test_admin_login_success(self, api_client, admin_user):
        resp = api_client.post(
            LOGIN_URL,
            {"username": "adminuser", "password": "adminpass123"},
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK
        assert "access" in resp.data
        assert "refresh" in resp.data

    def test_regular_user_login_rejected(self, api_client, regular_user):
        resp = api_client.post(
            LOGIN_URL,
            {"username": "regularuser", "password": "regularpass123"},
            format="json",
        )
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_unauthenticated_access_rejected(self, api_client, project):
        resp = api_client.get(PROJECTS_URL)
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


# ===========================================================================
# Project CRUD Tests
# ===========================================================================

class TestProjectCRUD:
    def test_list_projects(self, admin_client, project):
        resp = admin_client.get(PROJECTS_URL)
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data) >= 1

    def test_create_project(self, admin_client):
        resp = admin_client.post(PROJECTS_URL, {
            "title": "New Project",
            "description": "Test description",
            "category": "biotech",
            "min_age": 8,
            "max_age": 16,
            "estimated_hours": 15,
        }, format="json")
        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data["title"] == "New Project"
        assert Project.objects.filter(title="New Project").exists()

    def test_update_project(self, admin_client, project):
        resp = admin_client.put(
            f"{PROJECTS_URL}{project.pk}/",
            {
                "title": "Updated Title",
                "description": "Updated desc",
                "category": "ai",
                "min_age": 10,
                "max_age": 18,
                "estimated_hours": 25,
            },
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK
        project.refresh_from_db()
        assert project.title == "Updated Title"

    def test_delete_project(self, admin_client, project):
        resp = admin_client.delete(f"{PROJECTS_URL}{project.pk}/")
        assert resp.status_code == status.HTTP_204_NO_CONTENT
        assert not Project.objects.filter(pk=project.pk).exists()

    def test_regular_user_cannot_list(self, regular_client, project):
        resp = regular_client.get(PROJECTS_URL)
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_get_project_detail(self, admin_client, project_with_tree):
        resp = admin_client.get(f"{PROJECTS_URL}{project_with_tree.pk}/")
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data["milestones"]) == 1
        assert len(resp.data["milestones"][0]["knodes"]) == 1


# ===========================================================================
# Knowledge Tree Import Tests
# ===========================================================================

class TestImportKnowledgeTree:
    def test_import_success(self, admin_client, project):
        tree = _make_tree(2, 3, prereqs={3: [0, 1]})
        resp = admin_client.post(
            f"{PROJECTS_URL}{project.pk}/import-tree/",
            {"tree_data": tree, "replace": False},
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data["milestones_created"] == 2
        assert resp.data["knodes_created"] == 6

    def test_import_via_file_upload(self, admin_client, project):
        tree = _make_tree(1, 2)
        json_bytes = json.dumps(tree).encode("utf-8")
        file = io.BytesIO(json_bytes)
        file.name = "tree.json"
        resp = admin_client.post(
            f"{PROJECTS_URL}{project.pk}/import-tree/",
            {"file": file, "replace": "false"},
            format="multipart",
        )
        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data["knodes_created"] == 2

    def test_import_validation_error(self, admin_client, project):
        bad_tree = {
            "milestones": [{
                "title": "M1",
                "order": 0,
                "knodes": [{
                    "title": "N1",
                    "content_type": "INVALID",
                    "order": 0,
                }],
            }],
        }
        resp = admin_client.post(
            f"{PROJECTS_URL}{project.pk}/import-tree/",
            {"tree_data": bad_tree},
            format="json",
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert "errors" in resp.data

    def test_import_cycle_detection(self, admin_client, project):
        tree = _make_tree(1, 2, prereqs={0: [1], 1: [0]})
        resp = admin_client.post(
            f"{PROJECTS_URL}{project.pk}/import-tree/",
            {"tree_data": tree},
            format="json",
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert any("cycle" in e for e in resp.data["errors"])

    def test_import_conflict_existing_tree(self, admin_client, project_with_tree):
        tree = _make_tree(1, 2)
        resp = admin_client.post(
            f"{PROJECTS_URL}{project_with_tree.pk}/import-tree/",
            {"tree_data": tree, "replace": False},
            format="json",
        )
        assert resp.status_code == status.HTTP_409_CONFLICT

    def test_import_replace_mode(self, admin_client, project_with_tree):
        tree = _make_tree(2, 3)
        resp = admin_client.post(
            f"{PROJECTS_URL}{project_with_tree.pk}/import-tree/",
            {"tree_data": tree, "replace": True},
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data["milestones_created"] == 2
        assert resp.data["knodes_created"] == 6
        # Old data replaced
        assert Milestone.objects.filter(project=project_with_tree).count() == 2

    def test_import_many_nodes(self, admin_client, project):
        tree = _make_tree(5, 20)
        resp = admin_client.post(
            f"{PROJECTS_URL}{project.pk}/import-tree/",
            {"tree_data": tree},
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data["knodes_created"] == 100

    def test_import_transaction_rollback(self, admin_client, project):
        """If save fails, the response is an error and no partial data persists."""
        # Create a milestone at order=0 to cause unique constraint violation
        Milestone.objects.create(project=project, title="Existing", order=0, xp_reward=10)
        tree = _make_tree(1, 2)  # tree has milestone at order=0 too
        resp = admin_client.post(
            f"{PROJECTS_URL}{project.pk}/import-tree/",
            {"tree_data": tree},
            format="json",
        )
        # Should fail due to unique constraint
        assert resp.status_code in (
            status.HTTP_400_BAD_REQUEST,
            status.HTTP_409_CONFLICT,
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
        # Original milestone should still exist, no new knodes
        assert Milestone.objects.filter(project=project).count() == 1

    def test_import_project_not_found(self, admin_client):
        tree = _make_tree()
        resp = admin_client.post(
            f"{PROJECTS_URL}99999/import-tree/",
            {"tree_data": tree},
            format="json",
        )
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_import_permission_denied(self, regular_client, project):
        tree = _make_tree()
        resp = regular_client.post(
            f"{PROJECTS_URL}{project.pk}/import-tree/",
            {"tree_data": tree},
            format="json",
        )
        assert resp.status_code == status.HTTP_403_FORBIDDEN


# ===========================================================================
# Tree Preview Tests
# ===========================================================================

class TestTreePreview:
    def test_preview_returns_graph(self, admin_client, project):
        tree = _make_tree(2, 2, prereqs={2: [0], 3: [1]})
        admin_client.post(
            f"{PROJECTS_URL}{project.pk}/import-tree/",
            {"tree_data": tree},
            format="json",
        )
        resp = admin_client.get(f"{PROJECTS_URL}{project.pk}/tree-preview/")
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data["nodes"]) == 4
        assert len(resp.data["edges"]) == 2
        node = resp.data["nodes"][0]
        assert "id" in node
        assert "title" in node
        assert "milestone_title" in node

    def test_preview_empty_project(self, admin_client, project):
        resp = admin_client.get(f"{PROJECTS_URL}{project.pk}/tree-preview/")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data == {"nodes": [], "edges": []}

    def test_preview_not_found(self, admin_client):
        resp = admin_client.get(f"{PROJECTS_URL}99999/tree-preview/")
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_preview_permission_denied(self, regular_client, project):
        resp = regular_client.get(f"{PROJECTS_URL}{project.pk}/tree-preview/")
        assert resp.status_code == status.HTTP_403_FORBIDDEN


# ===========================================================================
# Tree Export Tests
# ===========================================================================

class TestExportTree:
    def test_export_success(self, admin_client, project):
        tree = _make_tree(2, 3, prereqs={3: [0, 1]})
        admin_client.post(
            f"{PROJECTS_URL}{project.pk}/import-tree/",
            {"tree_data": tree},
            format="json",
        )
        resp = admin_client.get(f"{PROJECTS_URL}{project.pk}/export-tree/")
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data["milestones"]) == 2
        total_knodes = sum(len(m["knodes"]) for m in resp.data["milestones"])
        assert total_knodes == 6

    def test_export_preserves_prerequisites(self, admin_client, project):
        tree = _make_tree(1, 3, prereqs={2: [0, 1]})
        admin_client.post(
            f"{PROJECTS_URL}{project.pk}/import-tree/",
            {"tree_data": tree},
            format="json",
        )
        resp = admin_client.get(f"{PROJECTS_URL}{project.pk}/export-tree/")
        assert resp.status_code == status.HTTP_200_OK
        node2 = resp.data["milestones"][0]["knodes"][2]
        assert sorted(node2["prerequisite_indices"]) == [0, 1]

    def test_export_empty_project(self, admin_client, project):
        resp = admin_client.get(f"{PROJECTS_URL}{project.pk}/export-tree/")
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_export_roundtrip(self, admin_client, project):
        """Exported JSON can be re-imported into another project."""
        tree = _make_tree(2, 2)
        admin_client.post(
            f"{PROJECTS_URL}{project.pk}/import-tree/",
            {"tree_data": tree},
            format="json",
        )
        resp = admin_client.get(f"{PROJECTS_URL}{project.pk}/export-tree/")
        exported = resp.data

        # Create a second project and import the exported data
        resp2 = admin_client.post(PROJECTS_URL, {
            "title": "Import Target",
            "description": "Will receive exported tree",
        }, format="json")
        target_pk = resp2.data["id"]

        resp3 = admin_client.post(
            f"{PROJECTS_URL}{target_pk}/import-tree/",
            {"tree_data": exported},
            format="json",
        )
        assert resp3.status_code == status.HTTP_201_CREATED
        assert resp3.data["knodes_created"] == 4

    def test_export_not_found(self, admin_client):
        resp = admin_client.get(f"{PROJECTS_URL}99999/export-tree/")
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_export_permission_denied(self, regular_client, project_with_tree):
        resp = regular_client.get(f"{PROJECTS_URL}{project_with_tree.pk}/export-tree/")
        assert resp.status_code == status.HTTP_403_FORBIDDEN


# ===========================================================================
# Clone Project Tests
# ===========================================================================

class TestCloneProject:
    def test_clone_with_tree(self, admin_client, project):
        tree = _make_tree(2, 3, prereqs={3: [0]})
        admin_client.post(
            f"{PROJECTS_URL}{project.pk}/import-tree/",
            {"tree_data": tree},
            format="json",
        )
        resp = admin_client.post(
            f"{PROJECTS_URL}{project.pk}/clone/",
            {"new_title": "Cloned Project"},
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data["title"] == "Cloned Project"
        assert resp.data["is_published"] is False
        assert len(resp.data["milestones"]) == 2

    def test_clone_default_title(self, admin_client, project):
        resp = admin_client.post(
            f"{PROJECTS_URL}{project.pk}/clone/",
            {},
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data["title"] == f"{project.title} (Copy)"

    def test_clone_empty_project(self, admin_client, project):
        resp = admin_client.post(
            f"{PROJECTS_URL}{project.pk}/clone/",
            {"new_title": "Empty Clone"},
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data["milestones"] == []

    def test_clone_not_found(self, admin_client):
        resp = admin_client.post(
            f"{PROJECTS_URL}99999/clone/",
            {},
            format="json",
        )
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_clone_permission_denied(self, regular_client, project):
        resp = regular_client.post(
            f"{PROJECTS_URL}{project.pk}/clone/",
            {},
            format="json",
        )
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_clone_preserves_category(self, admin_client, project):
        resp = admin_client.post(
            f"{PROJECTS_URL}{project.pk}/clone/",
            {"new_title": "Cat Clone"},
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data["category"] == project.category
