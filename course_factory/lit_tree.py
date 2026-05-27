"""项目知识树点亮 CLI (spec 035 T2).

用法:
    python -m course_factory.lit_tree <slug>

机制:
- 加载 workspace 项目 (manifest + 所有 knode 的 sections.json/theories.json/lesson.md)
- 加载 platform_tree.json
- dispatch agent (Claude API direct call) 跑 lit-mapper prompt
- 解析返回 JSON, 写入 manifest.json.lit_nodes / missing_concepts
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from systemedu.core.llm_client import get_llm

from course_factory.knowledge_tree import load_platform_tree

REPO_ROOT = Path(__file__).resolve().parent.parent
WORKSPACE = REPO_ROOT / "content-workspace"
GENERATED = WORKSPACE / "generated"
PROMPT_PATH = REPO_ROOT / "course_factory" / "prompts" / "lit_mapper.md"


def _load_project_corpus(slug: str) -> str:
    """串接项目所有 knode 内容为 corpus 文本."""
    proj_dir = GENERATED / slug
    if not proj_dir.exists():
        raise FileNotFoundError(f"project not found: {proj_dir}")

    tree_path = proj_dir / "tree" / "knowledge_tree.json"
    tree = json.loads(tree_path.read_text(encoding="utf-8"))
    modules = sorted(tree.get("modules", []), key=lambda m: m.get("sequence_order", 0))

    knodes_dir = proj_dir / "knodes"
    parts: list[str] = []

    for m in modules:
        mid = m.get("module_id", "")
        # 找匹配的 knode 目录
        dirs = [d for d in knodes_dir.iterdir() if d.is_dir() and d.name.startswith(f"{mid}-")]
        if not dirs:
            continue
        d = dirs[0]

        title = m.get("title", "")
        core_q = m.get("core_question", "")
        key_concepts = m.get("generation_guide", {}).get("key_concepts", [])

        # 读 lesson.md (plan_md 渲染版)
        lesson_path = d / "lesson.md"
        plan_md = lesson_path.read_text(encoding="utf-8") if lesson_path.exists() else ""

        # 读 theories.json (取 title + K1 + K3 摘要)
        theories_path = d / "theories.json"
        theories_brief = []
        if theories_path.exists():
            theories = json.loads(theories_path.read_text(encoding="utf-8"))
            for t in theories:
                t_title = t.get("title", "")
                bodies = {b.get("level"): b.get("body_markdown", "")[:600]
                          for b in t.get("level_bodies", [])}
                theories_brief.append({
                    "title": t_title,
                    "K1": bodies.get("K1", ""),
                    "K3": bodies.get("K3", ""),
                })

        parts.append(f"<knode id=\"{mid}\">")
        parts.append(f"<title>{title}</title>")
        parts.append(f"<core_question>{core_q}</core_question>")
        parts.append(f"<key_concepts>{json.dumps(key_concepts, ensure_ascii=False)}</key_concepts>")
        parts.append(f"<plan_md>{plan_md}</plan_md>")
        parts.append(f"<theories>{json.dumps(theories_brief, ensure_ascii=False)}</theories>")
        parts.append("</knode>")
        parts.append("")

    return "\n".join(parts)


def _run_agent(corpus: str, platform_tree_json: str, provider: str = "claude") -> dict:
    """跑 lit-mapper agent, 返回解析后的 JSON dict."""
    system_prompt = PROMPT_PATH.read_text(encoding="utf-8")

    user_msg = (
        "## PROJECT_CORPUS\n\n"
        f"{corpus}\n\n"
        "## PLATFORM_TREE\n\n"
        f"```json\n{platform_tree_json}\n```\n\n"
        "现在按 system prompt 指示, 输出严格 JSON (不要 markdown 包裹)."
    )

    llm = get_llm(provider=provider, streaming=False, temperature=0.2)
    response = llm.invoke([
        ("system", system_prompt),
        ("user", user_msg),
    ])
    text = response.content if hasattr(response, "content") else str(response)

    # 容错: 去掉 markdown ```json 包裹
    text = text.strip()
    if text.startswith("```"):
        # 去 ```json ... ```
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

    return json.loads(text)


def lit_project(slug: str, provider: str = "claude", dry_run: bool = False) -> dict:
    """点亮项目 → 写 manifest.lit_nodes / missing_concepts."""
    print(f"[lit_tree] loading project corpus: {slug}")
    corpus = _load_project_corpus(slug)
    print(f"[lit_tree] corpus size: {len(corpus)} chars")

    print(f"[lit_tree] loading platform tree...")
    platform_tree = load_platform_tree()
    platform_tree_json = json.dumps(platform_tree.model_dump(), ensure_ascii=False)
    print(f"[lit_tree] platform tree: {platform_tree.total_node_count()} nodes")

    print(f"[lit_tree] dispatching agent (provider={provider})...")
    result = _run_agent(corpus, platform_tree_json, provider=provider)

    lit_nodes = result.get("lit_nodes", [])
    missing = result.get("missing_concepts", [])
    print(f"[lit_tree] ← {len(lit_nodes)} lit nodes / {len(missing)} missing concepts")

    # 校验所有 node_id 在 platform tree 里存在
    all_ids = {n.id for s in platform_tree.subjects for n in s.nodes}
    valid_lit = [n for n in lit_nodes if n.get("node_id") in all_ids]
    invalid_lit = [n for n in lit_nodes if n.get("node_id") not in all_ids]
    if invalid_lit:
        print(f"[lit_tree] WARN: {len(invalid_lit)} lit_nodes 引用了不存在的 node_id, 丢弃:")
        for n in invalid_lit[:5]:
            print(f"  - {n.get('node_id')}")

    if dry_run:
        print(f"[lit_tree] DRY RUN — not writing manifest")
        return {"lit_nodes": valid_lit, "missing_concepts": missing}

    # 写 manifest.json
    manifest_path = GENERATED / slug / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["lit_nodes"] = valid_lit
    manifest["missing_concepts"] = missing
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[lit_tree] ✓ written: {manifest_path}")
    return {"lit_nodes": valid_lit, "missing_concepts": missing}


def main() -> int:
    ap = argparse.ArgumentParser(description="SystemEdu project knowledge-tree lit mapper")
    ap.add_argument("slug", help="项目 slug")
    ap.add_argument("--provider", default="claude", help="LLM provider (default: claude)")
    ap.add_argument("--dry-run", action="store_true", help="只跑不写 manifest")
    args = ap.parse_args()

    try:
        result = lit_project(args.slug, provider=args.provider, dry_run=args.dry_run)
        print(f"\nSummary:")
        print(f"  lit_nodes: {len(result['lit_nodes'])}")
        print(f"  missing_concepts: {len(result['missing_concepts'])}")
        return 0
    except Exception as e:
        print(f"[lit_tree] ERROR: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
