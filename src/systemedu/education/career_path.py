"""Career path (upgrade route) service: load definitions, track progress, award badges."""

import logging
from datetime import datetime
from pathlib import Path

import yaml

from systemedu.education.models import CareerPath
from systemedu.storage.db import (
    CareerPathProgress,
    CareerPathRecord,
    EarnedBadge,
    Enrollment,
    get_session,
)

logger = logging.getLogger(__name__)


def scan_paths(paths_dir: Path) -> list[str]:
    """Scan a directory for career path definitions and register them in DB.

    Returns list of path names that were loaded.
    """
    if not paths_dir.is_dir():
        return []

    loaded = []
    for child in sorted(paths_dir.iterdir()):
        yaml_file = child / "path.yaml"
        if not yaml_file.is_file():
            continue
        try:
            cp = _parse_path_yaml(yaml_file)
        except Exception as e:
            logger.warning("Failed to parse %s: %s", yaml_file, e)
            continue

        with get_session() as session:
            existing = session.query(CareerPathRecord).filter_by(name=cp.name).first()
            if existing:
                existing.title = cp.title
                existing.description = cp.description
                existing.path = str(child)
                existing.category = cp.category.value
                existing.loaded_at = datetime.now()
            else:
                session.add(CareerPathRecord(
                    name=cp.name,
                    title=cp.title,
                    description=cp.description,
                    path=str(child),
                    category=cp.category.value,
                ))
            session.commit()
        loaded.append(cp.name)

    return loaded


def _parse_path_yaml(yaml_file: Path) -> CareerPath:
    """Parse a path.yaml file into a CareerPath model."""
    with open(yaml_file, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return CareerPath(**data)


def load_path(name: str) -> CareerPath | None:
    """Load a career path definition from its YAML file.

    Looks up the filesystem path from DB, then parses the YAML.
    """
    with get_session() as session:
        record = session.query(CareerPathRecord).filter_by(name=name).first()
    if not record:
        return None

    yaml_file = Path(record.path) / "path.yaml"
    if not yaml_file.is_file():
        return None

    return _parse_path_yaml(yaml_file)


def list_paths() -> list[dict]:
    """List all registered career paths with basic progress info."""
    with get_session() as session:
        records = session.query(CareerPathRecord).all()
        result = []
        for rec in records:
            cp = load_path(rec.name)
            if not cp:
                continue

            progress = _get_progress_record(session, "default", rec.name)
            completed_count = _count_completed_stages(session, "default", cp)

            result.append({
                "name": cp.name,
                "title": cp.title,
                "description": cp.description,
                "category": cp.category.value,
                "age_range": cp.age_range,
                "estimated_months": cp.estimated_months,
                "total_stages": len(cp.stages),
                "completed_stages": completed_count,
                "status": progress.status if progress else "not_enrolled",
                "current_avatar_stage": progress.current_avatar_stage if progress else 0,
            })
        return result


def get_path_progress(user_id: str, path_name: str) -> dict | None:
    """Get full progress detail for a career path.

    Combines the YAML definition with enrollment data to compute progress.
    """
    cp = load_path(path_name)
    if not cp:
        return None

    with get_session() as session:
        progress = _get_progress_record(session, user_id, path_name)
        completed_projects = _get_completed_projects(session, user_id)
        badges = (
            session.query(EarnedBadge)
            .filter_by(user_id=user_id, path_name=path_name)
            .all()
        )

    completed_count = 0
    stages_info = []
    next_project = None

    for ps in sorted(cp.stages, key=lambda s: s.order):
        is_completed = ps.project_name in completed_projects
        if is_completed:
            completed_count += 1
        elif next_project is None:
            next_project = ps.project_name

        stages_info.append({
            "order": ps.order,
            "project_name": ps.project_name,
            "required": ps.required,
            "completed": is_completed,
            "badge": ps.badge.model_dump() if ps.badge else None,
            "avatar_stage": ps.avatar_stage,
        })

    total = len(cp.stages)
    current_avatar = progress.current_avatar_stage if progress else 0
    current_avatar_info = None
    for av in cp.avatar_stages:
        if av.stage == current_avatar:
            current_avatar_info = av.model_dump()
            break

    return {
        "path": cp.model_dump(exclude={"stages", "avatar_stages"}),
        "stages": stages_info,
        "avatar_stages": [a.model_dump() for a in cp.avatar_stages],
        "progress": {
            "completed_stages": completed_count,
            "total_stages": total,
            "completion_percent": round(completed_count / total * 100) if total else 0,
            "next_project": next_project,
            "status": progress.status if progress else "not_enrolled",
            "current_avatar_stage": current_avatar,
        },
        "current_avatar": current_avatar_info,
        "earned_badges": [
            {
                "path_name": b.path_name,
                "stage_order": b.stage_order,
                "badge_name": b.badge_name,
                "earned_at": b.earned_at.isoformat() if b.earned_at else None,
            }
            for b in badges
        ],
    }


def enroll_path(user_id: str, path_name: str) -> dict:
    """Enroll a user in a career path."""
    with get_session() as session:
        existing = _get_progress_record(session, user_id, path_name)
        if existing:
            return {"status": existing.status, "already_enrolled": True}

        session.add(CareerPathProgress(
            user_id=user_id,
            path_name=path_name,
            current_stage=0,
            current_avatar_stage=0,
            status="active",
            started_at=datetime.now(),
        ))
        session.commit()
    return {"status": "active", "already_enrolled": False}


def recalculate_progress(user_id: str, path_name: str) -> dict:
    """Recalculate career path progress based on current project enrollments.

    Called when a project enrollment status changes to 'completed'.
    Returns dict with new_badges (list) and avatar_advanced (bool).
    """
    cp = load_path(path_name)
    if not cp:
        return {"new_badges": [], "avatar_advanced": False}

    with get_session() as session:
        progress = _get_progress_record(session, user_id, path_name)
        if not progress:
            return {"new_badges": [], "avatar_advanced": False}

        completed_projects = _get_completed_projects(session, user_id)

        new_badges = []
        max_avatar_stage = 0
        completed_count = 0

        for ps in sorted(cp.stages, key=lambda s: s.order):
            if ps.project_name not in completed_projects:
                continue
            completed_count += 1

            if ps.avatar_stage > max_avatar_stage:
                max_avatar_stage = ps.avatar_stage

            # Award badge if not already earned
            if ps.badge:
                existing_badge = (
                    session.query(EarnedBadge)
                    .filter_by(user_id=user_id, path_name=path_name, stage_order=ps.order)
                    .first()
                )
                if not existing_badge:
                    session.add(EarnedBadge(
                        user_id=user_id,
                        path_name=path_name,
                        stage_order=ps.order,
                        badge_name=ps.badge.name,
                        earned_at=datetime.now(),
                    ))
                    new_badges.append(ps.badge.name)

        old_avatar = progress.current_avatar_stage
        progress.current_stage = completed_count
        progress.current_avatar_stage = max_avatar_stage

        if completed_count >= len(cp.stages):
            progress.status = "completed"
            progress.completed_at = datetime.now()

        session.commit()

    return {
        "new_badges": new_badges,
        "avatar_advanced": max_avatar_stage > old_avatar,
    }


def on_project_completed(user_id: str, project_name: str) -> list[dict]:
    """Hook called when a project enrollment is marked completed.

    Checks all career paths that include this project and recalculates progress.
    Returns list of {path_name, new_badges, avatar_advanced} for each affected path.
    """
    results = []
    with get_session() as session:
        all_paths = session.query(CareerPathRecord).all()

    for rec in all_paths:
        cp = load_path(rec.name)
        if not cp:
            continue
        # Check if this project is in the path
        if not any(s.project_name == project_name for s in cp.stages):
            continue
        # Check if user is enrolled in this path
        with get_session() as session:
            progress = _get_progress_record(session, user_id, rec.name)
        if not progress:
            continue

        result = recalculate_progress(user_id, rec.name)
        result["path_name"] = rec.name
        results.append(result)

    return results


def get_paths_for_project(project_name: str) -> list[dict]:
    """Find all career paths that include a given project."""
    result = []
    with get_session() as session:
        all_paths = session.query(CareerPathRecord).all()

    for rec in all_paths:
        cp = load_path(rec.name)
        if not cp:
            continue
        for s in cp.stages:
            if s.project_name == project_name:
                result.append({"name": cp.name, "title": cp.title, "stage_order": s.order})
                break
    return result


def get_badge_svg(path_name: str, badge_icon: str) -> bytes | None:
    """Return SVG content for a badge."""
    with get_session() as session:
        rec = session.query(CareerPathRecord).filter_by(name=path_name).first()
    if not rec:
        return None
    svg_path = Path(rec.path) / badge_icon
    if not svg_path.is_file():
        return None
    return svg_path.read_bytes()


def get_avatar_svg(path_name: str, stage: int) -> bytes | None:
    """Return SVG content for an avatar stage."""
    cp = load_path(path_name)
    if not cp:
        return None
    for av in cp.avatar_stages:
        if av.stage == stage and av.image:
            with get_session() as session:
                rec = session.query(CareerPathRecord).filter_by(name=path_name).first()
            if not rec:
                return None
            svg_path = Path(rec.path) / av.image
            if svg_path.is_file():
                return svg_path.read_bytes()
    return None


def get_all_earned_badges(user_id: str) -> list[dict]:
    """Get all badges earned by a user across all paths."""
    with get_session() as session:
        badges = session.query(EarnedBadge).filter_by(user_id=user_id).all()
        return [
            {
                "path_name": b.path_name,
                "stage_order": b.stage_order,
                "badge_name": b.badge_name,
                "earned_at": b.earned_at.isoformat() if b.earned_at else None,
            }
            for b in badges
        ]


# --- Internal helpers ---


def _get_progress_record(session, user_id: str, path_name: str) -> CareerPathProgress | None:
    return (
        session.query(CareerPathProgress)
        .filter_by(user_id=user_id, path_name=path_name)
        .first()
    )


def _get_completed_projects(session, user_id: str) -> set[str]:
    """Get set of project names where user's enrollment is completed."""
    enrollments = (
        session.query(Enrollment)
        .filter_by(user_id=user_id, status="completed")
        .all()
    )
    return {e.project_name for e in enrollments}


def _count_completed_stages(session, user_id: str, cp: CareerPath) -> int:
    completed_projects = _get_completed_projects(session, user_id)
    return sum(1 for s in cp.stages if s.project_name in completed_projects)
