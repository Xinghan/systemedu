"""Learner QC CLI (spec 035 T3).

用法:
    python -m course_factory.learner_qc <slug>
    python -m course_factory.learner_qc <slug> --persona 13-15

机制:
- 加载 workspace 项目, 取 frontmatter.age_band → 选 persona
- 串接 M01..MN 内容
- dispatch learner-simulator agent (持续 prompt 单次跑)
- 写报告到 content-workspace/_review/<slug>_learner_report.md
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from systemedu.core.llm_client import get_llm

REPO_ROOT = Path(__file__).resolve().parent.parent
WORKSPACE = REPO_ROOT / "content-workspace"
GENERATED = WORKSPACE / "generated"
PROMPT_PATH = REPO_ROOT / "course_factory" / "prompts" / "learner_simulator.md"
PERSONAS_DIR = REPO_ROOT / "course_factory" / "personas"


def _pick_persona(age_band: str | None, override: str | None = None) -> tuple[str, str]:
    """根据 age_band 选 persona, 返回 (persona_id, persona_text)."""
    band = (override or age_band or "").strip()
    if "10" in band or "11" in band or "12" in band:
        pid = "10-12"
    elif "13" in band or "14" in band or "15" in band:
        pid = "13-15"
    elif "16" in band or "17" in band or "18" in band:
        pid = "16-18"
    else:
        # 默认中段
        pid = "13-15"
    fname = f"persona_{pid.replace('-', '_')}.md"
    p = PERSONAS_DIR / fname
    if not p.exists():
        raise FileNotFoundError(f"persona file missing: {p}")
    return pid, p.read_text(encoding="utf-8")


def _load_corpus(slug: str) -> tuple[str, list[str]]:
    """串项目所有 knode 内容, 返回 (corpus 文本, 模块 ID 列表)."""
    proj_dir = GENERATED / slug
    if not proj_dir.exists():
        raise FileNotFoundError(f"project not found: {proj_dir}")

    tree_path = proj_dir / "tree" / "knowledge_tree.json"
    tree = json.loads(tree_path.read_text(encoding="utf-8"))
    modules = sorted(tree.get("modules", []), key=lambda m: m.get("sequence_order", 0))

    knodes_dir = proj_dir / "knodes"
    parts: list[str] = []
    module_ids: list[str] = []

    for m in modules:
        mid = m.get("module_id", "")
        dirs = [d for d in knodes_dir.iterdir() if d.is_dir() and d.name.startswith(f"{mid}-")]
        if not dirs:
            continue
        d = dirs[0]

        module_ids.append(mid)
        title = m.get("title", "")
        core_q = m.get("core_question", "")

        lesson_path = d / "lesson.md"
        lesson = lesson_path.read_text(encoding="utf-8") if lesson_path.exists() else ""

        theories_path = d / "theories.json"
        theories_text = ""
        if theories_path.exists():
            theories = json.loads(theories_path.read_text(encoding="utf-8"))
            for t in theories:
                theories_text += f"\n### theory: {t.get('title','')}\n"
                for b in t.get("level_bodies", []):
                    theories_text += f"\n#### {b.get('level','')}\n{b.get('body_markdown','')}\n"

        assignment_path = d / "assignment.md"
        assignment = assignment_path.read_text(encoding="utf-8") if assignment_path.exists() else ""

        parts.append(f"# {mid}: {title}\n")
        parts.append(f"**核心问题**: {core_q}\n")
        parts.append(f"## 学习内容 (lesson)\n\n{lesson}\n")
        if theories_text:
            parts.append(f"## 理论详解\n{theories_text}\n")
        if assignment:
            parts.append(f"## 作业 (assignment)\n\n{assignment}\n")
        parts.append("\n---\n")

    return "\n".join(parts), module_ids


def _strip_md_wrap(text: str) -> str:
    """去掉 ```markdown ... ``` 外包裹."""
    text = text.strip()
    if text.startswith("```"):
        # 去首尾的 ```
        text = re.sub(r"^```(?:markdown|md)?\n", "", text)
        text = re.sub(r"\n```\s*$", "", text)
    return text


def _run_agent(persona_text: str, corpus: str, provider: str = "claude") -> str:
    """跑 learner-simulator agent, 返回完整 markdown 报告."""
    system_template = PROMPT_PATH.read_text(encoding="utf-8")
    system_prompt = system_template.replace("{{PERSONA_BLOCK}}", persona_text)

    user_msg = (
        "下面是项目全部 N 节内容, 按 M01→MN 顺序串接. 请按 system prompt 指示输出反思报告 (markdown).\n\n"
        f"{corpus}"
    )

    llm = get_llm(provider=provider, streaming=False, temperature=0.4)
    response = llm.invoke([
        ("system", system_prompt),
        ("user", user_msg),
    ])
    text = response.content if hasattr(response, "content") else str(response)
    return _strip_md_wrap(text)


def run_qc(slug: str, persona_override: str | None = None, provider: str = "claude") -> Path:
    """跑 learner QC → 写报告, 返回报告路径."""
    print(f"[learner_qc] loading project: {slug}")
    manifest = json.loads((GENERATED / slug / "manifest.json").read_text(encoding="utf-8"))
    age_band = manifest.get("frontmatter", {}).get("age_band")
    pid, persona_text = _pick_persona(age_band, persona_override)
    print(f"[learner_qc] persona: {pid} (age_band={age_band})")

    corpus, module_ids = _load_corpus(slug)
    print(f"[learner_qc] corpus size: {len(corpus)} chars, modules: {len(module_ids)}")

    print(f"[learner_qc] dispatching agent (provider={provider}, may take 3-8 min)...")
    report = _run_agent(persona_text, corpus, provider=provider)

    # 写报告
    out_dir = WORKSPACE / "_review"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{slug}_learner_report.md"
    out_path.write_text(report, encoding="utf-8")
    print(f"[learner_qc] ✓ written: {out_path} ({len(report)} chars)")
    return out_path


def main() -> int:
    ap = argparse.ArgumentParser(description="SystemEdu learner QC")
    ap.add_argument("slug", help="项目 slug")
    ap.add_argument("--persona", help="覆盖 persona (10-12 / 13-15 / 16-18)")
    ap.add_argument("--provider", default="claude", help="LLM provider")
    args = ap.parse_args()

    try:
        run_qc(args.slug, persona_override=args.persona, provider=args.provider)
        return 0
    except Exception as e:
        print(f"[learner_qc] ERROR: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
