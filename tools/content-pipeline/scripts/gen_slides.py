"""为已生成的 workspace knode 补 slides.json + audio_script。

读取 workspace 下某项目的 30 个 knode (lesson.md / sections.json / theories.json +
tree/knowledge_tree.json 的 module 元数据), 调 slide_gen.md prompt + fast LLM,
为每个 knode 输出 slides.json (含每 slide 的 audio_script)。

用法:
    python tools/content-pipeline/scripts/gen_slides.py \\
        --workspace content-workspace/generated/purpleair-airquality-node \\
        --module M01            # 单个 knode
    python tools/content-pipeline/scripts/gen_slides.py \\
        --workspace content-workspace/generated/purpleair-airquality-node \\
        --all                   # 串行跑全部 30 个
    python tools/content-pipeline/scripts/gen_slides.py \\
        --workspace content-workspace/generated/purpleair-airquality-node \\
        --all --skip-existing   # 跳过已存在 slides.json 的 knode

写盘位置: <workspace>/knodes/<knode_dir>/slides.json
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import re
import sys
import time
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_ROOT / "packages" / "core" / "src"))

from systemedu.core.course_factory_v3.kimi_client import ainvoke, llm_for  # noqa: E402

PROMPT_PATH = (
    REPO_ROOT
    / "packages"
    / "core"
    / "src"
    / "systemedu"
    / "core"
    / "course_factory_v3"
    / "prompts"
    / "slide_gen.md"
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("gen_slides")


# ---------------------------------------------------------------------------
# I/O helpers
# ---------------------------------------------------------------------------


def _read_json(p: Path, default: Any) -> Any:
    if not p.exists():
        return default
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception as exc:
        log.warning("read json fail %s: %s", p, exc)
        return default


def _read_text(p: Path, default: str = "") -> str:
    if not p.exists():
        return default
    return p.read_text(encoding="utf-8")


def _format_theories(theories: list[dict]) -> str:
    if not theories:
        return "(无 theories)"
    lines = []
    for t in theories:
        tid = t.get("theory_id", "")
        title = t.get("title", "")
        subj = t.get("subject", "")
        body = (t.get("body_markdown") or "")[:200]
        lines.append(f"- theory_id={tid} | {title} ({subj}) | {body[:120]}...")
    return "\n".join(lines)


def _format_ideas(ideas: list[dict], rendered: dict) -> str:
    if not ideas:
        return "(无 ideas)"
    lines = []
    for i in ideas:
        iid = i.get("idea_id", "")
        mode = i.get("mode", "")
        topic = i.get("topic", "")
        rs = rendered.get(iid) or {}
        has_html = bool(rs.get("html"))
        lines.append(
            f"- idea_id={iid} | mode={mode} | topic={topic} | has_content={has_html}"
        )
    return "\n".join(lines)


def _format_list(items: list) -> str:
    if not items:
        return "(无)"
    out = []
    for x in items:
        if isinstance(x, str):
            out.append(f"- {x}")
        elif isinstance(x, dict):
            out.append(f"- {x.get('title', x.get('name', str(x)))}")
    return "\n".join(out) if out else "(无)"


# ---------------------------------------------------------------------------
# LLM call + parse
# ---------------------------------------------------------------------------


_JSON_ARR_RE = re.compile(r"\[\s*\{[\s\S]*\}\s*\]", re.MULTILINE)


def _parse_slides_json(raw: str) -> list[dict]:
    if not raw:
        return []
    s = raw.strip()
    if s.startswith("```"):
        lines = s.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        s = "\n".join(lines).strip()
    try:
        v = json.loads(s)
        if isinstance(v, list):
            return [x for x in v if isinstance(x, dict)]
    except Exception:
        pass
    m = _JSON_ARR_RE.search(s)
    if m:
        try:
            v = json.loads(m.group(0))
            if isinstance(v, list):
                return [x for x in v if isinstance(x, dict)]
        except Exception:
            pass
    return []


def _yt_thumb(url: str) -> str:
    m = re.search(r"(?:v=|youtu\.be/|/embed/)([A-Za-z0-9_-]{11})", url or "")
    if m:
        return f"https://img.youtube.com/vi/{m.group(1)}/hqdefault.jpg"
    return ""


def _enrich_payloads(
    slides: list[dict], ideas: list[dict], rendered: dict, ext: dict
) -> list[dict]:
    """填回 videos/labxchange/image 真实 URL (LLM 留空数组占位)。"""
    youtube = ext.get("youtube_results") or []
    labxchange = ext.get("labxchange_results") or []

    image_payloads = []
    for i in ideas:
        if i.get("mode") == "image":
            iid = i.get("idea_id", "")
            rs = rendered.get(iid) or {}
            src = rs.get("src") or rs.get("image_url") or ""
            if src:
                image_payloads.append(
                    {
                        "src": src,
                        "caption": rs.get("caption") or rs.get("alt") or i.get("topic", ""),
                        "source_url": rs.get("source_url", ""),
                    }
                )

    out: list[dict] = []
    for s in slides:
        s = dict(s)
        kind = s.get("kind", "")
        payload = dict(s.get("payload") or {})
        if kind == "videos" and not payload.get("videos"):
            payload["videos"] = [
                {
                    "title": v.get("title", ""),
                    "url": v.get("url", ""),
                    "thumbnail": v.get("thumbnail", "") or _yt_thumb(v.get("url", "")),
                }
                for v in youtube
            ]
        elif kind == "labxchange" and not payload.get("labxchange"):
            payload["labxchange"] = [
                {
                    "title": x.get("title", ""),
                    "url": x.get("url", ""),
                    "description": x.get("description", ""),
                }
                for x in labxchange
            ]
        elif kind == "image" and not payload.get("images"):
            payload["images"] = image_payloads
        s["payload"] = payload
        out.append(s)
    return out


def _normalize_ids(
    slides: list[dict], theories: list[dict], ideas: list[dict]
) -> list[dict]:
    """LLM 常用 topic 字段当 id, 或自动加/去 `theory_`/`anim_` 前缀。
    这里按真实 (id, topic) 索引做一次匹配修正。"""
    real_theory_ids = {t.get("theory_id") for t in theories if t.get("theory_id")}
    real_idea_ids = {i.get("idea_id") for i in ideas if i.get("idea_id")}
    # 用 topic 反查 idea_id (LLM 经常把 topic 当 idea_id 用)
    topic_to_idea = {
        i.get("topic"): i.get("idea_id")
        for i in ideas
        if i.get("topic") and i.get("idea_id")
    }

    def _match(candidate: str, real: set[str], topic_map: dict[str, str] | None = None) -> str | None:
        if not candidate:
            return None
        if candidate in real:
            return candidate
        # topic 反查
        if topic_map and candidate in topic_map:
            return topic_map[candidate]
        # 剥前缀
        for pre in ("theory_", "anim_", "animation_", "game_"):
            if candidate.startswith(pre) and candidate[len(pre):] in real:
                return candidate[len(pre):]
        # 加前缀
        for pre in ("theory_", "anim_", "game_"):
            if (pre + candidate) in real:
                return pre + candidate
        return None

    for s in slides:
        kind = s.get("kind")
        payload = s.get("payload") or {}
        if kind == "theory":
            tid = payload.get("theory_id")
            fixed = _match(tid, real_theory_ids)
            if fixed and fixed != tid:
                payload["theory_id"] = fixed
        elif kind in ("animation", "game"):
            iid = payload.get("idea_id")
            fixed = _match(iid, real_idea_ids, topic_to_idea)
            if fixed and fixed != iid:
                payload["idea_id"] = fixed
        s["payload"] = payload
    return slides


def _validate_slides(slides: list[dict], theories: list[dict], ideas: list[dict]) -> list[str]:
    """soft 校验, 返回错误清单 (字符串)。"""
    errs: list[str] = []
    if not slides:
        return ["slides 列表为空"]

    if slides[0].get("kind") != "intro":
        errs.append(f"第一张必须 intro, 实际是 {slides[0].get('kind')}")
    if slides[-1].get("kind") != "outro":
        errs.append(f"最后一张必须 outro, 实际是 {slides[-1].get('kind')}")

    # theory / anim / game 覆盖
    theory_ids = {t.get("theory_id") for t in theories if t.get("theory_id")}
    anim_ids = {i.get("idea_id") for i in ideas if i.get("mode") == "animation"}
    game_ids = {i.get("idea_id") for i in ideas if i.get("mode") == "game"}

    covered_theory: set[str] = set()
    covered_anim: set[str] = set()
    covered_game: set[str] = set()
    for s in slides:
        kind = s.get("kind")
        payload = s.get("payload") or {}
        if kind == "theory":
            tid = payload.get("theory_id")
            if tid:
                covered_theory.add(tid)
        elif kind == "animation":
            iid = payload.get("idea_id")
            if iid:
                covered_anim.add(iid)
        elif kind == "game":
            iid = payload.get("idea_id")
            if iid:
                covered_game.add(iid)

    miss_t = theory_ids - covered_theory
    miss_a = anim_ids - covered_anim
    miss_g = game_ids - covered_game
    if miss_t:
        errs.append(f"theory 未覆盖: {miss_t}")
    if miss_a:
        errs.append(f"animation 未覆盖: {miss_a}")
    if miss_g:
        errs.append(f"game 未覆盖: {miss_g}")

    # 每个 slide 必须有 audio_script
    for i, s in enumerate(slides):
        sid = s.get("slide_id", f"slide_{i}")
        if not (s.get("audio_script") or "").strip():
            errs.append(f"slide {i} ({sid}) 缺 audio_script")
        elif len(s["audio_script"]) < 30:
            errs.append(f"slide {i} ({sid}) audio_script 过短 (<30 字)")

    return errs


async def generate_slides_for_knode(
    *,
    workspace: Path,
    module_id: str,
    knode_dir: str,
    tree_module: dict,
    project_age_band: str,
) -> tuple[list[dict], list[str]]:
    """为单个 knode 生成 slides。返回 (slides, validation_errors)。"""
    kdir = workspace / knode_dir
    plan_markdown = _read_text(kdir / "lesson.md")
    sections = _read_json(kdir / "sections.json", default={})
    theories = _read_json(kdir / "theories.json", default=[])

    ideas = sections.get("ideas") or []
    rendered = sections.get("rendered_sections") or {}
    ext = sections.get("external_resources") or {}

    youtube = ext.get("youtube_results") or []
    web = ext.get("web_results") or []
    labxchange = ext.get("labxchange_results") or []

    # age_band 格式 "10-12"
    age_min, age_max = 10, 15
    if project_age_band and "-" in project_age_band:
        try:
            a, b = project_age_band.split("-", 1)
            age_min, age_max = int(a.strip()), int(b.strip())
        except Exception:
            pass

    title = tree_module.get("title", "")
    core_question = tree_module.get("core_question", "") or "(无)"
    acceptance = tree_module.get("acceptance_standard") or []
    if isinstance(acceptance, str):
        acceptance = [acceptance]
    hands_on = tree_module.get("hands_on_components") or []

    template = PROMPT_PATH.read_text(encoding="utf-8")
    prompt = (
        template.replace("{node_title}", title)
        .replace("{core_question}", core_question)
        .replace("{acceptance_summary}", _format_list(acceptance))
        .replace("{hands_on_summary}", _format_list(hands_on))
        .replace("{age_min}", str(age_min))
        .replace("{age_max}", str(age_max))
        .replace("{plan_markdown}", plan_markdown[:6000])
        .replace("{theories_count}", str(len(theories)))
        .replace("{theories_block}", _format_theories(theories))
        .replace("{ideas_block}", _format_ideas(ideas, rendered))
        .replace("{youtube_count}", str(len(youtube)))
        .replace("{web_count}", str(len(web)))
        .replace("{labxchange_count}", str(len(labxchange)))
    )

    log.info(
        "[%s] LLM: theories=%d ideas=%d yt=%d lx=%d prompt_chars=%d",
        module_id,
        len(theories),
        len(ideas),
        len(youtube),
        len(labxchange),
        len(prompt),
    )
    t0 = time.time()
    llm = llm_for("fast", streaming=False, max_tokens=16384)
    raw = await ainvoke(
        llm, [{"role": "user", "content": prompt}], label=f"slide_gen[{module_id}]"
    )
    elapsed = time.time() - t0
    log.info("[%s] LLM done in %.1fs, raw_chars=%d", module_id, elapsed, len(raw or ""))

    slides = _parse_slides_json(raw or "")
    if not slides:
        log.error("[%s] parse 空, raw head=%r", module_id, (raw or "")[:300])
        return [], ["LLM 输出无法解析为 JSON 数组"]

    slides = _enrich_payloads(slides, ideas, rendered, ext)
    slides = _normalize_ids(slides, theories, ideas)
    errs = _validate_slides(slides, theories, ideas)
    return slides, errs


def _write_slides(workspace: Path, knode_dir: str, slides: list[dict]) -> Path:
    out = workspace / knode_dir / "slides.json"
    out.write_text(
        json.dumps({"slides": slides}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return out


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def _load_project_meta(workspace: Path) -> tuple[dict, list[dict], str]:
    """返回 (manifest, tree_modules, age_band)。"""
    manifest = _read_json(workspace / "manifest.json", default={})
    if not manifest:
        raise SystemExit(f"manifest.json 不存在: {workspace}")
    tree = _read_json(workspace / "tree" / "knowledge_tree.json", default={})
    modules = tree.get("modules") or []
    age_band = (manifest.get("frontmatter") or {}).get("age_band") or ""
    return manifest, modules, age_band


async def _run(args: argparse.Namespace) -> int:
    workspace = Path(args.workspace).resolve()
    if not workspace.exists():
        log.error("workspace 不存在: %s", workspace)
        return 2

    manifest, tree_modules, age_band = _load_project_meta(workspace)
    knodes_meta = {k["module_id"]: k for k in manifest.get("knodes", [])}
    tree_by_id = {m["module_id"]: m for m in tree_modules}

    if args.all:
        targets = sorted(knodes_meta.keys(), key=lambda x: (len(x), x))
    elif args.module:
        targets = [args.module]
    else:
        log.error("必须指定 --module M01 或 --all")
        return 2

    log.info("准备处理 %d 个 knode", len(targets))
    summary: list[tuple[str, str, list[str]]] = []

    for mid in targets:
        kmeta = knodes_meta.get(mid)
        tmeta = tree_by_id.get(mid)
        if not kmeta or not tmeta:
            log.warning("[%s] 跳过, manifest/tree 缺失", mid)
            summary.append((mid, "skip-missing-meta", []))
            continue
        kdir = kmeta["knode_dir"]
        slides_path = workspace / kdir / "slides.json"
        if args.skip_existing and slides_path.exists():
            log.info("[%s] 跳过, slides.json 已存在: %s", mid, slides_path)
            summary.append((mid, "skip-existing", []))
            continue

        try:
            slides, errs = await generate_slides_for_knode(
                workspace=workspace,
                module_id=mid,
                knode_dir=kdir,
                tree_module=tmeta,
                project_age_band=age_band,
            )
        except Exception as exc:
            log.exception("[%s] 生成失败: %s", mid, exc)
            summary.append((mid, f"error: {exc}", []))
            continue

        if not slides:
            log.error("[%s] slides 为空, 跳过写盘. errs=%s", mid, errs)
            summary.append((mid, "empty", errs))
            continue

        out = _write_slides(workspace, kdir, slides)
        status = "ok" if not errs else "ok-with-warns"
        log.info(
            "[%s] 写盘 %s | %d slides | errs=%d",
            mid,
            out.relative_to(workspace),
            len(slides),
            len(errs),
        )
        if errs:
            for e in errs:
                log.warning("[%s]   - %s", mid, e)
        summary.append((mid, status, errs))

    # 汇总
    log.info("=== 汇总 ===")
    for mid, status, errs in summary:
        log.info("%s: %s (errs=%d)", mid, status, len(errs))

    fail = [m for m, s, _ in summary if s not in ("ok", "ok-with-warns", "skip-existing")]
    return 0 if not fail else 1


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workspace", required=True, help="项目 workspace 目录 (含 manifest.json / tree/ / knodes/)")
    g = parser.add_mutually_exclusive_group(required=True)
    g.add_argument("--module", help="单个 knode module_id, 如 M01")
    g.add_argument("--all", action="store_true", help="处理所有 knode")
    parser.add_argument("--skip-existing", action="store_true", help="跳过已有 slides.json")
    args = parser.parse_args()
    return asyncio.run(_run(args))


if __name__ == "__main__":
    sys.exit(main())
