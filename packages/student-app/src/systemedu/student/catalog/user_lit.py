"""spec 036: 用户级知识点亮 + 推荐项目 聚合逻辑.

不存派生表 — 全部 query-time 计算 (撤销 toggle 天然支持).
"""

from __future__ import annotations

import logging
from collections import defaultdict
from typing import Any

from ..db import UserKnodeComplete, get_session
from ..library_proxy.client import get_library_client


logger = logging.getLogger(__name__)


def get_user_completed(user_id: str) -> dict[str, set[str]]:
    """{project_slug: {knode_id, ...}}"""
    out: dict[str, set[str]] = defaultdict(set)
    with get_session() as db:
        rows = db.query(UserKnodeComplete).filter_by(user_id=user_id).all()
        for r in rows:
            out[r.project_slug].add(r.knode_id)
    return dict(out)


def get_completed_knode_ids(user_id: str, project_slug: str) -> list[str]:
    """该用户在某项目已完成的 knode_id 列表."""
    with get_session() as db:
        rows = db.query(UserKnodeComplete).filter_by(
            user_id=user_id, project_slug=project_slug
        ).all()
        return [r.knode_id for r in rows]


def toggle_complete(
    user_id: str,
    project_slug: str,
    knode_id: str,
    action: str = "toggle",
    library_version: str | None = None,
) -> bool:
    """toggle / complete / incomplete. 返回最终 completed 状态."""
    with get_session() as db:
        existing = db.query(UserKnodeComplete).filter_by(
            user_id=user_id, project_slug=project_slug, knode_id=knode_id
        ).first()

        if action == "incomplete":
            if existing:
                db.delete(existing)
                db.commit()
            return False
        if action == "complete":
            if not existing:
                row = UserKnodeComplete(
                    user_id=user_id,
                    project_slug=project_slug,
                    knode_id=knode_id,
                    library_version=library_version,
                )
                db.add(row)
                db.commit()
            return True
        # toggle (default)
        if existing:
            db.delete(existing)
            db.commit()
            return False
        else:
            row = UserKnodeComplete(
                user_id=user_id,
                project_slug=project_slug,
                knode_id=knode_id,
                library_version=library_version,
            )
            db.add(row)
            db.commit()
            return True


async def compute_user_lit_nodes(user_id: str) -> dict[str, Any]:
    """跨项目聚合用户点亮的 platform 节点.

    返回:
      {
        "user_id": str,
        "lit_nodes": [
          {"node_id": str, "lit_by_projects": [{"slug": str, "lit_by_knodes": [...]}]}
        ],
        "subjects_summary": [
          {"subject_id", "subject_name_zh", "color", "lit_count", "total_count", "percent"}
        ],
        "total_lit": int,
        "total_platform_nodes": int,
      }
    """
    completed = get_user_completed(user_id)
    lib = get_library_client()

    user_lit_map: dict[str, dict] = {}

    for slug, knode_ids in completed.items():
        try:
            proj_kt = await lib.get_project_knowledge_tree(slug)
        except Exception as e:
            logger.warning("get_project_knowledge_tree(%s) failed: %s", slug, e)
            continue
        for lit in proj_kt.get("lit_nodes", []):
            overlap = set(lit.get("lit_by", [])) & knode_ids
            if not overlap:
                continue
            nid = lit["node_id"]
            entry = user_lit_map.setdefault(
                nid, {"node_id": nid, "lit_by_projects": []}
            )
            entry["lit_by_projects"].append({
                "slug": slug,
                "lit_by_knodes": sorted(overlap),
            })

    # 按 platform_tree 算覆盖率
    try:
        platform = await lib.get_platform_knowledge_tree()
    except Exception as e:
        logger.warning("get_platform_knowledge_tree failed: %s", e)
        platform = {"subjects": []}

    subjects_summary = []
    for s in platform.get("subjects", []):
        total = len(s.get("nodes", []))
        lit = sum(1 for n in s["nodes"] if n["id"] in user_lit_map)
        percent = round(lit * 100 / total, 1) if total else 0.0
        subjects_summary.append({
            "subject_id": s["id"],
            "subject_name_zh": s.get("name_zh", s["id"]),
            "color": s.get("color", "#888"),
            "lit_count": lit,
            "total_count": total,
            "percent": percent,
        })

    return {
        "user_id": user_id,
        "lit_nodes": list(user_lit_map.values()),
        "subjects_summary": subjects_summary,
        "total_lit": len(user_lit_map),
        "total_platform_nodes": sum(s["total_count"] for s in subjects_summary),
    }


async def recommend_next_projects(user_id: str, limit: int = 3) -> dict[str, Any]:
    """推荐用户下一个项目 (简单版: 差集最大).

    返回 {"recommendations": [{slug, title_zh, cover_image_path, difficulty,
                              new_nodes_count, new_nodes_subjects}]}
    """
    user_kt = await compute_user_lit_nodes(user_id)
    user_lit_ids = {n["node_id"] for n in user_kt["lit_nodes"]}
    done_slugs = set(get_user_completed(user_id).keys())

    lib = get_library_client()
    try:
        all_projects = await lib.list_projects()
    except Exception as e:
        logger.warning("list_projects failed: %s", e)
        return {"recommendations": []}

    scored: list[dict] = []
    for p in all_projects:
        slug = p.slug
        if slug in done_slugs:
            continue
        try:
            proj_kt = await lib.get_project_knowledge_tree(slug)
        except Exception:
            continue
        p_lit_ids = {n["node_id"] for n in proj_kt.get("lit_nodes", [])}
        new_ids = p_lit_ids - user_lit_ids
        if not new_ids:
            continue
        new_by_subject: dict[str, int] = defaultdict(int)
        for nid in new_ids:
            new_by_subject[nid.split(".", 1)[0]] += 1
        scored.append({
            "slug": slug,
            "title_zh": getattr(p, "title_zh", None) or getattr(p, "title", slug),
            "cover_image_path": getattr(p, "cover_image_path", None),
            "difficulty": getattr(p, "difficulty", None),
            "new_nodes_count": len(new_ids),
            "new_nodes_subjects": dict(new_by_subject),
        })

    scored.sort(key=lambda x: -x["new_nodes_count"])
    return {"recommendations": scored[:limit]}
