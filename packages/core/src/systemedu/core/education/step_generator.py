"""CourseStep generator — generates content for each step in a CourseManifest."""

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)


def _build_concept_prompt(
    node_title: str, node_summary: str, difficulty: int, step_spec: dict
) -> str:
    difficulty_desc = "入门级" if difficulty <= 3 else "中级" if difficulty <= 6 else "高级"
    hint = step_spec.get("spec", {}).get("prompt_hint", "")
    return (
        f"你是一位专业的教育内容创作者，请为知识节点《{node_title}》生成核心概念讲解。\n\n"
        f"知识简介：{node_summary}\n"
        f"难度：{difficulty}/10（{difficulty_desc}）\n"
        f"内容提示：{hint}\n\n"
        f"要求：\n"
        f"- 内容分成 3-5 个小节，每小节用 ## 标题开头\n"
        f"- 每小节 100-200 字，使用 markdown 格式\n"
        f"- 适当使用类比帮助理解\n"
        f"- 全部使用中文，直接输出 markdown，不要包含「核心概念：」等前缀"
    )


def _build_story_prompt(
    node_title: str, node_summary: str, difficulty: int, step_spec: dict
) -> str:
    difficulty_desc = "入门级" if difficulty <= 3 else "中级" if difficulty <= 6 else "高级"
    hint = step_spec.get("spec", {}).get("prompt_hint", "")
    return (
        f"你是一位善于讲故事的教育者，请用生动的故事或类比引入知识节点《{node_title}》。\n\n"
        f"知识简介：{node_summary}\n"
        f"难度：{difficulty}/10（{difficulty_desc}）\n"
        f"内容提示：{hint}\n\n"
        f"要求：\n"
        f"- 用一个有趣的故事、类比或生活场景引入这个概念\n"
        f"- 200-400 字，生动活泼，适合学生年龄段\n"
        f"- 末尾自然过渡到要学的知识点\n"
        f"- 全部使用中文，直接输出 markdown"
    )


def _build_animation_prompt(
    node_title: str, node_summary: str, difficulty: int, step_spec: dict
) -> str:
    hint = step_spec.get("spec", {}).get("prompt_hint", "")
    return (
        f"请为知识节点《{node_title}》创作一段视觉化描述，帮助学生想象概念的动态过程。\n\n"
        f"知识简介：{node_summary}\n"
        f"内容提示：{hint}\n\n"
        f"要求：\n"
        f"- 描述这个知识点如果可视化/动画化应该呈现什么画面\n"
        f"- 用清晰的步骤描述，配合文字说明\n"
        f"- 200-300 字，全部使用中文，markdown 格式"
    )


def _build_code_prompt(
    node_title: str, node_summary: str, difficulty: int, step_spec: dict
) -> str:
    difficulty_desc = "入门级" if difficulty <= 3 else "中级" if difficulty <= 6 else "高级"
    hint = step_spec.get("spec", {}).get("prompt_hint", "")
    return (
        f"你是一位代码老师，请为知识节点《{node_title}》提供代码示例与解析。\n\n"
        f"知识简介：{node_summary}\n"
        f"难度：{difficulty}/10（{difficulty_desc}）\n"
        f"内容提示：{hint}\n\n"
        f"要求：\n"
        f"- 提供 2-3 个代码示例，每个用 ## 标题开头\n"
        f"- 代码完整可运行，逐行添加注释\n"
        f"- 使用 markdown 代码块格式\n"
        f"- 如果该知识点不涉及编程，输出「本节点无代码示例」\n"
        f"- 全部使用中文"
    )


def _build_practice_prompt(
    node_title: str, node_summary: str, difficulty: int, step_spec: dict
) -> str:
    exercise_count = step_spec.get("spec", {}).get("exercise_count", 3)
    hint = step_spec.get("spec", {}).get("prompt_hint", "")
    return (
        f"你是一位练习题设计师，请为知识节点《{node_title}》设计 {exercise_count} 道练习题。\n\n"
        f"知识简介：{node_summary}\n"
        f"侧重点：{hint}\n\n"
        f"请严格按以下 JSON 格式输出（不要包含 markdown 代码块标记）：\n"
        f'{{"exercises": [\n'
        f'  {{"type": "choice", "question": "题目", "options": ["A","B","C","D"], '
        f'"correct": 0, "answer": "", "hint": "提示", "explanation": "解析", "difficulty": "easy", "points": 10}},\n'
        f'  {{"type": "fill_blank", "question": "Python 用 ___ 定义函数", "options": [], '
        f'"correct": -1, "answer": "def", "hint": "提示", "explanation": "解析", "difficulty": "medium", "points": 10}},\n'
        f'  {{"type": "short_answer", "question": "请解释...", "options": [], '
        f'"correct": -1, "answer": "参考答案", "hint": "提示", "explanation": "解析", "difficulty": "hard", "points": 15}}\n'
        f'], "total_points": 35, "pass_score": 20}}\n\n'
        f"要求：\n"
        f"- 共 {exercise_count} 道题，由易到难\n"
        f"- 类型包含 choice/fill_blank/short_answer\n"
        f"- total_points 是所有 points 之和，pass_score 约为 60%\n"
        f"- 全部使用中文，直接输出 JSON"
    )


def _build_summary_prompt(
    node_title: str, node_summary: str, difficulty: int, step_spec: dict
) -> str:
    hint = step_spec.get("spec", {}).get("prompt_hint", "")
    return (
        f"请为知识节点《{node_title}》生成学习总结。\n\n"
        f"知识简介：{node_summary}\n"
        f"内容提示：{hint}\n\n"
        f"要求：\n"
        f"- 用 5-8 个要点总结核心内容，每个要点一句话\n"
        f"- 最后加一段鼓励性话语\n"
        f"- 使用 markdown 列表格式，全部中文"
    )


def _validate_practice_json(content: str) -> str:
    """Validate and clean practice JSON, returns original on failure."""
    text = content.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
        text = text.strip()

    try:
        data = json.loads(text)
        if not isinstance(data, dict) or "exercises" not in data:
            return content
        exercises = data.get("exercises", [])
        if not exercises:
            return content
        if "total_points" not in data:
            data["total_points"] = sum(ex.get("points", 10) for ex in exercises)
        if "pass_score" not in data:
            data["pass_score"] = int(data["total_points"] * 0.6)
        return json.dumps(data, ensure_ascii=False)
    except (json.JSONDecodeError, TypeError):
        return content


async def generate_step(
    step_spec: dict,
    node_title: str,
    node_summary: str,
    difficulty: int,
    milestone_title: str,
    llm: Any,
    lesson_plan: dict | None = None,
) -> dict:
    """Generate content for a single course step.

    Args:
        step_spec: Step specification from CourseManifest (has type, title, spec, etc.)
        node_title: Knowledge node title.
        node_summary: Knowledge node summary.
        difficulty: Difficulty level (1-10).
        milestone_title: Parent milestone title.
        llm: LLM instance.
        lesson_plan: Optional existing lesson plan (for game type reuse).

    Returns:
        CourseStep dict with status, content/html/practice_data populated.
    """
    from langchain_core.messages import HumanMessage

    step_type = step_spec.get("type", "concept")
    step_index = step_spec.get("step_index", 0)
    step_title = step_spec.get("title", f"步骤 {step_index + 1}")

    base = {
        "step_index": step_index,
        "type": step_type,
        "title": step_title,
        "status": "ready",
        "content": "",
        "html": "",
        "practice_data": "",
        "audio_url": "",
    }

    try:
        if step_type in ("concept",):
            prompt = _build_concept_prompt(node_title, node_summary, difficulty, step_spec)
            response = llm.invoke([HumanMessage(content=prompt)])
            base["content"] = response.content

        elif step_type == "story":
            prompt = _build_story_prompt(node_title, node_summary, difficulty, step_spec)
            response = llm.invoke([HumanMessage(content=prompt)])
            base["content"] = response.content

        elif step_type == "animation":
            # Phase 1: markdown placeholder
            prompt = _build_animation_prompt(node_title, node_summary, difficulty, step_spec)
            response = llm.invoke([HumanMessage(content=prompt)])
            base["content"] = response.content

        elif step_type == "code":
            prompt = _build_code_prompt(node_title, node_summary, difficulty, step_spec)
            response = llm.invoke([HumanMessage(content=prompt)])
            base["content"] = response.content

        elif step_type == "practice":
            prompt = _build_practice_prompt(node_title, node_summary, difficulty, step_spec)
            response = llm.invoke([HumanMessage(content=prompt)])
            practice_json = _validate_practice_json(response.content)
            base["practice_data"] = practice_json

        elif step_type == "summary":
            prompt = _build_summary_prompt(node_title, node_summary, difficulty, step_spec)
            response = llm.invoke([HumanMessage(content=prompt)])
            base["content"] = response.content

        elif step_type == "game":
            # Use GameSpec -> GameCompiler pipeline
            lab_strategy = {}
            game_spec_info = step_spec.get("spec", {})
            if game_spec_info.get("game_mechanic"):
                lab_strategy["game_mechanic"] = game_spec_info["game_mechanic"]
            if game_spec_info.get("game_concept"):
                lab_strategy["game_concept"] = game_spec_info["game_concept"]

            # Fallback: generate markdown description for game steps
            prompt = _build_concept_prompt(node_title, node_summary, difficulty, step_spec)
            response = llm.invoke([HumanMessage(content=prompt)])
            base["content"] = response.content
            base["type"] = "concept"

        else:
            # Unknown type: generate as concept
            logger.warning(f"Unknown step type '{step_type}', generating as concept")
            prompt = _build_concept_prompt(node_title, node_summary, difficulty, step_spec)
            response = llm.invoke([HumanMessage(content=prompt)])
            base["content"] = response.content
            base["type"] = "concept"

    except Exception:
        logger.exception(f"generate_step failed for step {step_index} type={step_type}")
        base["status"] = "failed"

    return base
