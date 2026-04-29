"""Step 6: 组装 course_content + preflight_v41 + upsert_lesson。

实现 SKILL.md §2004-2160。直接调 factory.make_course_content (含 preflight) +
factory.upsert_lesson。

约束: 当前 v3 单 anim+单 game(SKILL §1170 描述的"上限"在 factory 层面). 多 anim/多 game
留 v3.1。本 step 从 ctx['ideas'] 中各取首个 anim + 首个 game,其余打 warning。
"""

from __future__ import annotations

import asyncio
import logging

from ..progress import EV_AGENT_LOG, Emitter

logger = logging.getLogger(__name__)


async def run(ctx: dict, *, em: Emitter) -> dict:
    """组装 + preflight + 写库。返回 course_content dict。"""
    from course_factory.factory import (
        ensure_db_tables,
        make_course_content,
        upsert_lesson_v3,
    )

    knode = ctx["knode"]
    ideas = ctx.get("ideas") or []

    # 按 mode 分桶, 取首个有 result 的
    anim_idea, game_idea, story_idea = None, None, None
    exercise_items: list[dict] = []
    images: list[dict] = []
    diagrams: list[dict] = []
    hands_on_kits: list[dict] = []

    for idea in ideas:
        if idea.get("status") != "ready":
            continue
        mode = idea.get("mode")
        result = idea.get("result")
        if not result:
            continue
        if mode == "animation" and anim_idea is None:
            anim_idea = idea
        elif mode == "game" and game_idea is None:
            game_idea = idea
        elif mode == "story" and story_idea is None:
            story_idea = idea
        elif mode == "exercise":
            # exercise.result 应是已经 make_exercises 后的 list[dict]
            if isinstance(result, list):
                exercise_items.extend(result)
        elif mode == "image":
            images.append(_image_to_kwargs(idea, result))
        elif mode == "diagram":
            diagrams.append(_diagram_to_kwargs(idea, result))
        elif mode == "hands_on_kit":
            hands_on_kits.append(_kit_to_kwargs(idea, result))

    # 报告多 anim/game 被丢弃
    extra_anims = sum(1 for i in ideas if i.get("mode") == "animation" and i.get("status") == "ready") - (1 if anim_idea else 0)
    extra_games = sum(1 for i in ideas if i.get("mode") == "game" and i.get("status") == "ready") - (1 if game_idea else 0)
    if extra_anims > 0 or extra_games > 0:
        msg = f"v3 当前单 anim+单 game 上限, 已丢弃 {extra_anims} 个 anim + {extra_games} 个 game (v3.1 解决)"
        logger.warning(f"[s60] {msg}")
        em.emit(EV_AGENT_LOG, {
            "agent": "Assemble", "phase": "warn", "input": "", "output": msg,
        })

    # exercise 兜底 — SKILL 要求至少 1 个
    if not exercise_items:
        logger.warning("[s60] no exercises! using fallback empty list (will fail preflight if knode requires)")

    # 确保 DB 表存在 (factory.ensure_db_tables 是同步)
    await asyncio.to_thread(ensure_db_tables)

    em.emit(EV_AGENT_LOG, {
        "agent": "Assemble", "phase": "input",
        "input": (
            f"anim={'yes' if anim_idea else 'no'}, game={'yes' if game_idea else 'no'}, "
            f"story={'yes' if story_idea else 'no'}, exercises={len(exercise_items)}, "
            f"theories={len(ctx.get('theories') or [])}, "
            f"research={'yes' if ctx.get('research') else 'no'}, "
            f"labxchange={len(ctx.get('labxchange') or [])}"
        ),
        "output": "(calling make_course_content...)",
    })

    # 调 factory.make_course_content (同步, 内部跑 preflight)
    try:
        course_content = await asyncio.to_thread(
            make_course_content,
            plan_markdown=ctx["plan_markdown"],
            animation_html=anim_idea["result"] if anim_idea else None,
            animation_topic=anim_idea.get("topic", "") if anim_idea else "",
            exercises=exercise_items,
            exercise_topic=_first_exercise_topic(ideas),
            story_paragraphs=story_idea["result"] if story_idea else None,
            knode=knode,
            animation_hands_on_ref=anim_idea.get("hands_on_ref", "") if anim_idea else "",
            animation_acceptance_ref=anim_idea.get("acceptance_ref", "") if anim_idea else "",
            exercise_hands_on_ref=_first_exercise_ref(ideas, "hands_on_ref"),
            exercise_acceptance_ref=_first_exercise_ref(ideas, "acceptance_ref"),
            game_html=game_idea["result"] if game_idea else None,
            game_topic=game_idea.get("topic", "") if game_idea else "",
            game_hands_on_ref=game_idea.get("hands_on_ref", "") if game_idea else "",
            game_acceptance_ref=game_idea.get("acceptance_ref", "") if game_idea else "",
            game_mode_reason=game_idea.get("mode_reason", "互动操作直接检验动手动作") if game_idea else "互动操作直接检验动手动作",
            preflight=True,
            research=ctx.get("research"),
            labxchange_results=ctx.get("labxchange") or [],
            theories=ctx.get("theories") or [],
            project_name=ctx["project_name"],
            images=images or None,
            diagrams=diagrams or None,
            hands_on_kits=hands_on_kits or None,
        )
    except ValueError as exc:
        # preflight 失败
        logger.error(f"[s60] preflight failed: {exc}")
        em.emit(EV_AGENT_LOG, {
            "agent": "Assemble", "phase": "preflight_fail",
            "input": "", "output": str(exc)[:1000],
        })
        raise

    em.emit(EV_AGENT_LOG, {
        "agent": "Assemble", "phase": "output",
        "input": "",
        "output": (
            f"course_content keys={list(course_content.keys())[:10]}, "
            f"ideas={len(course_content.get('ideas', []))}, "
            f"theories={len(course_content.get('theories', []))}"
        ),
    })

    # 写库 — v3 走独立 lesson_content_v3 表 (per-version, 与 v2/cf 完全隔离)
    version_label = ctx["version_label"]
    set_active = ctx.get("set_active", True)
    await asyncio.to_thread(
        upsert_lesson_v3,
        ctx["project_name"],
        ctx["knode_id"],
        course_content,
        version_label=version_label,
        set_active=set_active,
    )

    em.emit(EV_AGENT_LOG, {
        "agent": "Assemble", "phase": "upserted",
        "input": "",
        "output": f"LessonContentV3({ctx['project_name']}, {ctx['knode_id']}, {version_label!r}) status=ready active={set_active}",
    })

    return course_content


def _first_exercise_topic(ideas: list[dict]) -> str:
    for idea in ideas:
        if idea.get("mode") == "exercise":
            return idea.get("topic", "") or "练习"
    return "练习"


def _first_exercise_ref(ideas: list[dict], key: str) -> str:
    for idea in ideas:
        if idea.get("mode") == "exercise":
            return idea.get(key, "")
    return ""


def _image_to_kwargs(idea: dict, result: dict) -> dict:
    """idea.result 形如 {src, alt, caption, source_url, license, web_path}。"""
    out = dict(result or {})
    out.setdefault("topic", idea.get("topic", ""))
    out.setdefault("hands_on_ref", idea.get("hands_on_ref", ""))
    out.setdefault("acceptance_ref", idea.get("acceptance_ref", ""))
    return out


def _diagram_to_kwargs(idea: dict, result: dict) -> dict:
    """result 形如 {html_path, topic, caption}。"""
    out = dict(result or {})
    out.setdefault("topic", idea.get("topic", ""))
    out.setdefault("hands_on_ref", idea.get("hands_on_ref", ""))
    out.setdefault("acceptance_ref", idea.get("acceptance_ref", ""))
    return out


def _kit_to_kwargs(idea: dict, result: dict) -> dict:
    """result 形如 {topic, total_cost_cny, components, steps, tools, ...}。"""
    out = dict(result or {})
    out.setdefault("topic", idea.get("topic", ""))
    out.setdefault("hands_on_ref", idea.get("hands_on_ref", ""))
    out.setdefault("acceptance_ref", idea.get("acceptance_ref", ""))
    return out
