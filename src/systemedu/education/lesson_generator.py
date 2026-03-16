"""AI-powered lesson content generation for knowledge nodes."""

import json
import logging
from datetime import datetime

from systemedu.education.project_loader import ProjectContext, load_project_context

logger = logging.getLogger(__name__)

# Section definitions: (key, prompt_label, instruction)
SECTIONS = [
    (
        "concept",
        "核心概念讲解",
        "请用清晰易懂的方式讲解这个知识点的核心概念。"
        "内容必须分成 3-5 个小节，每小节用 ## 标题开头（如 ## 什么是变量、## 为什么重要、## 小结）。"
        "每小节 100-200 字，使用 markdown 格式，包含段落、列表等。"
        "适当使用类比帮助理解。总内容不少于 300 字。",
    ),
    (
        "examples",
        "示例与图解",
        "请提供 2-3 个具体的示例来说明这个概念，以结构化 JSON 格式输出。\n"
        "你必须严格按照以下 JSON 格式输出（不要包含 markdown 代码块标记）：\n"
        '{"examples": [{"template": "<模板类型>", "title": "示例标题", "data": { ... }, "fallback_markdown": "纯文本降级内容"}]}\n\n'
        "可用的模板类型及其 data 格式：\n"
        '1. "step-by-step": {"steps": [{"title": "步骤标题", "content": "步骤内容", "highlight": "关键点"}]}\n'
        '2. "comparison": {"left": {"label": "A概念", "points": ["要点1","要点2"]}, "right": {"label": "B概念", "points": ["要点1","要点2"]}, "conclusion": "总结"}\n'
        '3. "flowchart": {"nodes": [{"id": "n1", "label": "节点名", "description": "描述"}], "edges": [{"from": "n1", "to": "n2", "label": "条件"}]}\n'
        '4. "timeline": {"events": [{"time": "时间标签", "title": "事件标题", "description": "描述"}]}\n'
        '5. "formula": {"expression": "公式文本", "parts": [{"text": "部分", "explanation": "解释"}], "description": "整体说明"}\n'
        '6. "cause-effect": {"chains": [{"cause": "原因", "effect": "结果", "explanation": "解释"}]}\n'
        '7. "anatomy": {"title": "结构名称", "parts": [{"name": "部件名", "description": "描述", "x": 50, "y": 50}]}\n\n'
        "根据知识点内容选择最合适的模板类型，每个示例可使用不同模板。\n"
        "fallback_markdown 必须包含该示例的纯文本版本，以备降级显示。\n"
        "全部内容使用中文。",
    ),
    (
        "code_samples",
        "代码示例",
        "请提供与这个知识点相关的代码示例。"
        "每个代码示例用 ## 标题开头（如 ## 基础用法、## 进阶示例）。"
        "包含完整可运行的代码，并逐行添加注释说明。"
        "使用 markdown 代码块格式。如果该知识点不涉及编程，写'（本节点无代码示例）'。",
    ),
    (
        "practice",
        "练习题",
        "请设计 2-3 道练习题，由易到难。"
        "每道题用 ## 标题开头（如 ## 练习一：基础题、## 练习二：应用题）。"
        "每道题包含题目描述和提示（不要直接给答案）。使用 markdown 格式。",
    ),
    (
        "key_takeaways",
        "要点总结",
        "请用 5-8 个要点总结这个知识点的核心内容。"
        "每个要点一句话，简洁有力。使用 markdown 列表格式。",
    ),
]


VALID_TEMPLATES = {
    "step-by-step", "comparison", "flowchart", "timeline",
    "formula", "cause-effect", "anatomy",
}


def _validate_examples_json(content: str) -> str:
    """Validate and clean examples JSON content.

    If the content is valid JSON with an 'examples' array containing
    valid template entries, return the cleaned JSON string.
    Otherwise return the original content (markdown fallback on frontend).
    """
    text = content.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
        text = text.strip()

    try:
        data = json.loads(text)
        if not isinstance(data, dict) or "examples" not in data:
            logger.warning("Examples JSON missing 'examples' key, keeping as markdown")
            return content
        examples = data["examples"]
        if not isinstance(examples, list) or len(examples) == 0:
            logger.warning("Examples array empty or not a list, keeping as markdown")
            return content
        for ex in examples:
            if not isinstance(ex, dict):
                return content
            if ex.get("template") not in VALID_TEMPLATES:
                logger.warning(f"Unknown template '{ex.get('template')}', keeping as markdown")
                return content
            if "data" not in ex or "fallback_markdown" not in ex:
                return content
        return text  # Valid JSON, return cleaned version
    except (json.JSONDecodeError, TypeError):
        logger.info("Examples content is not JSON, will use markdown fallback on frontend")
        return content


def _build_section_prompt(
    node_title: str,
    node_summary: str,
    milestone_title: str,
    difficulty: int,
    section_label: str,
    section_instruction: str,
) -> str:
    """Build a prompt for generating one section of lesson content."""
    difficulty_desc = "入门级" if difficulty <= 3 else "中级" if difficulty <= 6 else "高级"
    return (
        f"你是一个专业的教育内容创作者。请为以下知识节点生成「{section_label}」部分的教学内容。\n\n"
        f"知识节点：{node_title}\n"
        f"简介：{node_summary}\n"
        f"所属里程碑：{milestone_title}\n"
        f"难度等级：{difficulty}/10（{difficulty_desc}）\n\n"
        f"要求：\n"
        f"- {section_instruction}\n"
        f"- 全部使用中文\n"
        f"- 适合{difficulty_desc}学习者\n"
        f"- 直接输出内容，不要包含标题前缀如「核心概念讲解：」"
    )


def generate_lesson(project_name: str, knode_id: int, user_id: str = "default") -> dict:
    """Generate lesson content for a knowledge node.

    Loads project context, finds the target node, generates each section
    via LLM, saves to DB, and returns the complete lesson data.

    Returns dict with status and all content fields.
    """
    from systemedu.core.llm_client import get_llm
    from systemedu.storage.db import LessonContent, get_session as get_db_session

    ctx = load_project_context(project_name, user_id=user_id)

    # Find target node and milestone
    target_node = None
    target_milestone = None
    global_idx = 0
    for ms in ctx.tree.milestones:
        for knode in ms.knodes:
            if global_idx == knode_id:
                target_node = knode
                target_milestone = ms
                break
            global_idx += 1
        if target_node:
            break

    if not target_node:
        raise ValueError(f"Node {knode_id} not found in project '{project_name}'")

    # Create or update DB record
    db = get_db_session()
    try:
        lesson = (
            db.query(LessonContent)
            .filter_by(project_name=project_name, knode_id=knode_id)
            .first()
        )
        if lesson is None:
            lesson = LessonContent(
                project_name=project_name,
                knode_id=knode_id,
                status="generating",
                content_type=target_node.content_type.value,
            )
            db.add(lesson)
        else:
            lesson.status = "generating"
        db.commit()

        # Generate each section
        llm = get_llm(streaming=False)
        from langchain_core.messages import HumanMessage

        for section_key, section_label, section_instruction in SECTIONS:
            try:
                prompt = _build_section_prompt(
                    node_title=target_node.title,
                    node_summary=target_node.summary,
                    milestone_title=target_milestone.title,
                    difficulty=target_node.difficulty_level,
                    section_label=section_label,
                    section_instruction=section_instruction,
                )
                response = llm.invoke([HumanMessage(content=prompt)])
                content = response.content

                # Validate examples section as JSON
                if section_key == "examples":
                    content = _validate_examples_json(content)

                setattr(lesson, section_key, content)
                db.commit()
                logger.info(f"Generated section '{section_key}' for node {knode_id}")
            except Exception:
                logger.exception(f"Failed to generate section '{section_key}' for node {knode_id}")
                setattr(lesson, section_key, "")

        # Generate quiz data
        try:
            quiz_prompt = (
                f"你是一个教育测验设计师。请为以下知识点设计 3 道选择题。\n\n"
                f"知识点：{target_node.title}\n"
                f"简介：{target_node.summary}\n\n"
                f"请严格按照以下 JSON 格式输出（不要包含 markdown 代码块标记）：\n"
                f'[{{"question": "题目", "options": ["A选项","B选项","C选项","D选项"], "answer": 0, "explanation": "解析"}}]\n\n'
                f"其中 answer 是正确选项的索引（0-3）。全部使用中文。"
            )
            response = llm.invoke([HumanMessage(content=quiz_prompt)])
            quiz_text = response.content.strip()
            # Try to extract JSON from the response
            if quiz_text.startswith("```"):
                lines = quiz_text.split("\n")
                quiz_text = "\n".join(lines[1:-1])
            json.loads(quiz_text)  # validate
            lesson.quiz_data = quiz_text
        except Exception:
            logger.exception(f"Failed to generate quiz for node {knode_id}")
            lesson.quiz_data = "[]"

        lesson.status = "ready"
        lesson.generated_at = datetime.now()
        db.commit()

        return _lesson_to_dict(lesson)

    except Exception:
        # Mark as failed if something went wrong
        try:
            if lesson:
                lesson.status = "failed"
                db.commit()
        except Exception:
            pass
        raise
    finally:
        db.close()


def _lesson_to_dict(lesson) -> dict:
    """Convert a LessonContent ORM object to a plain dict."""
    return {
        "project_name": lesson.project_name,
        "knode_id": lesson.knode_id,
        "status": lesson.status,
        "concept": lesson.concept or "",
        "examples": lesson.examples or "",
        "code_samples": lesson.code_samples or "",
        "practice": lesson.practice or "",
        "key_takeaways": lesson.key_takeaways or "",
        "quiz_data": lesson.quiz_data or "[]",
        "content_type": lesson.content_type or "text",
        "generated_at": lesson.generated_at.isoformat() if lesson.generated_at else None,
    }
