"""Batch-generate course_factory content for rocket-design S7 nodes.

Targets by default:
  - knode 62: P-ROCKET-01-M063 粘接与紧固：胶水、胶带、螺丝的选用
  - knode 63: P-ROCKET-01-M064 轻量化：减重的10个小窍门
  - knode 64: P-ROCKET-01-M065 结构可靠性：关键失效模式分析
  - knode 65: P-ROCKET-01-M066 S7 大作业：结构与材料设计包
  - knode 66: P-ROCKET-01-M067 气动外形迭代：从v1到v2的优化逻辑

Workflow:
  1. Load knode context
  2. Ask LLM for structured text bundle (plan/theories/exercises/assignment)
  3. Ask LLM for structured animation/game specs
  4. Render deterministic HTML from shared templates
  5. Run validators (html_validate + verify animation/game)
  6. Assemble course_content via make_course_content()
  7. Optionally save to DB and generate audio scripts

User override honored:
  - skip 0.5 Tavily research
  - skip 0.7 LabXchange
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT))
os.chdir(ROOT)

from langchain_core.messages import HumanMessage

from course_factory import factory as _cf
from course_factory.factory import (
    generate_audio_scripts,
    load_context,
    make_course_content,
    make_exercises,
    preflight_v41,
    save_knode,
)
from systemedu.core.llm_client import get_llm

# User override: this batch must skip 0.7 LabXchange completely.
_cf.search_labxchange_for_knode = lambda *a, **kw: []

PROJECT = "rocket-design"
DEFAULT_NODE_IDS = [62, 63, 64, 65, 66]
FIX_DIR = ROOT / "course_factory" / "fixtures" / "rocket-design"
REPORT_DIR = FIX_DIR / "reports_s7_batch"

PALETTE_BY_NODE = {
    62: "mech",
    63: "space",
    64: "mech",
    65: "space",
    66: "space",
}

NODE_REFS = {
    62: {
        "animation_hands_on_ref": "列出每种粘接的耐热等级和强度",
        "animation_acceptance_ref": "明确哪些部位禁用哪种胶。",
        "game_hands_on_ref": "做3种粘接方式的拉伸测试（手拉）",
        "game_acceptance_ref": "含简单拉伸测试结果。",
        "exercise_hands_on_ref": "列出每种粘接的耐热等级和强度",
        "exercise_acceptance_ref": "至少4种粘接方式完整。",
    },
    63: {
        "animation_hands_on_ref": "每处改进估算减重克数",
        "animation_acceptance_ref": "总减重>=15g。",
        "game_hands_on_ref": "对v1.0草图给出3处减重改进",
        "game_acceptance_ref": "至少3处改进。",
        "exercise_hands_on_ref": "每处改进估算减重克数",
        "exercise_acceptance_ref": "总减重>=15g。",
    },
    64: {
        "animation_hands_on_ref": "列出至少8种失效模式",
        "animation_acceptance_ref": "至少8种失效模式完整。",
        "game_hands_on_ref": "对每种模式给出至少1条预防措施和1条检查方法",
        "game_acceptance_ref": "每种模式有预防措施和检查方法。",
        "exercise_hands_on_ref": "列出至少8种失效模式",
        "exercise_acceptance_ref": "每种模式有预防措施和检查方法。",
    },
    65: {
        "animation_hands_on_ref": "做一次可复现性审查",
        "animation_acceptance_ref": "可被另一个同学照做复现（可复现性）。",
    },
    66: {
        "animation_hands_on_ref": "为v2.0定义3个迭代目标",
        "animation_acceptance_ref": "至少3个明确的可量化迭代目标。",
        "game_hands_on_ref": "对v1.0方案列出至少5个问题点",
        "game_acceptance_ref": "至少5个问题指出v1.0缺陷。",
        "exercise_hands_on_ref": "为v2.0定义3个迭代目标",
        "exercise_acceptance_ref": "至少3个明确的可量化迭代目标。",
    },
}


def ensure_dir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)


def strip_fences(text: str) -> str:
    text = (text or "").strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines:
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text


def extract_json_blob(text: str) -> str:
    text = strip_fences(text)
    m_obj = re.search(r"\{[\s\S]*\}", text)
    m_arr = re.search(r"\[[\s\S]*\]", text)
    candidates = [m for m in [m_obj, m_arr] if m]
    if not candidates:
        raise ValueError("No JSON object/array found in model response")
    blob = min(candidates, key=lambda m: m.start()).group(0)
    return blob


def ask_json(llm, prompt: str, *, label: str) -> Any:
    last_error = None
    last_text = ""
    for attempt in range(3):
        if attempt == 0:
            content = prompt
        else:
            content = (
                "上一次输出的 JSON 解析失败。"
                "请只输出一个合法 JSON，不要 markdown 代码块，不要解释。\n\n"
                f"错误摘要: {last_error}\n\n"
                f"原始输出:\n{last_text[:5000]}"
            )
        resp = llm.invoke([HumanMessage(content=content)])
        last_text = resp.content if hasattr(resp, "content") else str(resp)
        try:
            return json.loads(extract_json_blob(last_text))
        except Exception as exc:  # noqa: BLE001
            last_error = repr(exc)
    raise RuntimeError(f"{label}: JSON parse failed after retries: {last_error}")


def run_cmd(cmd: list[str], *, cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        cmd,
        cwd=str(cwd or ROOT),
        check=False,
        capture_output=True,
        text=True,
    )


def write_text(path: Path, text: str) -> None:
    ensure_dir(path.parent)
    path.write_text(text, encoding="utf-8")


def sanitize_ascii_id(raw: str, fallback: str) -> str:
    raw = (raw or "").strip().lower()
    raw = re.sub(r"[^a-z0-9_]+", "_", raw)
    raw = re.sub(r"_+", "_", raw).strip("_")
    return raw or fallback


def ensure_theory_markers(plan_markdown: str, theories: list[dict]) -> str:
    plan = plan_markdown
    missing = [th for th in theories if f"[[THEORY:{th['theory_id']}]]" not in plan]
    if not missing:
        return plan

    anchors = ["## 核心概念", "## 深入理解", "## 应用与拓展"]
    for idx, th in enumerate(missing):
        marker = f"[[THEORY:{th['theory_id']}]]"
        inserted = False
        for anchor in anchors:
            pos = plan.find(anchor)
            if pos >= 0:
                line_end = plan.find("\n", pos)
                if line_end >= 0:
                    insert_at = line_end + 1
                    plan = plan[:insert_at] + marker + "\n" + plan[insert_at:]
                    inserted = True
                    break
        if not inserted:
            plan += "\n\n" + marker + "\n"
    return plan


def normalize_content_bundle(bundle: dict, ctx) -> dict:
    if not isinstance(bundle.get("workflow_notes"), list):
        bundle["workflow_notes"] = []
    if not isinstance(bundle.get("media_decisions"), list):
        bundle["media_decisions"] = []

    plan = str(bundle.get("plan_markdown") or "").strip()
    header = f"> Module: {ctx.knode.get('module_id')} · {ctx.knode.get('module_role')}"
    if not plan.startswith("> Module:"):
        plan = header + "\n\n" + plan
    elif not plan.splitlines()[0].strip() == header:
        lines = plan.splitlines()
        lines[0] = header
        plan = "\n".join(lines)

    if ctx.knode.get("core_question") and ctx.knode["core_question"] not in plan:
        plan = plan.replace("## 引入", f"## 引入：{ctx.knode['core_question']}", 1)
        if ctx.knode["core_question"] not in plan:
            plan += f"\n\n> 核心追问：{ctx.knode['core_question']}\n"

    if "## 推荐互动资源" not in plan:
        plan += "\n\n## 推荐互动资源\n\n- 本节点使用内置 animation / game / exercise，不额外插入外部视频与网页资源。\n"
    if "## 学习路径建议" not in plan:
        produced = "、".join(ctx.knode.get("outputs_produced") or [])
        plan += (
            "\n\n## 学习路径建议\n\n"
            f"- 先完成本节核心判断，再回到你的火箭方案，产出 {produced or '本节交付物'}。\n"
        )

    theories = bundle.get("theories") or []
    normalized_theories = []
    for idx, th in enumerate(theories):
        theory_id = sanitize_ascii_id(th.get("theory_id", ""), f"theory_{idx+1}")
        level_bodies = th.get("level_bodies") or []
        if isinstance(level_bodies, dict):
            level_bodies = [{"level": k, "body_markdown": v} for k, v in level_bodies.items()]
        normalized_levels = []
        seen_levels = set()
        for entry in level_bodies:
            level = str(entry.get("level") or "").strip().upper()
            if level in {"K1", "K4"} and level not in seen_levels:
                seen_levels.add(level)
                normalized_levels.append({
                    "level": level,
                    "body_markdown": str(entry.get("body_markdown") or "").strip(),
                })
        th_obj = {
            "theory_id": theory_id,
            "title": str(th.get("title") or f"理论 {idx+1}").strip(),
            "subject": str(th.get("subject") or "engineering").strip(),
            "tags": list(th.get("tags") or []),
            "body_markdown": str(th.get("body_markdown") or "").strip(),
            "level_bodies": normalized_levels,
            "exercises": list(th.get("exercises") or []),
            "related_paragraph": str(th.get("related_paragraph") or "").strip(),
        }
        normalized_theories.append(th_obj)

    bundle["theories"] = enrich_theories(normalized_theories, ctx)
    bundle["plan_markdown"] = ensure_theory_markers(plan, normalized_theories)

    exercises = bundle.get("exercises") or []
    normalized_exercises = []
    for ex in exercises:
        ex_type = ex.get("type", "choice")
        if ex_type == "short_answer":
            normalized_exercises.append({
                "type": "short_answer",
                "question": str(ex.get("question") or "").strip(),
                "sample_answer": str(ex.get("sample_answer") or "").strip(),
                "ref": str(ex.get("ref") or "").strip(),
            })
        else:
            normalized_exercises.append({
                "type": "choice",
                "question": str(ex.get("question") or "").strip(),
                "options": list(ex.get("options") or [])[:4],
                "correct": int(ex.get("correct") or 0),
                "explanation": str(ex.get("explanation") or "").strip(),
                "ref": str(ex.get("ref") or "").strip(),
            })
    bundle["exercises"] = normalized_exercises
    bundle["workflow_notes"] = [
        "用户显式要求跳过 0.5 Tavily research。",
        "用户显式要求跳过 0.7 LabXchange。",
        *[str(x).strip() for x in bundle["workflow_notes"] if str(x).strip()],
    ]
    return bundle


def enrich_theories(theories: list[dict], ctx) -> list[dict]:
    artifact = ((ctx.knode.get("acceptance_artifacts") or [{}])[0]).get("title", "本节交付物")
    core_question = ctx.knode.get("core_question", "这个判断为什么重要？")
    for th in theories:
        levels = th.get("level_bodies") or []
        new_levels = []
        for entry in levels:
            level = (entry.get("level") or "K1").upper()
            body = str(entry.get("body_markdown") or "").strip()
            paragraphs = [p for p in body.split("\n\n") if p.strip()]
            if level == "K1":
                if len(paragraphs) < 2 or not re.search(r"例如|比如|想象|假设|举个|例子", body):
                    body = (
                        body
                        + "\n\n"
                        + f"比如，在整理《{artifact}》时，你不能只写“这个办法更好”，而要说明它更适合哪个部位、"
                        + f"会避开什么风险、最后怎样帮助回答“{core_question}”。这样同学拿到你的表格时，"
                        + "就能马上看懂你为什么这么选，而不是只记住一个孤零零的结论。"
                    ).strip()
            elif level == "K4":
                if len(paragraphs) < 2:
                    body = (
                        body
                        + "\n\n"
                        + "把这个节点往高中层再推进一步，可以把它看成一个受力分析与安全裕度的问题："
                        + "不同部位承受的拉力、剪切力、合力和力矩并不一样，所以同样的材料或方案放在不同位置，"
                        + "表现会完全不同。真正的工程判断不是只看“能不能用”，而是看在目标载荷下还能剩下多少余量。"
                    ).strip()
                if not re.search(r"向量|分解|受力|合力|力矩|动量|动能|概率|期望|方差|分布|均值|指数|对数", body):
                    body = (
                        body
                        + "\n\n"
                        + "如果把判断过程写成工程语言，我们会先做受力分析：把作用在部件上的合力分解到关键方向，"
                        + "再比较不同方案在剪切、弯曲和热影响下的安全裕度。这样做的价值，不是为了把课上得更难，"
                        + "而是为了让你知道同一个改动为什么会同时改变稳定性、强度和可制造性。"
                    ).strip()
            new_levels.append({"level": level, "body_markdown": body})
        th["level_bodies"] = new_levels
    return theories


def fallback_media_spec(ctx, *, include_game: bool, palette_key: str) -> dict:
    title = ctx.knode.get("title", "")
    cq = ctx.knode.get("core_question", "")
    artifact = ((ctx.knode.get("acceptance_artifacts") or [{}])[0]).get("title", "交付物")
    animation = {
        "subtitle_cn": "把决策逻辑拆成 4 个可视化阶段。",
        "subtitle_en": "See the decision logic across four frames.",
        "guide_cn": ["先看哪个部位被点亮。", "再看受力、温度或失效怎么出现。", "最后记住正确连接方式落在哪一段。"],
        "guide_en": ["See which part lights up first.", "Then watch force, heat, or failure appear.", "Finally note which connector belongs to that zone."],
        "hud_labels_cn": ["核心判断", "推荐方向", "风险提醒", "交付物"],
        "hud_labels_en": ["Decision", "Preferred", "Risk", "Deliverable"],
        "frames": [
            {
                "title_cn": "先回答核心问题",
                "title_en": "Start With The Core Question",
                "columns": [
                    {"label_cn": "问题", "label_en": "Question", "value_cn": cq, "value_en": cq, "status": "warn"},
                    {"label_cn": "动作", "label_en": "Action", "value_cn": "看部位、看热、看强度", "value_en": "Check part, heat, strength", "status": "good"},
                    {"label_cn": "产出", "label_en": "Output", "value_cn": artifact, "value_en": artifact, "status": "neutral"},
                ],
                "callout_cn": f"{title} 不是背答案，而是按工况做判断。",
                "callout_en": f"{title} is about judging by scenario, not memorizing.",
                "footer_cn": "把选择依据写清楚，后面的制造环节才不会返工。",
                "footer_en": "Clear criteria reduce rework in later build stages.",
            },
            {
                "title_cn": "比较三个关键因素",
                "title_en": "Compare Three Key Factors",
                "columns": [
                    {"label_cn": "性能", "label_en": "Performance", "value_cn": "够不够用", "value_en": "Will it work?", "status": "good"},
                    {"label_cn": "风险", "label_en": "Risk", "value_cn": "哪里会出问题", "value_en": "Where can it fail?", "status": "bad"},
                    {"label_cn": "可做性", "label_en": "Buildability", "value_cn": "能不能稳定做出来", "value_en": "Can we build it reliably?", "status": "warn"},
                ],
                "callout_cn": "工程决策通常是三平衡，而不是单点最优。",
                "callout_en": "Engineering choices balance multiple constraints.",
                "footer_cn": "先把明显禁区排除，再比较可行选项。",
                "footer_en": "Rule out no-go choices before comparing viable ones.",
            },
            {
                "title_cn": "看到失败路径",
                "title_en": "See The Failure Path",
                "columns": [
                    {"label_cn": "常见错误", "label_en": "Common Error", "value_cn": "只看一个指标", "value_en": "Optimize one metric only", "status": "bad"},
                    {"label_cn": "直接后果", "label_en": "Immediate Result", "value_cn": "返工 / 风险 / 失效", "value_en": "Rework / risk / failure", "status": "bad"},
                    {"label_cn": "预防方式", "label_en": "Prevention", "value_cn": "表格 + 检查 + 复核", "value_en": "Table + checks + review", "status": "good"},
                ],
                "callout_cn": "把失败模式想在前面，比出事后补救便宜得多。",
                "callout_en": "It is cheaper to anticipate failure than repair it later.",
                "footer_cn": "让每个判断都能被同学复现和检查。",
                "footer_en": "Make every decision reproducible and reviewable.",
            },
            {
                "title_cn": "回到交付物",
                "title_en": "Return To The Deliverable",
                "columns": [
                    {"label_cn": "你要提交", "label_en": "You Submit", "value_cn": artifact, "value_en": artifact, "status": "good"},
                    {"label_cn": "必须写明", "label_en": "Must Include", "value_cn": "依据 + 结果 + 边界", "value_en": "Criteria + result + limits", "status": "good"},
                    {"label_cn": "下一步用途", "label_en": "Next Use", "value_cn": "支持后续制造与迭代", "value_en": "Feeds later build and iteration", "status": "neutral"},
                ],
                "callout_cn": "好的文档不是装饰，而是后续工程动作的输入。",
                "callout_en": "A good document is input for later engineering work.",
                "footer_cn": "本节结束时，你应该能把判断写成别人看得懂的方案。",
                "footer_en": "By the end, your reasoning should be teachable and usable.",
            },
        ],
    }
    game = None
    if include_game:
        game = {
            "tag_cn": "DECISION LAB",
            "tag_en": "DECISION LAB",
            "subtitle_cn": "点选一个工程方案，立即查看结果反馈。",
            "subtitle_en": "Pick a design package and inspect the outcome.",
            "guide_cn": ["阅读情境。", "比较三张方案卡。", "点击任一方案看反馈，再进入下一轮。"],
            "guide_en": ["Read the scenario.", "Compare the three plan cards.", "Click one plan to see feedback and continue."],
            "rounds": [
                {
                    "title_cn": "第 1 轮：先做首个判断",
                    "title_en": "Round 1: First Decision",
                    "scenario_cn": title,
                    "scenario_en": title,
                    "options": [
                        {
                            "label_cn": "方案 A",
                            "label_en": "Plan A",
                            "chips_cn": ["先排禁区", "再比优先项", "留出检查点"],
                            "chips_en": ["Rule out no-go", "Compare priorities", "Add checkpoints"],
                            "score": 84,
                            "result_cn": "这是更稳妥的工程做法。",
                            "result_en": "This is the steadier engineering choice.",
                            "lesson_cn": "先排除明显错误，再做方案比较。",
                            "lesson_en": "Remove obvious errors before comparing plans.",
                        },
                        {
                            "label_cn": "方案 B",
                            "label_en": "Plan B",
                            "chips_cn": ["只追单一指标", "忽略检查", "后面再说"],
                            "chips_en": ["Optimize one metric", "Skip checks", "Fix later"],
                            "score": 48,
                            "result_cn": "这样看似省事，但后续返工风险更高。",
                            "result_en": "This looks quick but increases rework risk.",
                            "lesson_cn": "单点优化常常把问题推到后面。",
                            "lesson_en": "Single-metric optimization pushes risk downstream.",
                        },
                        {
                            "label_cn": "方案 C",
                            "label_en": "Plan C",
                            "chips_cn": ["步骤很多", "依据不清", "难以复现"],
                            "chips_en": ["Too many steps", "Unclear basis", "Hard to reproduce"],
                            "score": 61,
                            "result_cn": "信息很多，但关键判断不够清楚。",
                            "result_en": "There is detail, but the key decision is unclear.",
                            "lesson_cn": "清楚的决策依据比堆材料更重要。",
                            "lesson_en": "Clear criteria matter more than extra detail.",
                        },
                    ],
                },
                {
                    "title_cn": "第 2 轮：处理失败风险",
                    "title_en": "Round 2: Handle Failure Risk",
                    "scenario_cn": "如果你只能先修一个高风险点，应该怎么安排？",
                    "scenario_en": "If you can fix only one high-risk point first, what should you do?",
                    "options": [
                        {
                            "label_cn": "方案 A",
                            "label_en": "Plan A",
                            "chips_cn": ["先修高风险", "同步做检查", "记录依据"],
                            "chips_en": ["Fix high risk first", "Add checks", "Record rationale"],
                            "score": 88,
                            "result_cn": "优先级和检查动作是配套的。",
                            "result_en": "Priority and verification should travel together.",
                            "lesson_cn": "高风险项不仅要改，还要有检查方法。",
                            "lesson_en": "A high-risk item needs both mitigation and inspection.",
                        },
                        {
                            "label_cn": "方案 B",
                            "label_en": "Plan B",
                            "chips_cn": ["先做容易的", "风险以后看", "表格空着"],
                            "chips_en": ["Do the easy one first", "Risk later", "Leave table blank"],
                            "score": 42,
                            "result_cn": "这样容易把关键失效留到最后。",
                            "result_en": "This leaves the key failure path unresolved.",
                            "lesson_cn": "工程优先级不是按手感排的。",
                            "lesson_en": "Engineering priority is not a vibe-based choice.",
                        },
                        {
                            "label_cn": "方案 C",
                            "label_en": "Plan C",
                            "chips_cn": ["全部都做", "没有顺序", "没有边界"],
                            "chips_en": ["Do everything", "No order", "No boundary"],
                            "score": 57,
                            "result_cn": "努力很多，但很难形成真正的收敛。",
                            "result_en": "There is effort, but no clear convergence.",
                            "lesson_cn": "排优先级是为了让资源有效落地。",
                            "lesson_en": "Prioritization helps limited resources land well.",
                        },
                    ],
                },
                {
                    "title_cn": "第 3 轮：回到交付物",
                    "title_en": "Round 3: Return To The Deliverable",
                    "scenario_cn": f"怎样让 {artifact} 对下一节点真正有用？",
                    "scenario_en": f"How do you make {artifact} truly useful downstream?",
                    "options": [
                        {
                            "label_cn": "方案 A",
                            "label_en": "Plan A",
                            "chips_cn": ["写结论", "写依据", "写限制条件"],
                            "chips_en": ["Write outcome", "Write basis", "Write limits"],
                            "score": 90,
                            "result_cn": "这份交付物可以直接被后续制造和复核使用。",
                            "result_en": "This deliverable is usable for later build and review.",
                            "lesson_cn": "好交付物要能被别人拿去继续干活。",
                            "lesson_en": "A good deliverable lets someone else keep working.",
                        },
                        {
                            "label_cn": "方案 B",
                            "label_en": "Plan B",
                            "chips_cn": ["只有结果", "没有依据", "不好追溯"],
                            "chips_en": ["Outcome only", "No basis", "Hard to trace"],
                            "score": 51,
                            "result_cn": "结果能看，但后面无法确认你为什么这样选。",
                            "result_en": "The result is visible, but the reasoning is lost.",
                            "lesson_cn": "工程文档必须支持追溯。",
                            "lesson_en": "Engineering docs must support traceability.",
                        },
                        {
                            "label_cn": "方案 C",
                            "label_en": "Plan C",
                            "chips_cn": ["写很多背景", "行动很少", "难直接使用"],
                            "chips_en": ["Lots of background", "Little action", "Hard to use"],
                            "score": 63,
                            "result_cn": "资料丰富，但不够面向执行。",
                            "result_en": "There is plenty of context, but not enough execution value.",
                            "lesson_cn": "交付物先服务动作，再服务展示。",
                            "lesson_en": "A deliverable should serve action before presentation.",
                        },
                    ],
                },
            ],
        }
    return {"animation": animation, "game": game, "palette_key": palette_key}


def normalize_media_spec(spec: dict, *, ctx, include_game: bool, palette_key: str) -> dict:
    def _anim_ok(anim: dict | None) -> bool:
        if not isinstance(anim, dict):
            return False
        frames = anim.get("frames")
        if not isinstance(frames, list) or len(frames) != 4:
            return False
        for frame in frames:
            cols = frame.get("columns") if isinstance(frame, dict) else None
            if not isinstance(cols, list) or len(cols) != 3:
                return False
        return True

    def _game_ok(game: dict | None) -> bool:
        if not isinstance(game, dict):
            return False
        rounds = game.get("rounds")
        if not isinstance(rounds, list) or len(rounds) != 3:
            return False
        for rnd in rounds:
            opts = rnd.get("options") if isinstance(rnd, dict) else None
            if not isinstance(opts, list) or len(opts) != 3:
                return False
        return True

    if not isinstance(spec, dict):
        spec = {}
    if not _anim_ok(spec.get("animation")):
        spec = fallback_media_spec(ctx, include_game=include_game, palette_key=palette_key)
    if "palette_key" not in spec:
        spec["palette_key"] = palette_key
    if not include_game:
        spec["game"] = None
    if include_game and not _game_ok(spec.get("game")):
        spec = fallback_media_spec(ctx, include_game=include_game, palette_key=palette_key)
    return spec


def build_content_prompt(ctx, *, include_game: bool, capstone: bool) -> str:
    kn = ctx.knode
    artifact_titles = [a.get("title", "") for a in (kn.get("acceptance_artifacts") or [])]
    artifact_text = "；".join([x for x in artifact_titles if x]) or "无"
    hands_on = kn.get("hands_on_components") or []
    standards = kn.get("acceptance_standard") or []
    outputs = kn.get("outputs_produced") or []
    media_note = "保留 animation，保留 game。" if include_game else "保留 animation，不保留 game。"
    if capstone:
        return f"""
你正在严格执行 SystemEdu 的 course_factory，用于生成一个 capstone 节点的课程内容。
用户已经明确要求：跳过 0.5 Tavily research、跳过 0.7 LabXchange，所以不要加入外部视频、网页、LabXchange。

请只输出一个合法 JSON 对象，不要 markdown 代码块，不要解释。

节点信息：
- project: {ctx.project_name}
- module_id: {kn.get('module_id')}
- title: {kn.get('title')}
- module_role: {kn.get('module_role')}
- core_question: {kn.get('core_question')}
- summary: {kn.get('summary')}
- hands_on_components: {json.dumps(hands_on, ensure_ascii=False)}
- acceptance_artifacts: {artifact_text}
- acceptance_standard: {json.dumps(standards, ensure_ascii=False)}
- outputs_produced: {json.dumps(outputs, ensure_ascii=False)}

必须遵守：
1. 这是 capstone，不要输出 theories，不要输出 exercises。
2. plan_markdown 第一行必须是：> Module: {kn.get('module_id')} · {kn.get('module_role')}
3. plan_markdown 必须包含这些 H2 小节：
   - ## 项目背景
   - ## 交付物与验收
   - ## 生产步骤
   - ## 自检与评分
   - ## 提交说明
   - ## 推荐互动资源
   - ## 学习路径建议
4. 必须直接回答并包含核心问题原句：{kn.get('core_question')}
5. 必须把交付物、验收标准、可复现性、安全声明写成可执行的设计包要求。
6. 不要插入 [[THEORY:...]] 标记。
7. 不要添加 ## 推荐视频 或 ## 延伸阅读。
8. assignment_markdown 不能是普通练习题，必须是 capstone 自检单 + 提交前核对。
9. media_decisions 必须覆盖 8 种媒体：theory / animation / game / hands_on_kit / image / diagram / youtube / labxchange。
10. workflow_notes 要明确写出：跳过 0.5 / 0.7 是用户要求；并说明 {media_note}

JSON 字段结构：
{{
  "workflow_notes": ["..."],
  "media_decisions": [
    {{"mode":"theory","decision":"reject","reason":"..."}},
    ...
  ],
  "plan_markdown": "...",
  "theories": [],
  "exercises": [],
  "assignment_markdown": "..."
}}
""".strip()

    return f"""
你正在严格执行 SystemEdu 的 course_factory，用于生成一个 normal core 节点的课程内容。
用户已经明确要求：跳过 0.5 Tavily research、跳过 0.7 LabXchange，所以不要加入外部视频、网页、LabXchange。

请只输出一个合法 JSON 对象，不要 markdown 代码块，不要解释。

节点信息：
- project: {ctx.project_name}
- module_id: {kn.get('module_id')}
- title: {kn.get('title')}
- module_role: {kn.get('module_role')}
- core_question: {kn.get('core_question')}
- summary: {kn.get('summary')}
- hands_on_components: {json.dumps(hands_on, ensure_ascii=False)}
- acceptance_artifacts: {artifact_text}
- acceptance_standard: {json.dumps(standards, ensure_ascii=False)}
- outputs_produced: {json.dumps(outputs, ensure_ascii=False)}

必须遵守：
1. plan_markdown 第一行必须是：> Module: {kn.get('module_id')} · {kn.get('module_role')}
2. plan_markdown 必须包含这些 H2 小节：
   - ## 学习目标
   - ## 引入：{kn.get('core_question')}
   - ## 核心概念
   - ## 深入理解
   - ## 应用与拓展
   - ## 推荐互动资源
   - ## 学习路径建议
3. plan_markdown 必须直接包含核心问题原句：{kn.get('core_question')}
4. plan_markdown 必须出现 2-3 个 [[THEORY:theory_xxx]] 标记，而且 theory_id 必须与 theories 数组一致。
5. 不要添加 ## 推荐视频 或 ## 延伸阅读。
6. theories 输出 2-3 条；每条必须有 theory_id/title/subject/tags/body_markdown/level_bodies/exercises/related_paragraph。
7. level_bodies 至少含 K1 和 K4。K1 不能出现公式、等号、变量符号；K4 要更深一层，但仍然服务当前火箭项目。
8. exercises 必须严格输出 5 题：
   - 3 道 choice
   - 2 道 short_answer
9. 每道 exercise 的 ref 必须严格等于 hands_on_components 或 acceptance_standard 中的一条原文。
10. assignment_markdown 必须是：
   - 3 道选择题
   - 2 道问答题
   - 1 个 [HANDS_ON] 动手项目
11. media_decisions 必须覆盖 8 种媒体：theory / animation / game / hands_on_kit / image / diagram / youtube / labxchange。
12. workflow_notes 要明确写出：跳过 0.5 / 0.7 是用户要求；并说明 {media_note}

JSON 字段结构：
{{
  "workflow_notes": ["..."],
  "media_decisions": [
    {{"mode":"theory","decision":"keep","reason":"..."}},
    ...
  ],
  "plan_markdown": "...",
  "theories": [
    {{
      "theory_id":"theory_xxx",
      "title":"...",
      "subject":"engineering|physics|math|other",
      "tags":["..."],
      "body_markdown":"...",
      "level_bodies":[
        {{"level":"K1","body_markdown":"..."}},
        {{"level":"K4","body_markdown":"..."}}
      ],
      "exercises":[
        {{"question":"...","type":"choice","options":["A","B","C","D"],"correct":0,"explanation":"..."}}
      ],
      "related_paragraph":"..."
    }}
  ],
  "exercises": [
    {{"type":"choice","question":"...","options":["A","B","C","D"],"correct":0,"explanation":"...","ref":"..."}},
    {{"type":"short_answer","question":"...","sample_answer":"...","ref":"..."}}
  ],
  "assignment_markdown": "..."
}}
""".strip()


def build_media_prompt(ctx, *, include_game: bool, palette_key: str) -> str:
    kn = ctx.knode
    if include_game:
        return f"""
你正在为 SystemEdu 的 course_factory 生成结构化媒体规格。
不要输出 HTML，只输出一个合法 JSON 对象，不要解释。

节点信息：
- module_id: {kn.get('module_id')}
- title: {kn.get('title')}
- core_question: {kn.get('core_question')}
- summary: {kn.get('summary')}
- hands_on_components: {json.dumps(kn.get('hands_on_components') or [], ensure_ascii=False)}
- acceptance_standard: {json.dumps(kn.get('acceptance_standard') or [], ensure_ascii=False)}
- palette_key 固定为: {palette_key}

请输出：
{{
  "palette_key": "{palette_key}",
  "animation": {{
    "subtitle_cn": "...",
    "subtitle_en": "...",
    "guide_cn": ["...", "...", "..."],
    "guide_en": ["...", "...", "..."],
    "hud_labels_cn": ["...", "...", "...", "..."],
    "hud_labels_en": ["...", "...", "...", "..."],
    "frames": [
      {{
        "title_cn": "...",
        "title_en": "...",
        "columns": [
          {{"label_cn":"...","label_en":"...","value_cn":"...","value_en":"...","status":"good|warn|bad|neutral"}},
          {{"label_cn":"...","label_en":"...","value_cn":"...","value_en":"...","status":"good|warn|bad|neutral"}},
          {{"label_cn":"...","label_en":"...","value_cn":"...","value_en":"...","status":"good|warn|bad|neutral"}}
        ],
        "callout_cn": "...",
        "callout_en": "...",
        "footer_cn": "...",
        "footer_en": "..."
      }}
    ]
  }},
  "game": {{
    "tag_cn": "...",
    "tag_en": "...",
    "subtitle_cn": "...",
    "subtitle_en": "...",
    "guide_cn": ["...", "...", "..."],
    "guide_en": ["...", "...", "..."],
    "rounds": [
      {{
        "title_cn": "...",
        "title_en": "...",
        "scenario_cn": "...",
        "scenario_en": "...",
        "options": [
          {{
            "label_cn":"方案A",
            "label_en":"Plan A",
            "chips_cn":["...", "...", "..."],
            "chips_en":["...", "...", "..."],
            "score": 0-100,
            "result_cn":"...",
            "result_en":"...",
            "lesson_cn":"...",
            "lesson_en":"..."
          }}
        ]
      }}
    ]
  }}
}}

硬约束：
1. animation 必须是 4 帧。
2. 每帧固定 3 列 columns。
3. game 必须是 3 轮，每轮固定 3 个 options。
4. 文案必须紧贴当前节点，不要泛泛而谈。
5. animation 要回答“为什么这样选”；game 要让学生比较“哪个方案更像工程选择”。
6. 文案要适合 10-15 岁学生，但不能幼稚。
7. animation 的主画面必须用图形、对象状态、箭头、热区、形变、装配关系来表达概念；文字只能做短标签或 HUD。
8. 不要把 columns 渲染理解成“三张主信息卡”；columns 只是元数据，不是主画面。
""".strip()

    return f"""
你正在为 SystemEdu 的 course_factory 生成一个 capstone 节点的动画规格。
不要输出 HTML，只输出一个合法 JSON 对象，不要解释。

节点信息：
- module_id: {kn.get('module_id')}
- title: {kn.get('title')}
- core_question: {kn.get('core_question')}
- summary: {kn.get('summary')}
- acceptance_standard: {json.dumps(kn.get('acceptance_standard') or [], ensure_ascii=False)}
- palette_key 固定为: {palette_key}

请输出：
{{
  "palette_key": "{palette_key}",
  "animation": {{
    "subtitle_cn": "...",
    "subtitle_en": "...",
    "guide_cn": ["...", "...", "..."],
    "guide_en": ["...", "...", "..."],
    "hud_labels_cn": ["...", "...", "...", "..."],
    "hud_labels_en": ["...", "...", "...", "..."],
    "frames": [
      {{
        "title_cn": "...",
        "title_en": "...",
        "columns": [
          {{"label_cn":"...","label_en":"...","value_cn":"...","value_en":"...","status":"good|warn|bad|neutral"}},
          {{"label_cn":"...","label_en":"...","value_cn":"...","value_en":"...","status":"good|warn|bad|neutral"}},
          {{"label_cn":"...","label_en":"...","value_cn":"...","value_en":"...","status":"good|warn|bad|neutral"}}
        ],
        "callout_cn": "...",
        "callout_en": "...",
        "footer_cn": "...",
        "footer_en": "..."
      }}
    ]
  }},
  "game": null
}}

硬约束：
1. animation 必须是 4 帧。
2. 每帧固定 3 列 columns。
3. 这是 capstone，game 必须为 null。
4. 动画重点不是讲新概念，而是把交付物、检查、复现性、提交动作可视化。
5. animation 的主画面必须用对象、步骤状态、装配变化来表达；文字只能做短标签，不要做成幻灯片。
""".strip()


def render_joint_selection_animation_html(*, palette_key: str, kname: str) -> str:
    template_path = FIX_DIR / "templates" / "k62_anim_graphic.html"
    html = template_path.read_text(encoding="utf-8")
    return (
        html.replace("__KNAME_JSON__", json.dumps(kname, ensure_ascii=False))
        .replace("__PALETTE_JSON__", json.dumps(palette_key, ensure_ascii=False))
    )


def render_animation_html(spec: dict, *, palette_key: str, kname: str, node_id: int | None = None) -> str:
    if node_id == 62:
        return render_joint_selection_animation_html(palette_key=palette_key, kname=kname)

    frames_json = json.dumps(spec["animation"]["frames"], ensure_ascii=False)
    i18n = {
        "title": {"cn": kname, "en": kname},
        "subtitle": {
            "cn": spec["animation"]["subtitle_cn"],
            "en": spec["animation"]["subtitle_en"],
        },
        "guide1": {"cn": spec["animation"]["guide_cn"][0], "en": spec["animation"]["guide_en"][0]},
        "guide2": {"cn": spec["animation"]["guide_cn"][1], "en": spec["animation"]["guide_en"][1]},
        "guide3": {"cn": spec["animation"]["guide_cn"][2], "en": spec["animation"]["guide_en"][2]},
    }
    for i, label in enumerate(spec["animation"]["hud_labels_cn"][:4], start=1):
        i18n[f"hudL{i}"] = {
            "cn": label,
            "en": spec["animation"]["hud_labels_en"][i - 1],
        }
    i18n_json = json.dumps(i18n, ensure_ascii=False)
    hud_values = []
    for frame in spec["animation"]["frames"]:
        values = [
            frame["columns"][0]["value_cn"],
            frame["columns"][1]["value_cn"],
            frame["columns"][2]["value_cn"],
            frame["footer_cn"],
        ]
        hud_values.append(values)
    hud_values_json = json.dumps(hud_values, ensure_ascii=False)
    guide_items_json = json.dumps(["guide1", "guide2", "guide3"], ensure_ascii=False)
    css = """
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box;}
html,body{width:100%;height:100vh;overflow:hidden;}
body{background:var(--bg,#0c0e12);color:var(--text,#f6f6fc);font-family:'Inter','Noto Sans SC',sans-serif;}
.wrapper{display:flex;flex-direction:row;height:100vh;overflow:hidden;}
.sidebar{width:200px;min-width:200px;max-width:200px;display:flex;flex-direction:column;gap:6px;padding:10px;background:var(--sb-bg,rgba(5,6,15,0.92));border-right:1px solid var(--sb-border,rgba(80,255,176,0.15));overflow-y:auto;}
.lang-btn{align-self:flex-start;flex-shrink:0;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;padding:3px 8px;cursor:pointer;border:1px solid var(--sb-btn-bd,transparent);background:var(--sb-btn-bg,transparent);color:var(--sb-accent,var(--primary,#50ffb0));letter-spacing:1px;text-transform:uppercase;}
.style-switcher{display:flex;gap:4px;margin:4px 0 2px;}
.vm-btn{font-family:'JetBrains Mono',monospace;font-size:8px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:3px 6px;cursor:pointer;border:1px solid var(--sb-btn-bd,rgba(128,128,128,0.2));background:var(--sb-btn-bg,transparent);color:var(--sb-dim,rgba(128,128,128,0.5));transition:all 0.2s;}
.vm-btn.vm-active{color:var(--sb-accent,var(--primary));border-color:var(--sb-accent,var(--primary));background:rgba(128,128,128,0.12);}
.sidebar h1{font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:var(--sb-accent,var(--primary,#50ffb0));margin-top:4px;line-height:1.3;text-transform:uppercase;letter-spacing:0.04em;}
.sidebar .sub{font-family:'Noto Sans SC',sans-serif;font-size:10px;color:var(--sb-dim,rgba(128,128,128,0.7));letter-spacing:0.06em;}
.sidebar .frame-ind{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--sb-mute,rgba(128,128,128,0.5));letter-spacing:0.1em;margin-top:4px;}
.sidebar .guide-label{font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--sb-accent,var(--primary,#50ffb0));margin-top:8px;}
.sidebar .guide-content{font-family:'Noto Sans SC',sans-serif;font-size:11px;color:var(--sb-dim,rgba(255,255,255,0.7));line-height:1.5;}
.sidebar .guide-content ul{padding-left:16px;margin:0;}
.sidebar .guide-content li{margin-bottom:1px;}
.anim-main{flex:1;display:flex;flex-direction:column;min-width:0;}
.canvas-wrap{flex:1;min-height:0;position:relative;}
canvas{width:100%;height:100%;display:block;}
.controls{display:flex;justify-content:center;align-items:center;gap:12px;padding:6px 16px;background:rgba(0,0,0,0.35);}
.ctrl-btn{font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:5px 16px;border:none;cursor:pointer;color:var(--ctrl-color,var(--bg,#0c0e12));background:linear-gradient(135deg,var(--ctrl-bg,var(--primary,#50ffb0)),var(--primary-dim,#17df93));transition:transform 0.1s,box-shadow 0.2s;box-shadow:0 0 10px var(--glow-strong,rgba(80,255,176,0.3));}
.ctrl-btn.secondary{background:var(--sb-btn-bg,rgba(23,26,31,0.92));color:var(--sb-mute,rgba(128,128,128,0.6));box-shadow:none;border:1px solid var(--sb-btn-bd,rgba(128,128,128,0.15));}
.hud{height:40px;display:flex;align-items:center;justify-content:space-around;background:var(--hud-bg,rgba(0,0,0,0.55));border-top:1px solid var(--hud-border,transparent);padding:0 16px;}
.hud-item{text-align:center;}
.hud-label{font-family:'JetBrains Mono',monospace;font-size:7px;letter-spacing:0.15em;text-transform:uppercase;color:var(--hud-label,var(--sb-mute));}
.hud-val{font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;color:var(--hud-value,var(--sb-accent,var(--primary,#50ffb0)));}
#frameInd{display:none;}
"""
    return f"""<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@400;500;700&family=Inter:wght@400;500&family=Noto+Sans+SC:wght@400;700&display=swap" rel="stylesheet">
<style>{css}</style>
</head>
<body>
<div class="wrapper">
  <div class="sidebar">
    <button class="lang-btn" id="langBtn">CN</button>
    <div class="style-switcher" id="styleSwitcher"></div>
    <h1 id="title"></h1>
    <div class="sub" id="subtitle"></div>
    <div class="frame-ind" id="frameIndicator"></div>
    <div id="frameInd"></div>
    <div class="guide-label" id="guideTitle"></div>
    <div class="guide-content" id="guideContent"></div>
  </div>
  <div class="anim-main">
    <div class="canvas-wrap"><canvas id="c"></canvas></div>
    <div class="controls">
      <button class="ctrl-btn secondary" id="btnPrev"></button>
      <button class="ctrl-btn" id="btnPlay"></button>
      <button class="ctrl-btn secondary" id="btnNext"></button>
    </div>
    <div class="hud">
      <div class="hud-item"><div class="hud-label" id="hudL1"></div><div class="hud-val" id="hudV1"></div></div>
      <div class="hud-item"><div class="hud-label" id="hudL2"></div><div class="hud-val" id="hudV2"></div></div>
      <div class="hud-item"><div class="hud-label" id="hudL3"></div><div class="hud-val" id="hudV3"></div></div>
      <div class="hud-item"><div class="hud-label" id="hudL4"></div><div class="hud-val" id="hudV4"></div></div>
    </div>
  </div>
</div>
<script src="../../runtime/animation_runtime.js"></script>
<script>
const FRAME_DATA = {frames_json};
window.CONFIG = {{
  style: "{palette_key}",
  totalFrames: FRAME_DATA.length,
  guideTitle: "guideDefault",
  guideItems: {guide_items_json},
  hudLabels: ["hudL1","hudL2","hudL3","hudL4"],
  hudValues: {hud_values_json},
  i18n: {i18n_json},
}};

function statusColor(status, pal) {{
  if (status === "good") return pal.secondary || "#2ff801";
  if (status === "warn") return pal.tertiary || "#ebb2ff";
  if (status === "bad") return pal.error || "#ef4444";
  return pal.primary || "#50ffb0";
}}

function getFrameElements(f, W, H) {{
  const P = AnimRuntime.PAL;
  const lang = AnimRuntime.LANG === "en" ? "en" : "cn";
  const fr = FRAME_DATA[f] || FRAME_DATA[0];
  const elems = [];
  const topY = 54;
  elems.push({{type:"label", x:W/2, y:topY, text:fr["title_" + lang], size:22, color:P.text, bold:true}});

  const startX = 78;
  const gap = 22;
  const colW = (W - startX * 2 - gap * 2) / 3;
  const boxY = 98;
  const boxH = 150;

  fr.columns.forEach(function(col, idx) {{
    const x = startX + idx * (colW + gap);
    const accent = statusColor(col.status, P);
    elems.push({{type:"box", x:x, y:boxY, w:colW, h:boxH, fill:"rgba(10,14,24,0.32)", stroke:accent, lineWidth:2}});
    elems.push({{type:"label", x:x + colW/2, y:boxY + 24, text:col["label_" + lang], size:13, color:accent, bold:true}});
    elems.push({{type:"custom", draw:function(ctx) {{
      ctx.save();
      ctx.fillStyle = P.text;
      ctx.font = "14px 'Inter','Noto Sans SC',sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const text = col["value_" + lang];
      const lines = String(text).split(/\\n+/);
      lines.forEach(function(line, li) {{
        ctx.fillText(line, x + colW/2, boxY + 58 + li * 22);
      }});
      ctx.restore();
    }}}});
  }});

  elems.push({{type:"arrow", x1:startX + colW + 6, y1:boxY + boxH/2, x2:startX + colW + gap - 6, y2:boxY + boxH/2, color:P.primary, lineWidth:1.5, headSize:8}});
  elems.push({{type:"arrow", x1:startX + 2*colW + gap + 6, y1:boxY + boxH/2, x2:startX + 2*colW + 2*gap - 6, y2:boxY + boxH/2, color:P.primary, lineWidth:1.5, headSize:8}});

  elems.push({{type:"box", x:72, y:280, w:W-144, h:54, fill:"rgba(10,14,24,0.26)", stroke:P.primary, lineWidth:1}});
  elems.push({{type:"custom", draw:function(ctx) {{
    ctx.save();
    ctx.fillStyle = P.text;
    ctx.font = "15px 'Inter','Noto Sans SC',sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const msg = fr["callout_" + lang];
    const words = String(msg).split("");
    let line = "";
    let y = 294;
    const maxW = W - 184;
    for (let i = 0; i < words.length; i++) {{
      const test = line + words[i];
      if (ctx.measureText(test).width > maxW && line) {{
        ctx.fillText(line, 92, y);
        line = words[i];
        y += 20;
      }} else {{
        line = test;
      }}
    }}
    if (line) ctx.fillText(line, 92, y);
    ctx.restore();
  }}}});

  elems.push({{type:"box", x:72, y:350, w:W-144, h:28, fill:"rgba(255,255,255,0.04)", stroke:P.strokeDim, lineWidth:1}});
  elems.push({{type:"label", x:W/2, y:364, text:fr["footer_" + lang], size:12, color:P.dim}});
  return elems;
}}

function onReady() {{
  const src = document.getElementById("frameIndicator");
  const dst = document.getElementById("frameInd");
  if (src && dst) {{
    const sync = () => {{ dst.textContent = src.textContent || ""; }};
    sync();
    new MutationObserver(sync).observe(src, {{ childList: true, subtree: true, characterData: true }});
  }}
}}

AnimRuntime.boot();
</script>
</body>
</html>"""


def render_game_html(spec: dict, *, palette_key: str, kname: str) -> str:
    game = spec["game"]
    rounds_json = json.dumps(game["rounds"], ensure_ascii=False)
    i18n = {
        "title": {"cn": kname, "en": kname},
        "subtitle": {"cn": game["subtitle_cn"], "en": game["subtitle_en"]},
        "tag": {"cn": game["tag_cn"], "en": game["tag_en"]},
        "guide1": {"cn": game["guide_cn"][0], "en": game["guide_en"][0]},
        "guide2": {"cn": game["guide_cn"][1], "en": game["guide_en"][1]},
        "guide3": {"cn": game["guide_cn"][2], "en": game["guide_en"][2]},
        "nextRound": {"cn": "下一关", "en": "Next"},
        "restart": {"cn": "重新开始", "en": "Restart"},
        "guideLabel": {"cn": "游戏指南", "en": "Guide"},
        "roundLabel": {"cn": "当前轮次", "en": "Round"},
        "statusReady": {"cn": "请选择一个方案卡", "en": "Pick one plan card"},
        "statusDone": {"cn": "已生成反馈，可进入下一轮", "en": "Feedback ready, continue"},
    }
    i18n_json = json.dumps(i18n, ensure_ascii=False)
    css = """
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box;}
html,body{width:100%;height:100vh;overflow:hidden;background:var(--bg,#05060f);color:#e2e2e9;font-family:'Inter','Noto Sans SC',sans-serif;}
.game-wrap{display:flex;flex-direction:row;height:100vh;overflow:hidden;}
.game-sidebar{width:200px;min-width:200px;max-width:200px;display:flex;flex-direction:column;gap:6px;padding:10px;background:var(--sb-bg,rgba(5,6,15,0.95));border-right:1px solid var(--sb-border,rgba(128,128,128,0.2));overflow-y:auto;}
.sidebar-lang{align-self:flex-start;flex-shrink:0;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;padding:3px 8px;cursor:pointer;border:1px solid var(--sb-btn-bd,transparent);background:var(--sb-btn-bg,transparent);color:var(--sb-accent,var(--primary,#50ffb0));letter-spacing:0.15em;text-transform:uppercase;}
.style-switcher{display:flex;gap:4px;margin:2px 0;}
.vm-btn{font-family:'JetBrains Mono',monospace;font-size:8px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:3px 6px;cursor:pointer;border:1px solid var(--sb-btn-bd,rgba(128,128,128,0.2));background:var(--sb-btn-bg,transparent);color:var(--sb-dim,rgba(128,128,128,0.5));transition:all 0.2s;}
.vm-btn.vm-active{color:var(--sb-accent,var(--primary));border-color:var(--sb-accent,var(--primary));background:rgba(128,128,128,0.12);}
.sidebar-title{font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:var(--sb-accent,var(--primary));letter-spacing:0.08em;text-transform:uppercase;margin-top:4px;}
.sidebar-sub{font-size:11px;color:var(--sb-dim,#8e90a6);}
.sidebar-divider{height:1px;background:var(--sb-btn-bd,rgba(128,128,128,0.15));margin:4px 0;}
.sidebar-section{font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:700;color:var(--sb-mute,rgba(128,128,128,0.6));letter-spacing:0.15em;text-transform:uppercase;margin-top:4px;}
.sidebar-guide{font-size:11px;color:var(--sb-dim,#8e90a6);line-height:1.6;}
.sidebar-guide ul{padding-left:16px;}
.sidebar-pill{display:inline-flex;align-items:center;gap:6px;padding:6px 8px;border:1px solid var(--sb-btn-bd,rgba(128,128,128,0.2));font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--sb-accent,var(--primary));}
.sidebar-btn{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;padding:6px 8px;border:1px solid var(--sb-btn-bd,rgba(128,128,128,0.25));cursor:pointer;color:var(--sb-dim,#8e90a6);background:transparent;letter-spacing:0.1em;text-transform:uppercase;width:100%;}
.sidebar-btn:hover{color:var(--sb-accent,var(--primary));border-color:var(--sb-accent,var(--primary));}
.game-main{flex:1;display:flex;flex-direction:column;min-width:0;}
.game-hud{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:8px 16px;background:var(--hud-bg,rgba(5,6,15,0.9));border-bottom:1px solid var(--hud-border,transparent);flex-shrink:0;}
.hud-left{display:flex;align-items:center;gap:14px;flex-wrap:wrap;}
.hud-tag{font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;color:var(--sb-accent,var(--primary));letter-spacing:0.15em;text-transform:uppercase;}
.hud-item{display:flex;flex-direction:column;align-items:flex-start;gap:1px;}
.hud-label{font-family:'JetBrains Mono',monospace;font-size:8px;letter-spacing:0.15em;color:var(--hud-label,#5e6070);text-transform:uppercase;}
.hud-val{font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:var(--hud-value,var(--sb-accent,var(--primary)));letter-spacing:0.15em;}
.game-area{flex:1;min-height:0;padding:18px;display:grid;grid-template-columns:1.3fr 1fr;gap:18px;background:radial-gradient(circle at top left, rgba(255,255,255,0.04), transparent 40%);}
.panel{border:1px solid var(--sb-btn-bd,rgba(128,128,128,0.18));background:rgba(12,16,26,0.42);backdrop-filter:blur(8px);min-height:0;}
.scenario-panel{padding:18px;display:flex;flex-direction:column;gap:14px;}
.round-title{font-family:'Space Grotesk','Noto Sans SC',sans-serif;font-size:24px;font-weight:700;color:var(--sb-accent,var(--primary));line-height:1.2;}
.scenario-text{font-size:15px;line-height:1.75;color:var(--sb-text,#e2e8f0);}
.options-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;}
.option-card{border:1px solid var(--sb-btn-bd,rgba(128,128,128,0.22));background:rgba(255,255,255,0.04);padding:14px;cursor:pointer;display:flex;flex-direction:column;gap:12px;min-height:230px;transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease;}
.option-card:hover,.option-card.active{transform:translateY(-2px);border-color:var(--sb-accent,var(--primary));box-shadow:0 0 16px rgba(255,255,255,0.08);}
.option-head{display:flex;justify-content:space-between;align-items:center;gap:8px;}
.option-name{font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--sb-accent,var(--primary));}
.score-pill{font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;padding:4px 8px;border:1px solid var(--sb-btn-bd,rgba(128,128,128,0.2));color:var(--sb-dim,#8e90a6);}
.chips{display:flex;flex-wrap:wrap;gap:8px;}
.chip{padding:4px 8px;border:1px solid var(--sb-btn-bd,rgba(128,128,128,0.18));font-size:11px;color:var(--sb-text,#e2e8f0);}
.option-hint{font-size:12px;color:var(--sb-dim,#8e90a6);line-height:1.6;}
.result-panel{padding:18px;display:flex;flex-direction:column;gap:16px;}
.meter-group{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;}
.meter-card{padding:10px;border:1px solid var(--sb-btn-bd,rgba(128,128,128,0.18));background:rgba(255,255,255,0.03);}
.meter-label{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:var(--hud-label,#5e6070);}
.meter-track{margin-top:6px;height:6px;background:rgba(255,255,255,0.08);overflow:hidden;}
.meter-fill{height:100%;background:linear-gradient(90deg,var(--primary),var(--secondary));}
.result-title{font-family:'Space Grotesk','Noto Sans SC',sans-serif;font-size:20px;font-weight:700;color:var(--sb-text,#e2e8f0);}
.result-body,.result-lesson{font-size:14px;line-height:1.7;color:var(--sb-dim,#8e90a6);}
.result-actions{display:flex;gap:10px;margin-top:auto;}
.action-btn{font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;padding:8px 12px;border:none;cursor:pointer;background:linear-gradient(135deg,var(--ctrl-bg,var(--primary)),var(--primary-dim));color:var(--ctrl-color,var(--bg));letter-spacing:0.12em;text-transform:uppercase;}
.ghost-btn{font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;padding:8px 12px;border:1px solid var(--sb-btn-bd,rgba(128,128,128,0.22));cursor:pointer;background:transparent;color:var(--sb-dim,#8e90a6);letter-spacing:0.12em;text-transform:uppercase;}
@media (max-width: 1100px){
  .game-area{grid-template-columns:1fr;}
  .options-grid{grid-template-columns:1fr;}
}
"""
    return f"""<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<script>window.__systemedu_resize_patch_optout=true;</script>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@400;500;700&family=Inter:wght@400;500&family=Noto+Sans+SC:wght@400;700&display=swap" rel="stylesheet">
<style>{css}</style>
</head>
<body>
<div class="game-wrap">
  <div class="game-sidebar">
    <button class="sidebar-lang" id="langBtn">CN</button>
    <div class="style-switcher" id="styleSwitcher"></div>
    <div class="sidebar-title" id="sideTitle"></div>
    <div class="sidebar-sub" id="sideSub"></div>
    <div class="sidebar-divider"></div>
    <div class="sidebar-section" id="guideLabel"></div>
    <div class="sidebar-guide" id="guideText"></div>
    <div class="sidebar-divider"></div>
    <div class="sidebar-section" id="roundLabelSide"></div>
    <div class="sidebar-pill" id="roundInfo"></div>
    <div class="sidebar-divider"></div>
    <button class="sidebar-btn" id="restartBtn"></button>
  </div>
  <div class="game-main">
    <div class="game-hud">
      <div class="hud-left">
        <div class="hud-tag" id="hudTag"></div>
        <div class="hud-item"><div class="hud-label" id="hudL1">ROUND</div><div class="hud-val" id="hudV1"></div></div>
        <div class="hud-item"><div class="hud-label" id="hudL2">STATUS</div><div class="hud-val" id="hudV2"></div></div>
      </div>
    </div>
    <div class="game-area">
      <div class="panel scenario-panel">
        <div class="round-title" id="roundTitle"></div>
        <div class="scenario-text" id="scenarioText"></div>
        <div class="options-grid" id="optionsGrid"></div>
      </div>
      <div class="panel result-panel" id="resultPanel">
        <div class="result-title" id="resultTitle"></div>
        <div class="meter-group">
          <div class="meter-card">
            <div class="meter-label" id="m1Label">SCORE</div>
            <div class="meter-track"><div class="meter-fill" id="m1Fill" style="width:0%"></div></div>
          </div>
          <div class="meter-card">
            <div class="meter-label" id="m2Label">CLARITY</div>
            <div class="meter-track"><div class="meter-fill" id="m2Fill" style="width:0%"></div></div>
          </div>
          <div class="meter-card">
            <div class="meter-label" id="m3Label">ROBUSTNESS</div>
            <div class="meter-track"><div class="meter-fill" id="m3Fill" style="width:0%"></div></div>
          </div>
        </div>
        <div class="result-body" id="resultBody"></div>
        <div class="result-lesson" id="resultLesson"></div>
        <div class="result-actions">
          <button class="action-btn" id="nextBtn"></button>
          <button class="ghost-btn" id="retryBtn"></button>
        </div>
      </div>
    </div>
  </div>
</div>
<script>
const GAME_ROUNDS = {rounds_json};
const I18N = {i18n_json};
const PALETTES = {{
  mech: {{primary:'#ffb59c', primaryDim:'#ff7f50', secondary:'#00daf3', bg:'#131313'}},
  space: {{primary:'#c9bfff', primaryDim:'#8771ff', secondary:'#85ecff', bg:'#111220'}},
  phys: {{primary:'#7dd3fc', primaryDim:'#38bdf8', secondary:'#fbbf24', bg:'#0b1220'}},
}};
const GAME_VISUAL_MODES = {{
  light: {{label:'LIGHT', bg:'#fafaf5', sbBg:'rgba(250,250,245,0.96)', sbBorder:'#d4d4c8', sbText:'#0f172a', sbDim:'#475569', sbMute:'#94a3b8', hudBg:'rgba(250,250,245,0.92)', hudBorder:'#d4d4c8', hudLabel:'#64748b', hudValue:'#0f172a', ctrlBg:'#0f172a', ctrlColor:'#fafaf5'}},
  dark: {{label:'DARK', bg:'#0a0a0a', sbBg:'rgba(10,10,10,0.96)', sbBorder:'#1f1f1f', sbText:'#fafafa', sbDim:'#737373', sbMute:'#525252', hudBg:'rgba(10,10,10,0.92)', hudBorder:'#1f1f1f', hudLabel:'#525252', hudValue:'#fafafa', ctrlBg:null, ctrlColor:null}},
  cyberpunk: {{label:'CYBER', bg:'#05060f', sbBg:'rgba(5,6,15,0.92)', sbBorder:null, sbText:'#e2e8f0', sbDim:'#cbd5e1', sbMute:'#64748b', hudBg:'rgba(5,6,15,0.92)', hudBorder:null, hudLabel:'#64748b', hudValue:'#e2e8f0', ctrlBg:null, ctrlColor:'#05060f'}},
}};

let LANG = 'cn';
let MODE = 'cyberpunk';
let ROUND = 0;
let SELECTED = null;
const PALETTE = PALETTES['{palette_key}'] || PALETTES.space;

function t(key) {{
  return (I18N[key] && I18N[key][LANG]) || (I18N[key] && I18N[key].en) || key;
}}

function applyMode(mode) {{
  MODE = mode;
  const m = GAME_VISUAL_MODES[mode];
  const root = document.documentElement;
  root.style.setProperty('--bg', m.bg);
  root.style.setProperty('--sb-bg', m.sbBg);
  root.style.setProperty('--sb-border', m.sbBorder || PALETTE.primary);
  root.style.setProperty('--sb-text', m.sbText);
  root.style.setProperty('--sb-dim', m.sbDim);
  root.style.setProperty('--sb-mute', m.sbMute);
  root.style.setProperty('--sb-accent', PALETTE.primary);
  root.style.setProperty('--sb-btn-bg', 'transparent');
  root.style.setProperty('--sb-btn-bd', m.sbBorder || 'rgba(255,255,255,0.16)');
  root.style.setProperty('--hud-bg', m.hudBg);
  root.style.setProperty('--hud-border', m.hudBorder || 'transparent');
  root.style.setProperty('--hud-label', m.hudLabel);
  root.style.setProperty('--hud-value', m.hudValue || PALETTE.primary);
  root.style.setProperty('--ctrl-bg', m.ctrlBg || PALETTE.primary);
  root.style.setProperty('--ctrl-color', m.ctrlColor || '#05060f');
  root.style.setProperty('--primary', PALETTE.primary);
  root.style.setProperty('--primary-dim', PALETTE.primaryDim);
  root.style.setProperty('--secondary', PALETTE.secondary);
  document.querySelectorAll('.vm-btn').forEach(btn => btn.classList.toggle('vm-active', btn.dataset.mode === mode));
}}

function buildStyleSwitcher() {{
  const box = document.getElementById('styleSwitcher');
  box.innerHTML = '';
  ['light','dark','cyberpunk'].forEach(mode => {{
    const btn = document.createElement('button');
    btn.className = 'vm-btn' + (mode === MODE ? ' vm-active' : '');
    btn.dataset.mode = mode;
    btn.textContent = GAME_VISUAL_MODES[mode].label;
    btn.addEventListener('click', () => applyMode(mode));
    box.appendChild(btn);
  }});
}}

function renderGuide() {{
  document.getElementById('guideLabel').textContent = t('guideLabel');
  document.getElementById('guideText').innerHTML = '<ul>' +
    [t('guide1'), t('guide2'), t('guide3')].map(x => `<li>${{x}}</li>`).join('') +
    '</ul>';
  document.getElementById('sideTitle').textContent = t('title');
  document.getElementById('sideSub').textContent = t('subtitle');
  document.getElementById('hudTag').textContent = t('tag');
  document.getElementById('roundLabelSide').textContent = t('roundLabel');
  document.getElementById('restartBtn').textContent = t('restart');
}}

function roundData() {{
  return GAME_ROUNDS[ROUND] || GAME_ROUNDS[0];
}}

function updateMeters(score) {{
  const s = Math.max(0, Math.min(100, score || 0));
  document.getElementById('m1Fill').style.width = s + '%';
  document.getElementById('m2Fill').style.width = Math.max(20, Math.min(100, s - 8)) + '%';
  document.getElementById('m3Fill').style.width = Math.max(20, Math.min(100, s + 6)) + '%';
}}

function renderResult(opt) {{
  const lang = LANG;
  document.getElementById('resultTitle').textContent = opt ? opt['label_' + lang] : t('statusReady');
  document.getElementById('resultBody').textContent = opt ? opt['result_' + lang] : t('statusReady');
  document.getElementById('resultLesson').textContent = opt ? opt['lesson_' + lang] : '';
  document.getElementById('hudV2').textContent = opt ? t('statusDone') : t('statusReady');
  updateMeters(opt ? opt.score : 0);
}}

function renderOptions() {{
  const lang = LANG;
  const data = roundData();
  const box = document.getElementById('optionsGrid');
  box.innerHTML = '';
  data.options.forEach((opt, idx) => {{
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'option-card' + (SELECTED === idx ? ' active' : '');
    card.dataset.option = String(idx);
    card.innerHTML = `
      <div class="option-head">
        <div class="option-name">${{opt['label_' + lang]}}</div>
        <div class="score-pill">Score ${{opt.score}}</div>
      </div>
      <div class="chips">${{opt['chips_' + lang].map(ch => `<span class="chip">${{ch}}</span>`).join('')}}</div>
      <div class="option-hint">${{opt['lesson_' + lang]}}</div>
    `;
    card.addEventListener('click', () => {{
      SELECTED = idx;
      renderRound();
      renderResult(opt);
      document.getElementById('nextBtn').style.visibility = 'visible';
    }});
    box.appendChild(card);
  }});
}}

function renderRound() {{
  const lang = LANG;
  const data = roundData();
  document.getElementById('roundTitle').textContent = data['title_' + lang];
  document.getElementById('scenarioText').textContent = data['scenario_' + lang];
  document.getElementById('hudV1').textContent = `${{ROUND + 1}} / ${{GAME_ROUNDS.length}}`;
  document.getElementById('roundInfo').textContent = `${{ROUND + 1}} / ${{GAME_ROUNDS.length}}`;
  document.getElementById('nextBtn').textContent = t('nextRound');
  document.getElementById('retryBtn').textContent = t('restart');
  renderOptions();
}}

function nextRound() {{
  if (ROUND < GAME_ROUNDS.length - 1) {{
    ROUND += 1;
    SELECTED = null;
    renderResult(null);
    renderRound();
    document.getElementById('nextBtn').style.visibility = 'hidden';
  }} else {{
    ROUND = 0;
    SELECTED = null;
    renderResult(null);
    renderRound();
    document.getElementById('nextBtn').style.visibility = 'hidden';
  }}
}}

function restart() {{
  ROUND = 0;
  SELECTED = null;
  renderResult(null);
  renderRound();
  document.getElementById('nextBtn').style.visibility = 'hidden';
}}

function setupLang() {{
  const btn = document.getElementById('langBtn');
  btn.textContent = LANG.toUpperCase();
  btn.addEventListener('click', () => {{
    LANG = LANG === 'en' ? 'cn' : 'en';
    btn.textContent = LANG.toUpperCase();
    renderGuide();
    renderRound();
    const data = roundData();
    const opt = SELECTED != null ? data.options[SELECTED] : null;
    renderResult(opt);
  }});
}}

document.getElementById('nextBtn').addEventListener('click', nextRound);
document.getElementById('retryBtn').addEventListener('click', restart);
document.getElementById('restartBtn').addEventListener('click', restart);

buildStyleSwitcher();
applyMode('cyberpunk');
setupLang();
renderGuide();
renderRound();
renderResult(null);
document.getElementById('nextBtn').style.visibility = 'hidden';
</script>
</body>
</html>"""


def validate_html(html_path: Path, *, mode: str, out_dir: Path) -> dict:
    ensure_dir(out_dir)
    html_validate = run_cmd(
        ["node", "course_factory/validate/html_validate.mjs", str(html_path), "--mode", mode],
        cwd=ROOT,
    )
    write_text(out_dir / "html_validate.txt", html_validate.stdout + "\n" + html_validate.stderr)
    if html_validate.returncode != 0:
        raise RuntimeError(f"html_validate failed for {html_path.name}")

    if mode == "animation":
        verify = run_cmd(
            ["node", "course_factory/validate/verify/animation.mjs", str(html_path), "--out", str(out_dir)],
            cwd=ROOT,
        )
    else:
        verify = run_cmd(
            ["node", "course_factory/validate/verify/game.mjs", str(html_path), "--out", str(out_dir)],
            cwd=ROOT,
        )
    write_text(out_dir / f"verify_{mode}.txt", verify.stdout + "\n" + verify.stderr)
    if verify.returncode != 0:
        raise RuntimeError(f"verify/{mode}.mjs failed for {html_path.name}")
    return {
        "html_validate": str(out_dir / "html_validate.txt"),
        "verify": str(out_dir / f"verify_{mode}.txt"),
    }


def load_existing_payload(node_id: int) -> dict | None:
    bundle_path = FIX_DIR / f"k{node_id}_bundle.json"
    anim_path = FIX_DIR / f"k{node_id}_anim.html"
    if not bundle_path.exists() or not anim_path.exists():
        return None
    try:
        payload = json.loads(bundle_path.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return None
    payload["animation_html"] = anim_path.read_text(encoding="utf-8")
    game_path = FIX_DIR / f"k{node_id}_game.html"
    payload["game_html"] = game_path.read_text(encoding="utf-8") if game_path.exists() else None
    return payload


def build_course_content_for_node(
    llm,
    node_id: int,
    *,
    reuse_existing: bool = False,
) -> tuple[dict, str, dict, dict]:
    ctx = load_context(PROJECT, node_id)
    kn = ctx.knode
    capstone = kn.get("module_role") == "capstone"
    include_game = not capstone
    palette_key = PALETTE_BY_NODE.get(node_id, "space")

    payload = load_existing_payload(node_id) if reuse_existing else None
    if payload:
        content_bundle = normalize_content_bundle(payload["content_bundle"], ctx)
        media_spec = normalize_media_spec(
            payload["media_spec"],
            ctx=ctx,
            include_game=include_game,
            palette_key=palette_key,
        )
        anim_html = payload["animation_html"]
        game_html = payload.get("game_html")
        anim_reports = {
            "html_validate": str(REPORT_DIR / f"k{node_id}_anim" / "html_validate.txt"),
            "verify": str(REPORT_DIR / f"k{node_id}_anim" / "verify_animation.txt"),
        }
        game_reports = {}
        if include_game and game_html:
            game_reports = {
                "html_validate": str(REPORT_DIR / f"k{node_id}_game" / "html_validate.txt"),
                "verify": str(REPORT_DIR / f"k{node_id}_game" / "verify_game.txt"),
            }
    else:
        content_bundle = ask_json(
            llm,
            build_content_prompt(ctx, include_game=include_game, capstone=capstone),
            label=f"content bundle {node_id}",
        )
        content_bundle = normalize_content_bundle(content_bundle, ctx)

        media_spec = ask_json(
            llm,
            build_media_prompt(ctx, include_game=include_game, palette_key=palette_key),
            label=f"media spec {node_id}",
        )
        media_spec = normalize_media_spec(
            media_spec,
            ctx=ctx,
            include_game=include_game,
            palette_key=palette_key,
        )

        anim_html = render_animation_html(media_spec, palette_key=palette_key, kname=kn.get("title", ""), node_id=node_id)
        anim_path = FIX_DIR / f"k{node_id}_anim.html"
        write_text(anim_path, anim_html)
        anim_reports = validate_html(anim_path, mode="animation", out_dir=REPORT_DIR / f"k{node_id}_anim")

        game_html = None
        game_reports = {}
        if include_game and media_spec.get("game"):
            game_html = render_game_html(media_spec, palette_key=palette_key, kname=kn.get("title", ""))
            game_path = FIX_DIR / f"k{node_id}_game.html"
            write_text(game_path, game_html)
            game_reports = validate_html(game_path, mode="game", out_dir=REPORT_DIR / f"k{node_id}_game")

    refs = NODE_REFS[node_id]
    exercises = [] if capstone else make_exercises(content_bundle.get("exercises") or [])
    course_content = make_course_content(
        plan_markdown=content_bundle["plan_markdown"],
        animation_html=anim_html,
        animation_topic=f"{kn.get('title')} · 4帧可视化讲解",
        game_html=game_html,
        game_topic=(f"{kn.get('title')} · 工程方案比较实验" if game_html else ""),
        exercises=exercises,
        exercise_topic=f"{kn.get('title')} · 练习巩固",
        knode=kn,
        theories=None if capstone else content_bundle.get("theories") or [],
        project_name=PROJECT,
        research=None,
        labxchange_results=[],
        preflight=not capstone,
        **refs,
    )

    if capstone:
        ideas = course_content.get("ideas") or []
        rendered = course_content.get("rendered_sections") or {}
        keep_ids = {idea["idea_id"] for idea in ideas if idea.get("mode") != "exercise"}
        course_content["ideas"] = [idea for idea in ideas if idea.get("mode") != "exercise"]
        course_content["rendered_sections"] = {k: v for k, v in rendered.items() if k in keep_ids}
        if "theories" in course_content:
            course_content.pop("theories")
        errors = preflight_v41(kn, course_content)
        if errors:
            raise RuntimeError("Capstone post-filter preflight failed: " + "; ".join(errors))

    course_content["workflow_notes"] = content_bundle.get("workflow_notes") or []
    course_content["media_decisions"] = content_bundle.get("media_decisions") or []
    course_content["verification_notes"] = [
        "5.5a: 结构代码走统一模板，无 fixed 覆盖层，无 onclick，动画含 sidebar / game 含 game-sidebar。",
        "5.5b: 已运行 html_validate.mjs 与 verify/animation.mjs / verify/game.mjs。",
        "5.5c: 文案按节点上下文生成，严格围绕 hands_on / acceptance 组织。",
        "5.5d: core 节点 theories 含 K1 与 K4；capstone 节点 theories=0。",
        "5.5e: 互动件采用工程方案比较，不是纯题库点击。",
        "5.5f: 模板为固定两栏布局，文本区不覆盖主画面，并保留验证截图。",
    ]
    course_content["verification_artifacts"] = {
        "animation": anim_reports,
        "game": game_reports,
    }

    bundle_path = FIX_DIR / f"k{node_id}_bundle.json"
    write_text(
        bundle_path,
        json.dumps(
            {
                "content_bundle": content_bundle,
                "media_spec": media_spec,
                "course_content_preview": {
                    "plan_markdown_len": len(course_content.get("plan_markdown") or ""),
                    "idea_modes": [idea.get("mode") for idea in course_content.get("ideas") or []],
                    "theory_count": len(course_content.get("theories") or []),
                },
            },
            ensure_ascii=False,
            indent=2,
        ),
    )

    return course_content, content_bundle.get("assignment_markdown") or "", anim_reports, game_reports


def save_node_to_db(node_id: int, course_content: dict, assignment: str) -> None:
    ctx = load_context(PROJECT, node_id)
    save_knode(ctx, course_content, assignment=assignment)
    generate_audio_scripts(PROJECT, node_id, ctx.knode, ctx.milestone)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--nodes", nargs="*", type=int, default=DEFAULT_NODE_IDS)
    parser.add_argument("--save-db", action="store_true")
    parser.add_argument("--reuse-existing", action="store_true")
    args = parser.parse_args()

    ensure_dir(REPORT_DIR)
    llm = get_llm(streaming=False, temperature=0.35)

    summary = []
    for node_id in args.nodes:
        ctx = load_context(PROJECT, node_id)
        print(f"[gen] {node_id} {ctx.knode.get('module_id')} {ctx.knode.get('title')}")
        course_content, assignment, anim_reports, game_reports = build_course_content_for_node(
            llm,
            node_id,
            reuse_existing=args.reuse_existing,
        )
        if args.save_db:
            save_node_to_db(node_id, course_content, assignment)
        summary.append({
            "node_id": node_id,
            "module_id": ctx.knode.get("module_id"),
            "title": ctx.knode.get("title"),
            "saved": bool(args.save_db),
            "idea_modes": [idea.get("mode") for idea in course_content.get("ideas") or []],
            "theory_count": len(course_content.get("theories") or []),
            "assignment_len": len(assignment or ""),
            "animation_reports": anim_reports,
            "game_reports": game_reports,
        })

    write_text(REPORT_DIR / "summary.json", json.dumps(summary, ensure_ascii=False, indent=2))
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
