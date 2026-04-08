"""Tests for career path (upgrade route) service."""

import shutil
from datetime import datetime
from pathlib import Path

import pytest
import yaml

from systemedu.education.career_path import (
    enroll_path,
    get_all_earned_badges,
    get_path_progress,
    get_paths_for_project,
    list_paths,
    load_path,
    on_project_completed,
    recalculate_progress,
    scan_paths,
)
from systemedu.education.models import CareerPath
from systemedu.storage.db import (
    Base,
    CareerPathProgress,
    CareerPathRecord,
    EarnedBadge,
    Enrollment,
    get_engine,
    get_session,
    reset_db,
)


@pytest.fixture(autouse=True)
def _reset(tmp_path, monkeypatch):
    """Reset DB between tests, using a unique temp DB per test."""
    db_file = tmp_path / "test.db"
    monkeypatch.setattr("systemedu.storage.db.DB_FILE", db_file)
    reset_db()
    get_engine()  # Force table creation
    yield
    reset_db()


@pytest.fixture()
def paths_dir(tmp_path):
    """Create a temporary career paths directory with a sample path."""
    path_dir = tmp_path / "paths" / "test-scientist"
    path_dir.mkdir(parents=True)
    (path_dir / "avatars").mkdir()
    (path_dir / "badges").mkdir()

    path_yaml = {
        "name": "test-scientist",
        "title": "Test Scientist Path",
        "description": "A test career path",
        "category": "aerospace",
        "age_range": [10, 18],
        "estimated_months": 12,
        "stages": [
            {
                "order": 0,
                "project_name": "project-alpha",
                "required": True,
                "badge": {
                    "name": "Alpha Badge",
                    "description": "Completed project alpha",
                    "icon": "badges/alpha.svg",
                },
                "avatar_stage": 0,
            },
            {
                "order": 1,
                "project_name": "project-beta",
                "required": True,
                "badge": {
                    "name": "Beta Badge",
                    "description": "Completed project beta",
                    "icon": "badges/beta.svg",
                },
                "avatar_stage": 1,
            },
            {
                "order": 2,
                "project_name": "project-gamma",
                "required": True,
                "badge": {
                    "name": "Gamma Badge",
                    "description": "Completed project gamma",
                },
                "avatar_stage": 2,
            },
        ],
        "avatar_stages": [
            {"stage": 0, "title": "Beginner", "description": "Just started", "image": "avatars/stage-0.svg", "xp_threshold": 0},
            {"stage": 1, "title": "Intermediate", "description": "Making progress", "image": "avatars/stage-1.svg", "xp_threshold": 100},
            {"stage": 2, "title": "Expert", "description": "Path complete", "image": "avatars/stage-2.svg", "xp_threshold": 300},
        ],
    }

    with open(path_dir / "path.yaml", "w") as f:
        yaml.dump(path_yaml, f, allow_unicode=True)

    # Create a dummy badge SVG
    (path_dir / "badges" / "alpha.svg").write_text('<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>')

    return tmp_path / "paths"


def _setup_db(tmp_path):
    """No-op: DB is set up by autouse fixture."""
    pass


class TestScanPaths:
    def test_scan_registers_path(self, paths_dir, tmp_path):
        _setup_db(tmp_path)
        loaded = scan_paths(paths_dir)
        assert "test-scientist" in loaded

        with get_session() as session:
            rec = session.query(CareerPathRecord).filter_by(name="test-scientist").first()
            assert rec is not None
            assert rec.title == "Test Scientist Path"
            assert rec.category == "aerospace"

    def test_scan_nonexistent_dir(self, tmp_path):
        _setup_db(tmp_path)
        loaded = scan_paths(tmp_path / "nonexistent")
        assert loaded == []

    def test_scan_updates_existing(self, paths_dir, tmp_path):
        _setup_db(tmp_path)
        scan_paths(paths_dir)
        # Scan again -- should update, not duplicate
        scan_paths(paths_dir)

        with get_session() as session:
            count = session.query(CareerPathRecord).filter_by(name="test-scientist").count()
            assert count == 1


class TestLoadPath:
    def test_load_returns_model(self, paths_dir, tmp_path):
        _setup_db(tmp_path)
        scan_paths(paths_dir)

        cp = load_path("test-scientist")
        assert cp is not None
        assert isinstance(cp, CareerPath)
        assert len(cp.stages) == 3
        assert cp.stages[0].project_name == "project-alpha"
        assert cp.stages[0].badge.name == "Alpha Badge"
        assert len(cp.avatar_stages) == 3

    def test_load_nonexistent(self, tmp_path):
        _setup_db(tmp_path)
        assert load_path("nonexistent") is None


class TestEnrollAndProgress:
    def test_enroll(self, paths_dir, tmp_path):
        _setup_db(tmp_path)
        scan_paths(paths_dir)

        result = enroll_path("default", "test-scientist")
        assert result["status"] == "active"
        assert result["already_enrolled"] is False

        # Enroll again
        result2 = enroll_path("default", "test-scientist")
        assert result2["already_enrolled"] is True

    def test_progress_no_completions(self, paths_dir, tmp_path):
        _setup_db(tmp_path)
        scan_paths(paths_dir)
        enroll_path("default", "test-scientist")

        progress = get_path_progress("default", "test-scientist")
        assert progress is not None
        assert progress["progress"]["completed_stages"] == 0
        assert progress["progress"]["total_stages"] == 3
        assert progress["progress"]["next_project"] == "project-alpha"
        assert progress["progress"]["completion_percent"] == 0
        assert len(progress["earned_badges"]) == 0

    def test_progress_with_completions(self, paths_dir, tmp_path):
        _setup_db(tmp_path)
        scan_paths(paths_dir)
        enroll_path("default", "test-scientist")

        # Simulate completing project-alpha
        with get_session() as session:
            session.add(Enrollment(
                user_id="default",
                project_name="project-alpha",
                status="completed",
                started_at=datetime.now(),
            ))
            session.commit()

        recalculate_progress("default", "test-scientist")

        progress = get_path_progress("default", "test-scientist")
        assert progress["progress"]["completed_stages"] == 1
        assert progress["progress"]["next_project"] == "project-beta"
        assert len(progress["earned_badges"]) == 1
        assert progress["earned_badges"][0]["badge_name"] == "Alpha Badge"

    def test_complete_all_stages(self, paths_dir, tmp_path):
        _setup_db(tmp_path)
        scan_paths(paths_dir)
        enroll_path("default", "test-scientist")

        # Complete all projects
        with get_session() as session:
            for pname in ("project-alpha", "project-beta", "project-gamma"):
                session.add(Enrollment(
                    user_id="default",
                    project_name=pname,
                    status="completed",
                    started_at=datetime.now(),
                ))
            session.commit()

        result = recalculate_progress("default", "test-scientist")
        assert len(result["new_badges"]) == 3
        assert result["avatar_advanced"] is True

        progress = get_path_progress("default", "test-scientist")
        assert progress["progress"]["status"] == "completed"
        assert progress["progress"]["completion_percent"] == 100
        assert progress["progress"]["next_project"] is None
        assert progress["current_avatar"]["stage"] == 2
        assert progress["current_avatar"]["title"] == "Expert"


class TestAutoEnroll:
    def test_auto_enroll_on_project_start(self, paths_dir, tmp_path):
        """Starting a project auto-enrolls user in related career paths."""
        from systemedu.education.career_path import auto_enroll_for_project

        _setup_db(tmp_path)
        scan_paths(paths_dir)

        enrolled = auto_enroll_for_project("default", "project-alpha")
        assert "test-scientist" in enrolled

        # Verify progress record was created
        progress = get_path_progress("default", "test-scientist")
        assert progress is not None
        assert progress["progress"]["status"] == "active"

    def test_auto_enroll_idempotent(self, paths_dir, tmp_path):
        """Auto-enroll doesn't duplicate if already enrolled."""
        from systemedu.education.career_path import auto_enroll_for_project

        _setup_db(tmp_path)
        scan_paths(paths_dir)

        enrolled1 = auto_enroll_for_project("default", "project-alpha")
        assert len(enrolled1) == 1

        enrolled2 = auto_enroll_for_project("default", "project-alpha")
        assert len(enrolled2) == 0  # Already enrolled

    def test_auto_enroll_unrelated_project(self, paths_dir, tmp_path):
        """Unrelated projects don't trigger auto-enroll."""
        from systemedu.education.career_path import auto_enroll_for_project

        _setup_db(tmp_path)
        scan_paths(paths_dir)

        enrolled = auto_enroll_for_project("default", "unrelated-project")
        assert enrolled == []


class TestOnProjectCompleted:
    def test_hook_triggers_recalculation(self, paths_dir, tmp_path):
        _setup_db(tmp_path)
        scan_paths(paths_dir)
        enroll_path("default", "test-scientist")

        # Complete project-alpha
        with get_session() as session:
            session.add(Enrollment(
                user_id="default",
                project_name="project-alpha",
                status="completed",
                started_at=datetime.now(),
            ))
            session.commit()

        results = on_project_completed("default", "project-alpha")
        assert len(results) == 1
        assert results[0]["path_name"] == "test-scientist"
        assert "Alpha Badge" in results[0]["new_badges"]

    def test_hook_ignores_unrelated_project(self, paths_dir, tmp_path):
        _setup_db(tmp_path)
        scan_paths(paths_dir)
        enroll_path("default", "test-scientist")

        results = on_project_completed("default", "unrelated-project")
        assert results == []


class TestListAndQuery:
    def test_list_paths(self, paths_dir, tmp_path):
        _setup_db(tmp_path)
        scan_paths(paths_dir)

        paths = list_paths()
        assert len(paths) == 1
        assert paths[0]["name"] == "test-scientist"
        assert paths[0]["total_stages"] == 3
        assert paths[0]["status"] == "not_enrolled"

    def test_get_paths_for_project(self, paths_dir, tmp_path):
        _setup_db(tmp_path)
        scan_paths(paths_dir)

        result = get_paths_for_project("project-beta")
        assert len(result) == 1
        assert result[0]["name"] == "test-scientist"
        assert result[0]["stage_order"] == 1

    def test_get_paths_for_unknown_project(self, paths_dir, tmp_path):
        _setup_db(tmp_path)
        scan_paths(paths_dir)
        assert get_paths_for_project("unknown") == []


class TestBadgeSvg:
    def test_get_badge_svg(self, paths_dir, tmp_path):
        from systemedu.education.career_path import get_badge_svg

        _setup_db(tmp_path)
        scan_paths(paths_dir)

        svg = get_badge_svg("test-scientist", "badges/alpha.svg")
        assert svg is not None
        assert b"<svg" in svg

    def test_get_badge_svg_missing(self, paths_dir, tmp_path):
        from systemedu.education.career_path import get_badge_svg

        _setup_db(tmp_path)
        scan_paths(paths_dir)

        svg = get_badge_svg("test-scientist", "badges/nonexistent.svg")
        assert svg is None


class TestXPAccumulation:
    def test_add_xp_basic(self, paths_dir, tmp_path):
        """XP accumulates on career path progress."""
        from systemedu.education.career_path import add_xp

        _setup_db(tmp_path)
        scan_paths(paths_dir)
        enroll_path("default", "test-scientist")

        results = add_xp("default", "project-alpha", 50)
        assert len(results) == 1
        assert results[0]["path_name"] == "test-scientist"
        assert results[0]["total_xp"] == 50
        assert results[0]["new_avatar_stage"] is None  # threshold is 100

    def test_add_xp_triggers_avatar_evolution(self, paths_dir, tmp_path):
        """XP crossing threshold triggers avatar stage upgrade."""
        from systemedu.education.career_path import add_xp

        _setup_db(tmp_path)
        scan_paths(paths_dir)
        enroll_path("default", "test-scientist")

        # Add enough XP to reach stage 1 (threshold=100)
        results = add_xp("default", "project-alpha", 120)
        assert results[0]["total_xp"] == 120
        assert results[0]["new_avatar_stage"] == 1
        assert results[0]["badge_earned"] == "Beta Badge"  # avatar_stage=1 maps to project-beta

    def test_add_xp_cumulative(self, paths_dir, tmp_path):
        """Multiple XP additions accumulate correctly."""
        from systemedu.education.career_path import add_xp

        _setup_db(tmp_path)
        scan_paths(paths_dir)
        enroll_path("default", "test-scientist")

        add_xp("default", "project-alpha", 50)
        results = add_xp("default", "project-alpha", 60)
        assert results[0]["total_xp"] == 110
        assert results[0]["new_avatar_stage"] == 1  # crossed 100 threshold

    def test_add_xp_skips_unenrolled_path(self, paths_dir, tmp_path):
        """XP is not added if user is not enrolled in the path."""
        from systemedu.education.career_path import add_xp

        _setup_db(tmp_path)
        scan_paths(paths_dir)
        # Don't enroll

        results = add_xp("default", "project-alpha", 50)
        assert results == []

    def test_add_xp_unrelated_project(self, paths_dir, tmp_path):
        """XP from unrelated project has no effect."""
        from systemedu.education.career_path import add_xp

        _setup_db(tmp_path)
        scan_paths(paths_dir)
        enroll_path("default", "test-scientist")

        results = add_xp("default", "unrelated-project", 50)
        assert results == []

    def test_add_xp_zero_or_negative(self, paths_dir, tmp_path):
        """Zero or negative XP is rejected."""
        from systemedu.education.career_path import add_xp

        _setup_db(tmp_path)
        scan_paths(paths_dir)
        enroll_path("default", "test-scientist")

        assert add_xp("default", "project-alpha", 0) == []
        assert add_xp("default", "project-alpha", -10) == []

    def test_add_xp_multi_stage_evolution(self, paths_dir, tmp_path):
        """Large XP can skip to higher avatar stages."""
        from systemedu.education.career_path import add_xp

        _setup_db(tmp_path)
        scan_paths(paths_dir)
        enroll_path("default", "test-scientist")

        # Add enough XP to reach stage 2 directly (threshold=300)
        results = add_xp("default", "project-alpha", 350)
        assert results[0]["total_xp"] == 350
        assert results[0]["new_avatar_stage"] == 2

    def test_progress_includes_xp_info(self, paths_dir, tmp_path):
        """get_path_progress returns XP and next threshold."""
        from systemedu.education.career_path import add_xp

        _setup_db(tmp_path)
        scan_paths(paths_dir)
        enroll_path("default", "test-scientist")

        add_xp("default", "project-alpha", 50)
        progress = get_path_progress("default", "test-scientist")
        assert progress["progress"]["total_xp"] == 50
        assert progress["progress"]["next_avatar_xp"] == 100  # next threshold

    def test_list_paths_includes_xp(self, paths_dir, tmp_path):
        """list_paths returns total_xp and next_avatar_xp."""
        from systemedu.education.career_path import add_xp

        _setup_db(tmp_path)
        scan_paths(paths_dir)
        enroll_path("default", "test-scientist")

        add_xp("default", "project-alpha", 50)
        paths = list_paths()
        assert paths[0]["total_xp"] == 50
        assert paths[0]["next_avatar_xp"] == 100


class TestAllEarnedBadges:
    def test_all_badges_across_paths(self, paths_dir, tmp_path):
        _setup_db(tmp_path)
        scan_paths(paths_dir)
        enroll_path("default", "test-scientist")

        with get_session() as session:
            session.add(Enrollment(
                user_id="default",
                project_name="project-alpha",
                status="completed",
                started_at=datetime.now(),
            ))
            session.commit()

        recalculate_progress("default", "test-scientist")

        badges = get_all_earned_badges("default")
        assert len(badges) == 1
        assert badges[0]["badge_name"] == "Alpha Badge"
