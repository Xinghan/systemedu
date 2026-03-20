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
        "请设计 3-5 道练习题，由易到难，以结构化 JSON 格式输出。\n"
        "你必须严格按照以下 JSON 格式输出（不要包含 markdown 代码块标记）：\n"
        '{"exercises": [\n'
        '  {"type": "choice", "question": "题目描述", "options": ["A选项","B选项","C选项","D选项"], '
        '"correct": 0, "answer": "", "hint": "提示", "explanation": "解析", "difficulty": "easy", "points": 10},\n'
        '  {"type": "fill_blank", "question": "Python 中用 ___ 关键字定义函数", "options": [], '
        '"correct": -1, "answer": "def", "hint": "提示", "explanation": "解析", "difficulty": "medium", "points": 10},\n'
        '  {"type": "short_answer", "question": "请解释...", "options": [], '
        '"correct": -1, "answer": "参考答案要点", "hint": "提示", "explanation": "解析", "difficulty": "hard", "points": 15}\n'
        '], "total_points": 35, "pass_score": 20}\n\n'
        "【重要要求】\n"
        "- 必须至少包含 choice（选择题）、fill_blank（填空题）、short_answer（简答题）各一道\n"
        "- choice: correct 是正确选项的索引（0-3），answer 留空\n"
        "- fill_blank: correct 设为 -1，answer 是正确答案文本\n"
        "- short_answer: correct 设为 -1，answer 是参考答案要点\n"
        "- difficulty 从 easy/medium/hard 中选择\n"
        "- total_points 是所有题目 points 之和\n"
        "- pass_score 约为 total_points 的 60%\n"
        "- 全部使用中文，直接输出 JSON，不要其他文字",
    ),
    (
        "key_takeaways",
        "要点总结",
        "请用 5-8 个要点总结这个知识点的核心内容。"
        "每个要点一句话，简洁有力。使用 markdown 列表格式。",
    ),
    (
        "teacher_script",
        "老师讲义",
        "你是一位亲切的 AI 老师，正在为学生录制这节课的语音讲解。"
        "请根据本节知识点的核心概念，写一段口语化的讲义文本。"
        "要求：\n"
        "- 语气亲切自然，像跟学生面对面聊天\n"
        "- 300-500 字，不超过 2 分钟朗读时长\n"
        "- 先问候引入，再逐步讲解核心概念，最后总结鼓励\n"
        "- 不要使用 markdown 格式，输出纯文本\n"
        "- 全部使用中文",
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


def _validate_practice_json(content: str) -> str:
    """Validate and clean practice JSON content.

    If the content is valid JSON with an 'exercises' array, return cleaned JSON.
    Otherwise return the original content (frontend will fall back to markdown).
    """
    text = content.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
        text = text.strip()

    try:
        data = json.loads(text)
        if not isinstance(data, dict) or "exercises" not in data:
            logger.warning("Practice JSON missing 'exercises' key, keeping as markdown")
            return content
        exercises = data["exercises"]
        if not isinstance(exercises, list) or len(exercises) == 0:
            logger.warning("Practice exercises array empty, keeping as markdown")
            return content
        valid_types = {"choice", "fill_blank", "short_answer"}
        for ex in exercises:
            if not isinstance(ex, dict):
                return content
            if ex.get("type") not in valid_types:
                logger.warning(f"Unknown exercise type '{ex.get('type')}', keeping as markdown")
                return content
        # Ensure total_points and pass_score exist
        if "total_points" not in data:
            data["total_points"] = sum(ex.get("points", 10) for ex in exercises)
        if "pass_score" not in data:
            data["pass_score"] = int(data["total_points"] * 0.6)
        return json.dumps(data, ensure_ascii=False)
    except (json.JSONDecodeError, TypeError):
        logger.info("Practice content is not JSON, will use markdown fallback on frontend")
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


async def _generate_interactive_lab(
    node_title: str,
    node_summary: str,
    difficulty: int,
    llm,
    lesson_plan: dict | None = None,
    progress_callback=None,
) -> str:
    """Generate a runnable HTML game using the GameAgent pipeline.

    Pipeline: GameSpecPlannerAgent (LLM) → GameCompiler (Python)

    Falls back gracefully if any stage fails.

    Args:
        node_title: Title of the knowledge node.
        node_summary: Brief summary.
        difficulty: Difficulty level (1-10).
        llm: LLM instance.
        lesson_plan: Optional teaching strategy from LessonPlannerAgent.
        progress_callback: Optional callback(step_name, status, preview).

    Returns the full HTML string, or empty string on failure.
    """
    from systemedu.agents.builtin.gameagent.compiler import GameCompiler
    from systemedu.agents.builtin.gameagent.planner import GameSpecPlannerAgent

    # Extract lab_strategy from lesson_plan
    lab_strategy = {}
    if lesson_plan:
        lab_strategy = lesson_plan.get("lab_strategy", {})

    # Stage 1: Planner (LLM) — generate GameSpec JSON
    if progress_callback:
        progress_callback("game_spec_planner", "in_progress", "")
    planner = GameSpecPlannerAgent(llm=llm)
    spec = await planner.plan(node_title, node_summary, difficulty, lab_strategy)
    if progress_callback:
        if spec:
            progress_callback("game_spec_planner", "completed", f"mechanic={spec.mechanic}")
        else:
            progress_callback("game_spec_planner", "failed", "")

    # Stage 2: Compiler (Python, no LLM) — inject spec into HTML template
    html = ""
    if spec:
        if progress_callback:
            progress_callback("game_compiler", "in_progress", "")
        try:
            html = GameCompiler().compile(spec)
            if progress_callback:
                progress_callback("game_compiler", "completed", f"{len(html)} chars")
        except Exception:
            logger.exception(f"GameCompiler failed for '{node_title}'")
            if progress_callback:
                progress_callback("game_compiler", "failed", "")
    else:
        if progress_callback:
            progress_callback("game_compiler", "completed", "跳过：无 spec")

    return html


def _extract_plan_context_for_section(section_key: str, lesson_plan: dict) -> str:
    """Extract relevant strategy guidance from the lesson plan for a specific section."""
    parts = []
    if section_key == "concept":
        emphasis = lesson_plan.get("concept_emphasis", "")
        approach = lesson_plan.get("concept_approach", "")
        depth = lesson_plan.get("concept_depth", "")
        if emphasis:
            parts.append(f"- 核心要点：{emphasis}")
        if approach:
            approach_map = {
                "analogy": "使用类比帮助理解",
                "visual": "使用可视化方式展示",
                "story": "用故事串联知识",
                "definition_first": "先给出精确定义再展开",
            }
            parts.append(f"- 讲解方式：{approach_map.get(approach, approach)}")
        if depth:
            depth_map = {"shallow": "浅层理解即可", "medium": "适度深入", "deep": "深入讲解"}
            parts.append(f"- 深度要求：{depth_map.get(depth, depth)}")
        vocab = lesson_plan.get("key_vocabulary", [])
        if vocab:
            parts.append(f"- 必须涵盖的关键术语：{', '.join(vocab)}")

    elif section_key == "examples":
        ex_strategy = lesson_plan.get("example_strategy", {})
        if isinstance(ex_strategy, dict):
            focus = ex_strategy.get("example_focus", "")
            if focus:
                parts.append(f"- 示例角度：{focus}")
            vis_templates = ex_strategy.get("recommended_visual_templates", [])
            if vis_templates:
                parts.append(f"- 推荐可视化模板：{', '.join(vis_templates)}")
            game_templates = ex_strategy.get("recommended_game_templates", [])
            if game_templates:
                parts.append(f"- 推荐游戏模板：{', '.join(game_templates)}")

    elif section_key == "practice":
        pr_strategy = lesson_plan.get("practice_strategy", {})
        if isinstance(pr_strategy, dict):
            progression = pr_strategy.get("progression", "")
            connection = pr_strategy.get("connection_to_lab", "")
            if progression:
                parts.append(f"- 练习递进逻辑：{progression}")
            if connection:
                parts.append(f"- 与实验的关联：{connection}")

    # Add overall tone guidance for all sections
    tone = lesson_plan.get("overall_tone", "")
    if tone:
        tone_map = {
            "playful": "活泼有趣",
            "encouraging": "鼓励引导",
            "rigorous": "严谨细致",
            "hands_on": "注重动手实践",
        }
        parts.append(f"- 整体语气：{tone_map.get(tone, tone)}")

    if not parts:
        return ""
    return "\n\n【教学策划指引】\n" + "\n".join(parts)


def _build_section_prompt(
    node_title: str,
    node_summary: str,
    milestone_title: str,
    difficulty: int,
    section_label: str,
    section_instruction: str,
    lesson_plan: dict | None = None,
) -> str:
    """Build a prompt for generating one section of lesson content."""
    difficulty_desc = "入门级" if difficulty <= 3 else "中级" if difficulty <= 6 else "高级"

    plan_context = ""
    if lesson_plan:
        # Determine section_key from section_label
        section_key_map = {
            "核心概念讲解": "concept",
            "示例与图解": "examples",
            "代码示例": "code_samples",
            "练习题": "practice",
            "要点总结": "key_takeaways",
            "老师讲义": "teacher_script",
        }
        section_key = section_key_map.get(section_label, "")
        if section_key:
            plan_context = _extract_plan_context_for_section(section_key, lesson_plan)

    return (
        f"你是一个专业的教育内容创作者。请为以下知识节点生成「{section_label}」部分的教学内容。\n\n"
        f"知识节点：{node_title}\n"
        f"简介：{node_summary}\n"
        f"所属里程碑：{milestone_title}\n"
        f"难度等级：{difficulty}/10（{difficulty_desc}）\n"
        f"{plan_context}\n\n"
        f"要求：\n"
        f"- {section_instruction}\n"
        f"- 全部使用中文\n"
        f"- 适合{difficulty_desc}学习者\n"
        f"- 直接输出内容，不要包含标题前缀如「核心概念讲解：」"
    )


def _update_progress(db, project_name: str, knode_id: int, step_name: str,
                     step_label: str, agent_name: str, status: str, preview: str = ""):
    """Upsert a LessonGenerationProgress record."""
    from systemedu.storage.db import LessonGenerationProgress

    record = (
        db.query(LessonGenerationProgress)
        .filter_by(project_name=project_name, knode_id=knode_id, step_name=step_name)
        .first()
    )
    if record is None:
        record = LessonGenerationProgress(
            project_name=project_name,
            knode_id=knode_id,
            step_name=step_name,
            step_label=step_label,
            agent_name=agent_name,
            status=status,
            output_preview=preview,
        )
        db.add(record)
    else:
        record.status = status
        record.step_label = step_label
        record.agent_name = agent_name
        record.output_preview = preview

    if status == "in_progress" and record.started_at is None:
        record.started_at = datetime.now()
    if status in ("completed", "failed"):
        record.completed_at = datetime.now()

    db.commit()


def _init_progress_steps(db, project_name: str, knode_id: int):
    """Initialize all progress steps as pending at the start of generation."""
    from systemedu.storage.db import LessonGenerationProgress

    # Clear old progress records for this node
    db.query(LessonGenerationProgress).filter_by(
        project_name=project_name, knode_id=knode_id
    ).delete()
    db.commit()

    steps = [
        ("planner", "课程策划", "策划小助手"),
        ("concept", "核心概念讲解", "概念老师"),
        ("examples", "示例与图解", "示例设计师"),
        ("code_samples", "代码示例", "代码老师"),
        ("practice", "练习题", "练习设计师"),
        ("key_takeaways", "要点总结", "总结老师"),
        ("quiz", "测验题", "出题老师"),
        ("teacher_script", "老师讲义", "讲稿老师"),
        ("game_spec_planner", "实验-游戏策划", "游戏策划师"),
        ("game_compiler", "实验-游戏编译", "编译小助手"),
        ("tts", "语音合成", "朗读老师"),
    ]
    for step_name, step_label, agent_name in steps:
        record = LessonGenerationProgress(
            project_name=project_name,
            knode_id=knode_id,
            step_name=step_name,
            step_label=step_label,
            agent_name=agent_name,
            status="pending",
        )
        db.add(record)
    db.commit()


async def generate_lesson(project_name: str, knode_id: int, user_id: str = "default") -> dict:
    """Generate lesson content for a knowledge node.

    Loads project context, finds the target node, runs the LessonPlannerAgent
    for strategy, generates each section via LLM with strategy guidance,
    uses 3-Agent pipeline for interactive lab, tracks progress in DB,
    and returns the complete lesson data.

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

        # Initialize progress tracking
        _init_progress_steps(db, project_name, knode_id)

        # Generate each section
        llm = get_llm(streaming=False)
        from langchain_core.messages import HumanMessage

        # Step 1: LessonPlannerAgent — create teaching strategy (or reuse cached)
        lesson_plan = None

        # Try to load cached plan from DB
        if lesson and lesson.lesson_plan_json:
            try:
                lesson_plan = json.loads(lesson.lesson_plan_json)
                logger.info(f"Reusing cached lesson plan for node {knode_id}")
                _update_progress(db, project_name, knode_id, "planner", "课程策划", "策划小助手", "completed", "复用缓存策划")
            except (json.JSONDecodeError, TypeError):
                lesson_plan = None

        if lesson_plan is None:
            _update_progress(db, project_name, knode_id, "planner", "课程策划", "策划小助手", "in_progress")
            try:
                from systemedu.agents.builtin.lesson_planner import LessonPlannerAgent
                planner = LessonPlannerAgent(llm=llm)
                lesson_plan = await planner.plan(
                    node_title=target_node.title,
                    node_summary=target_node.summary,
                    difficulty=target_node.difficulty_level,
                    content_type=target_node.content_type.value,
                    milestone_title=target_milestone.title,
                )
                if lesson_plan:
                    # Cache the plan
                    lesson.lesson_plan_json = json.dumps(lesson_plan, ensure_ascii=False)
                    db.commit()
                    preview = f"方式: {lesson_plan.get('concept_approach', '?')}, 实验: {lesson_plan.get('lab_strategy', {}).get('game_mechanic', '?')}"
                    _update_progress(db, project_name, knode_id, "planner", "课程策划", "策划小助手", "completed", preview)
                    logger.info(f"Lesson plan created and cached for node {knode_id}")
                else:
                    _update_progress(db, project_name, knode_id, "planner", "课程策划", "策划小助手", "completed", "降级：无策划")
                    logger.info(f"Planner returned None for node {knode_id}, proceeding without plan")
            except Exception:
                logger.exception(f"Planner failed for node {knode_id}, proceeding without plan")
                _update_progress(db, project_name, knode_id, "planner", "课程策划", "策划小助手", "failed")

        # Step 2: Generate content sections with plan guidance
        for section_key, section_label, section_instruction in SECTIONS:
            _update_progress(db, project_name, knode_id, section_key, section_label, "内容老师", "in_progress")
            try:
                prompt = _build_section_prompt(
                    node_title=target_node.title,
                    node_summary=target_node.summary,
                    milestone_title=target_milestone.title,
                    difficulty=target_node.difficulty_level,
                    section_label=section_label,
                    section_instruction=section_instruction,
                    lesson_plan=lesson_plan,
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

                # Validate practice section as structured JSON
                if section_key == "practice":
                    content = _validate_practice_json(content)

                setattr(lesson, section_key, content)
                db.commit()
                preview = f"{len(content)} 字" if content else ""
                _update_progress(db, project_name, knode_id, section_key, section_label, "内容老师", "completed", preview)
                logger.info(f"Generated section '{section_key}' for node {knode_id}")
            except Exception:
                logger.exception(f"Failed to generate section '{section_key}' for node {knode_id}")
                setattr(lesson, section_key, "")
                _update_progress(db, project_name, knode_id, section_key, section_label, "内容老师", "failed")

        # Step 3: Generate quiz data
        _update_progress(db, project_name, knode_id, "quiz", "测验题", "出题老师", "in_progress")
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
            _update_progress(db, project_name, knode_id, "quiz", "测验题", "出题老师", "completed", "3 道题")
        except Exception:
            logger.exception(f"Failed to generate quiz for node {knode_id}")
            lesson.quiz_data = "[]"
            _update_progress(db, project_name, knode_id, "quiz", "测验题", "出题老师", "failed")

        # Step 4: Generate interactive lab (3-Agent pipeline)
        def lab_progress_callback(step_name, status, preview):
            step_labels = {
                "game_spec_planner": "实验-游戏策划",
                "game_compiler": "实验-游戏编译",
            }
            agent_names = {
                "game_spec_planner": "游戏策划师",
                "game_compiler": "编译小助手",
            }
            _update_progress(
                db, project_name, knode_id,
                step_name,
                step_labels.get(step_name, step_name),
                agent_names.get(step_name, ""),
                status,
                preview or "",
            )

        try:
            lab_html = await _generate_interactive_lab(
                node_title=target_node.title,
                node_summary=target_node.summary,
                difficulty=target_node.difficulty_level,
                llm=llm,
                lesson_plan=lesson_plan,
                progress_callback=lab_progress_callback,
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

        # Step 5: TTS audio synthesis — generate per-tab narration scripts + audio
        from systemedu.core.config import get_config
        tts_config = get_config().tts
        if tts_config.enabled:
            _update_progress(db, project_name, knode_id, "tts", "语音合成", "朗读老师", "in_progress")
            try:
                from systemedu.education.tts import synthesize_speech

                node_title = target_node.title if target_node else str(knode_id)

                # Per-tab narration: generate a short oral script for each section
                # then synthesize audio.  Each section gets its own file.
                tab_narrations: list[tuple[str, str, str]] = [
                    # (section_key, content_field_value, filename)
                    ("concept", lesson.concept or "", "concept.wav"),
                    ("practice", lesson.practice or "", "practice.wav"),
                    ("lab", lesson.interactive_lab or "", "lab.wav"),
                    ("key_takeaways", lesson.key_takeaways or "", "key_takeaways.wav"),
                ]

                tab_audio_attrs = {
                    "concept": "concept_audio_url",
                    "practice": "practice_audio_url",
                    "lab": "lab_audio_url",
                    "key_takeaways": "key_takeaways_audio_url",
                }

                tab_script_prompts = {
                    "concept": (
                        f"你是一位亲切的 AI 老师，正在为「{node_title}」这节课录制概念讲解的语音旁白。"
                        "请根据以下概念内容，写一段 150-250 字的口语化讲解，语气亲切自然，像跟学生直接说话，不要使用 markdown，输出纯文本。\n\n内容：\n"
                    ),
                    "practice": (
                        f"你是一位亲切的 AI 老师，正在为「{node_title}」这节课的练习部分录制语音旁白。"
                        "请写一段 100-180 字的口语化引导语，解释练习的目的和做题思路，鼓励学生动手尝试，语气亲切，输出纯文本，不要使用 markdown。\n\n练习内容：\n"
                    ),
                    "lab": (
                        f"你是一位亲切的 AI 老师，正在为「{node_title}」这节课的互动实验录制语音旁白。"
                        "请写一段 100-180 字的口语化引导语，解释实验的学习目标和操作方式，激发学生的动手兴趣，语气活泼，输出纯文本，不要使用 markdown。\n\n实验简介：这是一个互动游戏，帮助学生通过动手操作理解知识点。"
                    ),
                    "key_takeaways": (
                        f"你是一位亲切的 AI 老师，正在为「{node_title}」这节课的要点总结录制语音旁白。"
                        "请根据以下要点，写一段 100-180 字的口语化总结，帮助学生回顾和记忆核心内容，语气温暖鼓励，输出纯文本，不要使用 markdown。\n\n要点：\n"
                    ),
                }

                audio_count = 0
                for section_key, section_content, filename in tab_narrations:
                    if not section_content.strip():
                        continue
                    try:
                        # Generate oral script for this section
                        prompt = tab_script_prompts[section_key] + section_content[:1500]
                        script_resp = llm.invoke([HumanMessage(content=prompt)])
                        oral_script = script_resp.content.strip()
                        if not oral_script:
                            continue

                        audio_path, _ = synthesize_speech(
                            oral_script, project_name, knode_id, filename=filename
                        )
                        attr = tab_audio_attrs[section_key]
                        setattr(lesson, attr, audio_path)
                        db.commit()
                        audio_count += 1
                        logger.info(f"TTS audio generated for {section_key}: {audio_path}")
                    except Exception:
                        logger.exception(f"TTS failed for section {section_key} of node {knode_id}")

                # Also keep teacher_script audio (full lesson narration)
                if lesson.teacher_script and lesson.teacher_script.strip():
                    try:
                        audio_path, timestamps = synthesize_speech(
                            lesson.teacher_script, project_name, knode_id, filename="teacher.wav"
                        )
                        lesson.teacher_audio_url = audio_path
                        lesson.teacher_timestamps = json.dumps(timestamps, ensure_ascii=False)
                        db.commit()
                        audio_count += 1
                    except Exception:
                        logger.exception(f"TTS failed for teacher_script of node {knode_id}")

                _update_progress(
                    db, project_name, knode_id, "tts", "语音合成", "朗读老师",
                    "completed", f"{audio_count} 段音频",
                )
            except Exception:
                logger.exception(f"TTS synthesis failed for node {knode_id}")
                _update_progress(
                    db, project_name, knode_id, "tts", "语音合成", "朗读老师", "failed",
                )
        else:
            _update_progress(
                db, project_name, knode_id, "tts", "语音合成", "朗读老师",
                "completed", "TTS 已禁用",
            )

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
        "teacher_script": lesson.teacher_script or "",
        "teacher_audio_url": lesson.teacher_audio_url or "",
        "teacher_timestamps": lesson.teacher_timestamps or "[]",
        "concept_audio_url": lesson.concept_audio_url or "",
        "practice_audio_url": lesson.practice_audio_url or "",
        "lab_audio_url": lesson.lab_audio_url or "",
        "key_takeaways_audio_url": lesson.key_takeaways_audio_url or "",
        "content_type": lesson.content_type or "text",
        "generated_at": lesson.generated_at.isoformat() if lesson.generated_at else None,
    }
