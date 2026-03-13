import pytest
from rest_framework import status

from apps.projects.models import KnowledgeNode, Milestone, Project
from apps.projects.services import (
    KnowledgeTreeValidationError,
    clone_project,
    export_knowledge_tree,
    get_tree_graph,
    save_knowledge_tree,
    validate_knowledge_tree,
)

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


# ---------------------------------------------------------------------------
# Helper: minimal valid tree data
# ---------------------------------------------------------------------------

def _make_tree(num_milestones=1, knodes_per_ms=2, prereqs=None):
    """Build a valid tree_data dict for testing."""
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


class TestValidateKnowledgeTree:
    def test_valid_tree(self):
        tree = _make_tree(2, 3, prereqs={3: [0, 1]})
        errors = validate_knowledge_tree(tree)
        assert errors == []

    def test_not_a_dict(self):
        errors = validate_knowledge_tree("bad")
        assert "tree_data must be a dict" in errors[0]

    def test_milestones_missing(self):
        errors = validate_knowledge_tree({})
        assert any("milestones" in e for e in errors)

    def test_milestones_empty(self):
        errors = validate_knowledge_tree({"milestones": []})
        assert any("non-empty" in e for e in errors)

    def test_missing_knode_title(self):
        tree = _make_tree()
        del tree["milestones"][0]["knodes"][0]["title"]
        errors = validate_knowledge_tree(tree)
        assert any("title" in e for e in errors)

    def test_invalid_content_type(self):
        tree = _make_tree()
        tree["milestones"][0]["knodes"][0]["content_type"] = "podcast"
        errors = validate_knowledge_tree(tree)
        assert any("content_type" in e for e in errors)

    def test_invalid_acceptance_type(self):
        tree = _make_tree()
        tree["milestones"][0]["knodes"][0]["acceptance_type"] = "magic"
        errors = validate_knowledge_tree(tree)
        assert any("acceptance_type" in e for e in errors)

    def test_difficulty_out_of_range(self):
        tree = _make_tree()
        tree["milestones"][0]["knodes"][0]["difficulty_level"] = 11
        errors = validate_knowledge_tree(tree)
        assert any("difficulty_level" in e for e in errors)

    def test_prerequisite_self_reference(self):
        tree = _make_tree(1, 2, prereqs={0: [0]})
        errors = validate_knowledge_tree(tree)
        assert any("self-reference" in e for e in errors)

    def test_prerequisite_out_of_bounds(self):
        tree = _make_tree(1, 2, prereqs={1: [99]})
        errors = validate_knowledge_tree(tree)
        assert any("out of bounds" in e for e in errors)

    def test_cycle_detection(self):
        # 0 -> 1 -> 0: cycle
        tree = _make_tree(1, 2, prereqs={0: [1], 1: [0]})
        errors = validate_knowledge_tree(tree)
        assert any("cycle" in e for e in errors)

    def test_larger_cycle_detection(self):
        # 0 -> 1 -> 2 -> 0
        tree = _make_tree(1, 3, prereqs={0: [2], 1: [0], 2: [1]})
        errors = validate_knowledge_tree(tree)
        assert any("cycle" in e for e in errors)


class TestSaveKnowledgeTree:
    def test_normal_import(self, project):
        tree = _make_tree(2, 3, prereqs={3: [0, 1], 5: [2]})
        result = save_knowledge_tree(project, tree)
        assert result["milestones_created"] == 2
        assert result["knodes_created"] == 6
        assert Milestone.objects.filter(project=project).count() == 2
        assert KnowledgeNode.objects.filter(project=project).count() == 6

    def test_prerequisites_set(self, project):
        tree = _make_tree(1, 3, prereqs={2: [0, 1]})
        save_knowledge_tree(project, tree)
        knodes = list(KnowledgeNode.objects.filter(project=project).order_by("pk"))
        assert knodes[2].prerequisites.count() == 2
        prereq_pks = set(knodes[2].prerequisites.values_list("pk", flat=True))
        assert prereq_pks == {knodes[0].pk, knodes[1].pk}

    def test_validation_errors_raise(self, project):
        bad_tree = {"milestones": []}
        with pytest.raises(KnowledgeTreeValidationError) as exc_info:
            save_knowledge_tree(project, bad_tree)
        assert len(exc_info.value.errors) > 0

    def test_replace_mode(self, project):
        tree1 = _make_tree(1, 2)
        save_knowledge_tree(project, tree1)
        assert KnowledgeNode.objects.filter(project=project).count() == 2

        tree2 = _make_tree(2, 3)
        result = save_knowledge_tree(project, tree2, replace=True)
        assert result["milestones_created"] == 2
        assert result["knodes_created"] == 6
        # Old nodes removed
        assert KnowledgeNode.objects.filter(project=project).count() == 6

    def test_transaction_rollback_on_error(self, project):
        """If save fails mid-way, nothing should be committed."""
        tree = _make_tree(1, 2)
        # Manually cause a unique constraint violation on milestone order
        Milestone.objects.create(project=project, title="Existing", order=0, xp_reward=10)
        with pytest.raises(Exception):
            save_knowledge_tree(project, tree)
        # The existing milestone should still be there, no new knodes
        assert Milestone.objects.filter(project=project).count() == 1
        assert KnowledgeNode.objects.filter(project=project).count() == 0

    def test_skip_validation(self, project):
        tree = _make_tree(1, 2)
        result = save_knowledge_tree(project, tree, validate=False)
        assert result["knodes_created"] == 2

    def test_bulk_import_many_nodes(self, project):
        """Test importing a large tree (100 nodes)."""
        tree = _make_tree(5, 20)
        result = save_knowledge_tree(project, tree)
        assert result["milestones_created"] == 5
        assert result["knodes_created"] == 100


class TestExportKnowledgeTree:
    def test_export_roundtrip(self, project):
        """Export should produce JSON that can be re-imported identically."""
        tree = _make_tree(2, 3, prereqs={3: [0, 1], 5: [2]})
        save_knowledge_tree(project, tree)

        exported = export_knowledge_tree(project)
        assert len(exported["milestones"]) == 2
        assert sum(len(m["knodes"]) for m in exported["milestones"]) == 6

        # Re-import into a new project
        project2 = Project.objects.create(title="Project 2", description="Test")
        result = save_knowledge_tree(project2, exported)
        assert result["milestones_created"] == 2
        assert result["knodes_created"] == 6

    def test_export_preserves_prerequisites(self, project):
        tree = _make_tree(1, 3, prereqs={2: [0, 1]})
        save_knowledge_tree(project, tree)
        exported = export_knowledge_tree(project)
        node2 = exported["milestones"][0]["knodes"][2]
        assert sorted(node2["prerequisite_indices"]) == [0, 1]

    def test_export_empty_project(self, project):
        exported = export_knowledge_tree(project)
        assert exported == {"milestones": []}


class TestGetTreeGraph:
    def test_graph_structure(self, project):
        tree = _make_tree(2, 2, prereqs={2: [0], 3: [1]})
        save_knowledge_tree(project, tree)
        graph = get_tree_graph(project)

        assert len(graph["nodes"]) == 4
        assert len(graph["edges"]) == 2
        # Check node structure
        node = graph["nodes"][0]
        assert "id" in node
        assert "title" in node
        assert "milestone_title" in node
        assert "difficulty_level" in node

    def test_graph_empty_project(self, project):
        graph = get_tree_graph(project)
        assert graph == {"nodes": [], "edges": []}


class TestCloneProject:
    def test_clone_with_tree(self, project):
        tree = _make_tree(2, 3, prereqs={3: [0]})
        save_knowledge_tree(project, tree)

        cloned = clone_project(project, new_title="Cloned")
        assert cloned.pk != project.pk
        assert cloned.title == "Cloned"
        assert cloned.is_published is False
        assert cloned.milestones.count() == 2
        assert KnowledgeNode.objects.filter(project=cloned).count() == 6

    def test_clone_default_title(self, project):
        cloned = clone_project(project)
        assert cloned.title == f"{project.title} (Copy)"

    def test_clone_preserves_metadata(self, project):
        cloned = clone_project(project)
        assert cloned.category == project.category
        assert cloned.min_age == project.min_age
        assert cloned.max_age == project.max_age
        assert cloned.estimated_hours == project.estimated_hours

    def test_clone_empty_project(self, project):
        cloned = clone_project(project, new_title="Empty Clone")
        assert cloned.milestones.count() == 0

    def test_clone_preserves_prerequisites(self, project):
        tree = _make_tree(1, 3, prereqs={2: [0, 1]})
        save_knowledge_tree(project, tree)
        cloned = clone_project(project, new_title="Prereq Clone")
        cloned_knodes = list(
            KnowledgeNode.objects.filter(project=cloned).order_by("pk")
        )
        assert cloned_knodes[2].prerequisites.count() == 2
