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
        "请提供 4-5 个示例来说明这个概念，以结构化 JSON 格式输出。\n"
        "你必须严格按照以下 JSON 格式输出（不要包含 markdown 代码块标记）：\n"
        '{"examples": [{"template": "<模板类型>", "title": "示例标题", "data": { ... }, "fallback_markdown": "纯文本降级内容"}]}\n\n'
        "【重要】你必须输出 4-5 个示例，其中：\n"
        "- 前 1-2 个使用可视化模板（如 step-by-step, comparison, flowchart 等）来讲解概念\n"
        "- 后 2-3 个必须使用互动游戏模板（quiz-choice, match-pairs, sort-order, fill-blanks, true-false）让学生动手操练\n"
        "- 互动游戏模板是强制要求，不可省略！\n\n"
        "可视化模板及 data 格式：\n"
        '1. "step-by-step": {"steps": [{"title": "步骤标题", "content": "步骤内容", "highlight": "关键点"}]}\n'
        '2. "comparison": {"left": {"label": "A概念", "points": ["要点1","要点2"]}, "right": {"label": "B概念", "points": ["要点1","要点2"]}, "conclusion": "总结"}\n'
        '3. "flowchart": {"nodes": [{"id": "n1", "label": "节点名", "description": "描述"}], "edges": [{"from": "n1", "to": "n2", "label": "条件"}]}\n'
        '4. "timeline": {"events": [{"time": "时间标签", "title": "事件标题", "description": "描述"}]}\n'
        '5. "formula": {"expression": "公式文本", "parts": [{"text": "部分", "explanation": "解释"}], "description": "整体说明"}\n'
        '6. "cause-effect": {"chains": [{"cause": "原因", "effect": "结果", "explanation": "解释"}]}\n'
        '7. "anatomy": {"title": "结构名称", "parts": [{"name": "部件名", "description": "描述", "x": 50, "y": 50}]}\n\n'
        "互动游戏模板及 data 格式（必须使用至少 2 个）：\n"
        '8. "quiz-choice"（选择题闯关）: {"questions": [{"question": "题目", "options": ["选项A","选项B","选项C","选项D"], "correct": 0, "explanation": "解析", "hint": "提示"}]}  — 设计 3-4 道选择题\n'
        '9. "match-pairs"（连线配对）: {"instruction": "将左右对应项配对", "pairs": [{"left": "概念", "right": "定义"}]}  — 设计 4-6 对配对\n'
        '10. "sort-order"（排序挑战）: {"instruction": "按正确顺序排列", "items": ["第一步","第二步","第三步"]}  — items 数组是正确顺序，前端会自动打乱\n'
        '11. "fill-blanks"（填空题）: {"instruction": "填入正确的词", "segments": [{"type": "text", "content": "前缀文本"}, {"type": "blank", "content": "正确答案"}, {"type": "text", "content": "后缀文本"}], "distractors": ["干扰词"]}  — 设计 2-4 个空\n'
        '12. "true-false"（判断对错）: {"statements": [{"text": "陈述句", "correct": true, "explanation": "解析"}]}  — 设计 4-5 个判断题\n\n'
        "每个示例可使用不同模板，选择最适合知识点的类型。\n"
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
    "quiz-choice", "match-pairs", "sort-order", "fill-blanks", "true-false",
}

GAME_TEMPLATES = {"quiz-choice", "match-pairs", "sort-order", "fill-blanks", "true-false"}


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


def _build_games_prompt(node_title: str, node_summary: str, difficulty: int) -> str:
    """Build a dedicated prompt to generate interactive game examples."""
    difficulty_desc = "入门级" if difficulty <= 3 else "中级" if difficulty <= 6 else "高级"
    return (
        f"你是一个教育游戏设计师。请为以下知识点设计 2 个互动小游戏，让学生通过操作来巩固知识。\n\n"
        f"知识点：{node_title}\n"
        f"简介：{node_summary}\n"
        f"难度：{difficulty_desc}\n\n"
        f"请严格按以下 JSON 格式输出（不要包含 markdown 代码块标记）：\n"
        f'{{"examples": [...]}}\n\n'
        f"从以下 5 种游戏模板中选择 2 种最适合的：\n\n"
        f'1. "quiz-choice"（选择题闯关）:\n'
        f'   {{"template": "quiz-choice", "title": "标题", "data": {{"questions": [{{"question": "题目", "options": ["A","B","C","D"], "correct": 0, "explanation": "解析", "hint": "提示"}}]}}, "fallback_markdown": "纯文本版"}}\n'
        f'   要求：设计 3-4 道题，correct 是正确答案的索引(0-3)\n\n'
        f'2. "match-pairs"（连线配对）:\n'
        f'   {{"template": "match-pairs", "title": "标题", "data": {{"instruction": "说明", "pairs": [{{"left": "概念", "right": "定义"}}]}}, "fallback_markdown": "纯文本版"}}\n'
        f'   要求：设计 4-6 对配对\n\n'
        f'3. "sort-order"（排序挑战）:\n'
        f'   {{"template": "sort-order", "title": "标题", "data": {{"instruction": "说明", "items": ["第一","第二","第三"]}}, "fallback_markdown": "纯文本版"}}\n'
        f'   要求：items 数组按正确顺序排列（前端会自动打乱），3-6 个项目\n\n'
        f'4. "fill-blanks"（填空题）:\n'
        f'   {{"template": "fill-blanks", "title": "标题", "data": {{"instruction": "说明", "segments": [{{"type": "text", "content": "前文"}}, {{"type": "blank", "content": "答案"}}, {{"type": "text", "content": "后文"}}], "distractors": ["干扰词"]}}, "fallback_markdown": "纯文本版"}}\n'
        f'   要求：2-4 个空，2-3 个干扰词\n\n'
        f'5. "true-false"（判断对错）:\n'
        f'   {{"template": "true-false", "title": "标题", "data": {{"statements": [{{"text": "陈述", "correct": true, "explanation": "解析"}}]}}, "fallback_markdown": "纯文本版"}}\n'
        f'   要求：4-5 个判断题，true/false 混合\n\n'
        f"全部使用中文，适合{difficulty_desc}学习者。直接输出 JSON，不要其他文字。"
    )


def _ensure_game_templates(
    examples_content: str,
    node_title: str,
    node_summary: str,
    difficulty: int,
    llm,
) -> str:
    """Ensure examples contain at least one game template.

    If the existing examples JSON has no game templates, generate them
    separately and merge into the examples array.
    """
    from langchain_core.messages import HumanMessage

    # Parse existing content
    text = examples_content.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
        text = text.strip()

    try:
        data = json.loads(text)
        examples = data.get("examples", [])
    except (json.JSONDecodeError, TypeError):
        examples = []
        data = {"examples": examples}

    # Check if any game template already exists
    has_game = any(
        ex.get("template") in GAME_TEMPLATES
        for ex in examples
        if isinstance(ex, dict)
    )

    if has_game:
        logger.info("Examples already contain game templates, skipping supplement")
        return examples_content

    # Generate game templates separately
    logger.info("No game templates found, generating supplemental games...")
    prompt = _build_games_prompt(node_title, node_summary, difficulty)
    try:
        response = llm.invoke([HumanMessage(content=prompt)])
        game_text = response.content.strip()
        if game_text.startswith("```"):
            lines = game_text.split("\n")
            game_text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
            game_text = game_text.strip()

        game_data = json.loads(game_text)
        game_examples = game_data.get("examples", [])

        # Validate game examples
        valid_games = []
        for ex in game_examples:
            if (
                isinstance(ex, dict)
                and ex.get("template") in GAME_TEMPLATES
                and "data" in ex
                and "fallback_markdown" in ex
            ):
                valid_games.append(ex)

        if valid_games:
            data["examples"] = examples + valid_games
            logger.info(f"Added {len(valid_games)} game templates to examples")
            return json.dumps(data, ensure_ascii=False)
        else:
            logger.warning("Game generation returned no valid game templates")
    except Exception:
        logger.exception("Failed to generate supplemental game templates")

    return examples_content


def _generate_interactive_lab(node_title: str, node_summary: str, difficulty: int, llm) -> str:
    """Two-stage LLM pipeline: design experiment, then generate runnable React HTML.

    Stage 1: LLM designs the interactive experiment (parameters, visuals, logic).
    Stage 2: LLM generates a complete standalone HTML page with React 18 + SVG.

    Returns the full HTML string, or empty string on failure.
    """
    from langchain_core.messages import HumanMessage

    difficulty_desc = "入门级" if difficulty <= 3 else "中级" if difficulty <= 6 else "高级"

    # --- Stage 1: Experiment Design ---
    design_prompt = (
        f"你是一个教育互动实验设计师。请为以下知识点设计一个交互式实验模拟器。\n\n"
        f"知识点：{node_title}\n"
        f"简介：{node_summary}\n"
        f"难度：{difficulty_desc}\n\n"
        f"请输出实验设计 JSON（不要包含 markdown 代码块标记）：\n"
        f'{{\n'
        f'  "experiment_title": "实验名称",\n'
        f'  "description": "一句话描述",\n'
        f'  "parameters": [\n'
        f'    {{"name": "param1", "label": "显示名", "min": 0, "max": 100, "default": 50, "unit": "单位"}}\n'
        f'  ],\n'
        f'  "visualization": "描述可视化效果（如：左侧滑块控制面板，右侧 SVG 画布显示…）",\n'
        f'  "formula_logic": "描述计算逻辑",\n'
        f'  "interaction": "描述用户操作（如：拖动滑块调节参数，点击按钮，观察动画）"\n'
        f'}}\n\n'
        f"设计要求：\n"
        f"- 实验必须有 2-4 个可调参数（滑块或按钮）\n"
        f"- 必须有直观的可视化反馈（SVG 图形随参数实时变化）\n"
        f"- 适合{difficulty_desc}学习者，操作简单直观\n"
        f"- 直接输出 JSON，不要其他文字"
    )

    try:
        response = llm.invoke([HumanMessage(content=design_prompt)])
        design_text = response.content.strip()
        # Strip markdown code fences
        if design_text.startswith("```"):
            lines = design_text.split("\n")
            design_text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
            design_text = design_text.strip()

        # Validate it's valid JSON
        design_json = json.loads(design_text)
        logger.info(f"Stage 1 done: experiment design for '{node_title}': {design_json.get('experiment_title', '?')}")
    except Exception:
        logger.exception(f"Interactive lab stage 1 failed for '{node_title}'")
        return ""

    # --- Stage 2: React Code Generation ---
    code_prompt = (
        f"你是一个前端开发专家。请根据以下实验设计，生成一个完整的、可在浏览器中独立运行的 HTML 页面。\n\n"
        f"实验设计：\n{json.dumps(design_json, ensure_ascii=False, indent=2)}\n\n"
        f"技术要求：\n"
        f"- 使用 React 18（通过 CDN: https://unpkg.com/react@18/umd/react.production.min.js 和 https://unpkg.com/react-dom@18/umd/react-dom.production.min.js）\n"
        f"- 使用 Babel standalone（https://unpkg.com/@babel/standalone/babel.min.js）编译 JSX\n"
        f"- 所有 CSS 内联在 <style> 标签中，使用现代简洁风格\n"
        f"- 使用 SVG 做可视化，不依赖外部图片或库\n"
        f"- 必须使用 React.useState 管理参数状态\n"
        f"- 必须有滑块（input range）或按钮等交互控件\n"
        f"- 参数变化时可视化必须实时更新\n"
        f"- 页面背景色为白色，字体使用 system-ui\n"
        f"- 布局：上方标题和描述，中间左侧控制面板（滑块+数值显示），右侧 SVG 可视化区域\n"
        f"- 整个页面代码在一个完整的 <!DOCTYPE html><html>...</html> 中\n"
        f"- script type 必须是 text/babel\n"
        f"- 使用 ReactDOM.createRoot 渲染\n\n"
        f"直接输出完整 HTML 代码，不要包含 markdown 代码块标记，不要输出任何其他文字。"
    )

    try:
        response = llm.invoke([HumanMessage(content=code_prompt)])
        html_code = response.content.strip()
        # Strip markdown code fences
        if html_code.startswith("```"):
            lines = html_code.split("\n")
            html_code = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
            html_code = html_code.strip()

        # Basic validation: must contain key markers
        if "<html" not in html_code.lower() or "react" not in html_code.lower():
            logger.warning(f"Interactive lab stage 2 output doesn't look like valid HTML+React for '{node_title}'")
            return ""

        logger.info(f"Stage 2 done: generated {len(html_code)} chars of HTML for '{node_title}'")
        return html_code
    except Exception:
        logger.exception(f"Interactive lab stage 2 failed for '{node_title}'")
        return ""


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

                # Validate examples section as JSON, then ensure game templates
                if section_key == "examples":
                    content = _validate_examples_json(content)
                    content = _ensure_game_templates(
                        content,
                        node_title=target_node.title,
                        node_summary=target_node.summary,
                        difficulty=target_node.difficulty_level,
                        llm=llm,
                    )

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

        # Generate interactive lab (two-stage pipeline)
        try:
            lab_html = _generate_interactive_lab(
                node_title=target_node.title,
                node_summary=target_node.summary,
                difficulty=target_node.difficulty_level,
                llm=llm,
            )
            lesson.interactive_lab = lab_html
            db.commit()
            if lab_html:
                logger.info(f"Generated interactive lab for node {knode_id}")
            else:
                logger.info(f"No interactive lab generated for node {knode_id}")
        except Exception:
            logger.exception(f"Failed to generate interactive lab for node {knode_id}")
            lesson.interactive_lab = ""

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
        "interactive_lab": lesson.interactive_lab or "",
        "content_type": lesson.content_type or "text",
        "generated_at": lesson.generated_at.isoformat() if lesson.generated_at else None,
    }
