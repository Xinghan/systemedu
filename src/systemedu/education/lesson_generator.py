"""AI-powered lesson content generation for knowledge nodes."""

import json
import logging
from datetime import datetime

from systemedu.education.project_loader import load_project_context

logger = logging.getLogger(__name__)


class _PendingObjectLabError(Exception):
    """Raised when the interactive lab requires an object not yet in ObjectRegistry."""
    def __init__(self, object_key: str):
        super().__init__(object_key)
        self.object_key = object_key


VALID_TEMPLATES = {
    "step-by-step", "comparison", "flowchart", "timeline",
    "formula", "cause-effect", "anatomy",
    "quiz-choice", "match-pairs", "sort-order", "fill-blanks", "true-false",
}

GAME_TEMPLATES = {"quiz-choice", "match-pairs", "sort-order", "fill-blanks", "true-false"}

PLACEHOLDER_PATTERNS = ["不涉及编程", "无代码", "no code", "n/a", "暂无代码", "本节点无代码示例"]


def _clean_empty_field(text: str) -> str:
    """Return empty string if text is a placeholder with no real content."""
    if not text or len(text.strip()) < 50:
        return ""
    lower = text.lower()
    if any(p in lower for p in PLACEHOLDER_PATTERNS):
        return ""
    return text


def _validate_examples_json(content: str) -> str:
    """Validate and clean examples JSON content."""
    text = content.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
        text = text.strip()

    try:
        data = json.loads(text)
        if not isinstance(data, dict) or "examples" not in data:
            return content
        examples = data["examples"]
        if not isinstance(examples, list) or len(examples) == 0:
            return content
        for ex in examples:
            if not isinstance(ex, dict):
                return content
            if ex.get("template") not in VALID_TEMPLATES:
                logger.warning(f"Unknown template '{ex.get('template')}', keeping as markdown")
                return content
            if "data" not in ex or "fallback_markdown" not in ex:
                return content
        return text
    except (json.JSONDecodeError, TypeError):
        return content


def _validate_practice_json(content: str) -> str:
    """Validate and clean practice JSON content."""
    text = content.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
        text = text.strip()

    try:
        data = json.loads(text)
        if not isinstance(data, dict) or "exercises" not in data:
            return content
        exercises = data["exercises"]
        if not isinstance(exercises, list) or len(exercises) == 0:
            return content
        valid_types = {"choice", "fill_blank", "short_answer"}
        for ex in exercises:
            if not isinstance(ex, dict):
                return content
            if ex.get("type") not in valid_types:
                return content
        if "total_points" not in data:
            data["total_points"] = sum(ex.get("points", 10) for ex in exercises)
        if "pass_score" not in data:
            data["pass_score"] = int(data["total_points"] * 0.6)
        return json.dumps(data, ensure_ascii=False)
    except (json.JSONDecodeError, TypeError):
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


async def _generate_interactive_lab(
    node_title: str,
    node_summary: str,
    difficulty: int,
    llm,
    progress_callback=None,
) -> str:
    """Generate a runnable HTML game using the GameAgent pipeline.

    Pipeline: GameSpecPlannerAgent (LLM) → GameCompiler (Python)
    Falls back gracefully if any stage fails.
    """
    from systemedu.agents.builtin.gameagent.compiler import GameCompiler
    from systemedu.agents.builtin.gameagent.planner import GameSpecPlannerAgent

    if progress_callback:
        progress_callback("game_spec_planner", "in_progress", "")
    planner = GameSpecPlannerAgent(llm=llm)
    try:
        spec = await planner.plan(node_title, node_summary, difficulty, {})
    except Exception as exc:
        from systemedu.agents.builtin.gameagent.planner import _PendingObjectError
        if isinstance(exc, _PendingObjectError):
            if progress_callback:
                progress_callback("game_spec_planner", "pending_object", exc.object_key)
            raise _PendingObjectLabError(exc.object_key) from exc
        raise
    if progress_callback:
        if spec:
            progress_callback("game_spec_planner", "completed", f"mechanic={spec.mechanic}")
        else:
            progress_callback("game_spec_planner", "failed", "")

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

    db.query(LessonGenerationProgress).filter_by(
        project_name=project_name, knode_id=knode_id
    ).delete()
    db.commit()

    steps = [
        ("concept", "核心概念讲解", "内容老师"),
        ("examples", "示例与图解", "示例设计师"),
        ("code_samples", "代码示例", "代码老师"),
        ("practice", "练习题", "练习设计师"),
        ("key_takeaways", "要点总结", "总结老师"),
        ("teacher_script", "老师讲义", "讲稿老师"),
        ("quiz", "测验题", "出题老师"),
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

    Generates each content section directly via LLM (no intermediate planner),
    uses GameSpec pipeline for interactive lab, tracks progress in DB,
    and returns the complete lesson data.

    Returns dict with status and all content fields.
    """
    from systemedu.core.llm_client import get_llm
    from systemedu.storage.db import LessonContent, get_session as get_db_session
    from langchain_core.messages import HumanMessage

    ctx = load_project_context(project_name, user_id=user_id)

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

        _init_progress_steps(db, project_name, knode_id)

        llm = get_llm(streaming=False)

        # Generate each content section
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
                )
                response = llm.invoke([HumanMessage(content=prompt)])
                content = response.content

                if section_key == "examples":
                    content = _validate_examples_json(content)
                if section_key == "practice":
                    content = _validate_practice_json(content)
                if section_key == "code_samples":
                    content = _clean_empty_field(content)

                setattr(lesson, section_key, content)
                db.commit()
                preview = f"{len(content)} 字" if content else ""
                _update_progress(db, project_name, knode_id, section_key, section_label, "内容老师", "completed", preview)
                logger.info(f"Generated section '{section_key}' for node {knode_id}")
            except Exception:
                logger.exception(f"Failed to generate section '{section_key}' for node {knode_id}")
                setattr(lesson, section_key, "")
                _update_progress(db, project_name, knode_id, section_key, section_label, "内容老师", "failed")

        # Generate quiz
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

        # Generate interactive lab
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
                progress_callback=lab_progress_callback,
            )
            lesson.interactive_lab = lab_html
            lesson.interactive_lab_pending_object = ""
            db.commit()
        except _PendingObjectLabError as e:
            lesson.interactive_lab = ""
            lesson.interactive_lab_pending_object = e.object_key
            db.commit()
            logger.info(f"Interactive lab pending object '{e.object_key}' for node {knode_id}")
            lab_progress_callback("game_spec_planner", "pending_object", e.object_key)
        except Exception:
            logger.exception(f"Failed to generate interactive lab for node {knode_id}")
            lesson.interactive_lab = ""

        # TTS audio synthesis
        from systemedu.core.config import get_config
        tts_config = get_config().tts
        if tts_config.enabled:
            _update_progress(db, project_name, knode_id, "tts", "语音合成", "朗读老师", "in_progress")
            try:
                from systemedu.education.tts import synthesize_speech

                node_title = target_node.title
                tab_narrations = [
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
                        prompt = tab_script_prompts[section_key] + section_content[:1500]
                        script_resp = llm.invoke([HumanMessage(content=prompt)])
                        oral_script = script_resp.content.strip()
                        if not oral_script:
                            continue
                        audio_path, _ = synthesize_speech(
                            oral_script, project_name, knode_id, filename=filename
                        )
                        setattr(lesson, tab_audio_attrs[section_key], audio_path)
                        db.commit()
                        audio_count += 1
                    except Exception:
                        logger.exception(f"TTS failed for section {section_key} of node {knode_id}")

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

                _update_progress(db, project_name, knode_id, "tts", "语音合成", "朗读老师",
                                 "completed", f"{audio_count} 段音频")
            except Exception:
                logger.exception(f"TTS synthesis failed for node {knode_id}")
                _update_progress(db, project_name, knode_id, "tts", "语音合成", "朗读老师", "failed")
        else:
            _update_progress(db, project_name, knode_id, "tts", "语音合成", "朗读老师",
                             "completed", "TTS 已禁用")

        lesson.status = "ready"
        lesson.generated_at = datetime.now()
        db.commit()

        return _lesson_to_dict(lesson)

    except Exception:
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
        "interactive_lab_pending_object": lesson.interactive_lab_pending_object or "",
        "teacher_script": lesson.teacher_script or "",
        "teacher_audio_url": lesson.teacher_audio_url or "",
        "teacher_timestamps": lesson.teacher_timestamps or "[]",
        "concept_audio_url": lesson.concept_audio_url or "",
        "practice_audio_url": lesson.practice_audio_url or "",
        "lab_audio_url": lesson.lab_audio_url or "",
        "key_takeaways_audio_url": lesson.key_takeaways_audio_url or "",
        "project_assignment": lesson.project_assignment or "",
        "content_type": lesson.content_type or "text",
        "generated_at": lesson.generated_at.isoformat() if lesson.generated_at else None,
    }


async def generate_course_v2(
    project_name: str,
    knode_id: int,
    user_id: str = "default",
    progress_cb=None,
) -> dict:
    """Generate rich-media course content via 6-agent pipeline.

    Pipeline:
    1. CoursePlannerAgent.plan_detailed() -> plan_markdown
    2. CourseIdeaAgent.identify() -> (plan_with_placeholders, ideas)
    3. CourseIdeaDetailAgent x N (parallel) -> ideas with detail_plan
    4. AnimationGenAgent / GameGenAgent / StoryGenAgent (parallel per idea)
    5. IntegrationAgent.integrate() -> CourseContent
    6. Save to DB course_content field

    progress_cb(event, data): optional callback for SSE progress events.
    Returns dict with status and course_content.
    """
    import asyncio
    from systemedu.core.llm_client import get_llm
    from systemedu.storage.db import LessonContent, get_session as get_db_session
    from systemedu.agents.builtin.course_planner import CoursePlannerAgent
    from systemedu.agents.builtin.course_idea_agent import CourseIdeaAgent
    from systemedu.agents.builtin.course_idea_detail_agent import CourseIdeaDetailAgent
    from systemedu.agents.builtin.animation_gen_agent import AnimationGenAgent
    from systemedu.agents.builtin.game_gen_agent import GameGenAgent
    from systemedu.agents.builtin.story_gen_agent import StoryGenAgent
    from systemedu.agents.builtin.integration_agent import IntegrationAgent

    ctx = load_project_context(project_name, user_id=user_id)

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
                course_content="",
            )
            db.add(lesson)
        else:
            lesson.status = "generating"
            lesson.course_content = ""
        db.commit()

        llm = get_llm(streaming=False)
        node_title = target_node.title
        node_summary = target_node.summary
        difficulty = target_node.difficulty_level
        milestone_title = target_milestone.title

        def _emit_log(agent: str, phase: str, input_summary: str, output_summary: str):
            """Emit an agent_log debug event via progress_cb."""
            if progress_cb:
                progress_cb("agent_log", {
                    "agent": agent,
                    "phase": phase,
                    "input": input_summary[:600],
                    "output": output_summary[:1200],
                })

        # Step 1: Detailed learning plan
        logger.info(f"[v2] Step 1: CoursePlannerAgent.plan_detailed for node {knode_id}")
        _emit_log(
            "CoursePlannerAgent",
            "input",
            f"node_title={node_title!r}, difficulty={difficulty}, milestone={milestone_title!r}",
            "(pending...)",
        )
        plan_markdown = await CoursePlannerAgent(llm).plan_detailed(
            node_title=node_title,
            node_summary=node_summary,
            difficulty=difficulty,
            milestone_title=milestone_title,
        )
        if not plan_markdown:
            raise ValueError("CoursePlannerAgent.plan_detailed returned empty")

        _emit_log(
            "CoursePlannerAgent",
            "output",
            f"node_title={node_title!r}",
            plan_markdown[:1200],
        )
        if progress_cb:
            progress_cb("plan_ready", {})

        # Step 2: Identify rich-media ideas
        logger.info(f"[v2] Step 2: CourseIdeaAgent.identify for node {knode_id}")
        _emit_log(
            "CourseIdeaAgent",
            "input",
            f"node_title={node_title!r}, plan_length={len(plan_markdown)} chars",
            "(pending...)",
        )
        plan_with_placeholders, ideas = await CourseIdeaAgent(llm).identify(
            plan_markdown=plan_markdown,
            node_title=node_title,
        )
        if not ideas:
            # Fallback: use plain plan without ideas
            logger.warning(f"[v2] No ideas identified for node {knode_id}, using plain plan")
            plan_with_placeholders = plan_markdown

        _emit_log(
            "CourseIdeaAgent",
            "output",
            f"plan_length={len(plan_markdown)} chars",
            f"ideas={[{k: v for k, v in i.items() if k in ('idea_id','mode','topic')} for i in ideas]}\nplan_with_placeholders[:600]={plan_with_placeholders[:600]}",
        )
        if progress_cb:
            progress_cb("ideas_identified", {"count": len(ideas)})

        # Step 3: Elaborate each idea in parallel
        if ideas:
            logger.info(f"[v2] Step 3: CourseIdeaDetailAgent x {len(ideas)} (parallel)")
            for idea in ideas:
                _emit_log(
                    "CourseIdeaDetailAgent",
                    "input",
                    f"idea_id={idea['idea_id']!r}, mode={idea['mode']!r}, topic={idea['topic']!r}",
                    "(pending...)",
                )
            detail_agent = CourseIdeaDetailAgent(llm)
            ideas = list(await asyncio.gather(*[detail_agent.elaborate(i) for i in ideas]))
            for idea in ideas:
                dp = idea.get("detail_plan")
                _emit_log(
                    "CourseIdeaDetailAgent",
                    "output",
                    f"idea_id={idea['idea_id']!r}, mode={idea['mode']!r}",
                    json.dumps(dp, ensure_ascii=False)[:1200] if dp else "null",
                )

        # Step 4: Generate content for each idea in parallel
        async def _generate_idea(idea: dict) -> dict:
            mode = idea.get("mode", "")
            detail_plan = idea.get("detail_plan")
            result_idea = dict(idea)

            if not detail_plan:
                result_idea["result"] = None
                if progress_cb:
                    progress_cb("idea_complete", {
                        "idea_id": idea.get("idea_id", ""),
                        "mode": mode,
                        "status": "failed",
                    })
                return result_idea

            agent_name = {
                "animation": "AnimationGenAgent",
                "game": "GameGenAgent",
                "story": "StoryGenAgent",
            }.get(mode, f"{mode}Agent")

            _emit_log(
                agent_name,
                "input",
                f"mode={mode!r}, topic={idea.get('topic')!r}, node_title={node_title!r}",
                json.dumps(detail_plan, ensure_ascii=False)[:600],
            )

            try:
                if mode == "animation":
                    result = await AnimationGenAgent(llm).generate(
                        detail_plan=detail_plan,
                        node_title=node_title,
                    )
                elif mode == "game":
                    result = await GameGenAgent(llm).generate(
                        detail_plan=detail_plan,
                        node_title=node_title,
                        node_summary=node_summary,
                        difficulty=difficulty,
                    )
                elif mode == "story":
                    result = await StoryGenAgent().generate(detail_plan=detail_plan)
                else:
                    result = None

                result_idea["result"] = result
                status = "ready" if result else "failed"

                # Output summary
                if mode in ("animation", "game"):
                    output_summary = f"HTML length={len(result or '')} chars, status={status}"
                elif mode == "story":
                    output_summary = f"paragraphs={len(result or [])} items, status={status}"
                    if result:
                        output_summary += "\n" + json.dumps(result, ensure_ascii=False)[:800]
                else:
                    output_summary = f"status={status}"
                _emit_log(agent_name, "output", f"topic={idea.get('topic')!r}", output_summary)

            except Exception:
                logger.exception(
                    f"[v2] Failed to generate idea '{idea.get('idea_id')}' (mode={mode})"
                )
                result_idea["result"] = None
                status = "failed"
                _emit_log(agent_name, "output", f"topic={idea.get('topic')!r}", f"ERROR: status=failed")

            if progress_cb:
                progress_cb("idea_complete", {
                    "idea_id": idea.get("idea_id", ""),
                    "mode": mode,
                    "status": status,
                })
            return result_idea

        if ideas:
            logger.info(f"[v2] Step 4: generating content for {len(ideas)} ideas (parallel)")
            ideas = list(await asyncio.gather(*[_generate_idea(i) for i in ideas]))

        # Step 5: Integration
        logger.info(f"[v2] Step 5: IntegrationAgent.integrate for node {knode_id}")
        course_content = IntegrationAgent().integrate(
            plan_with_placeholders=plan_with_placeholders,
            ideas=ideas,
        )

        # Step 6: Save to DB
        lesson.course_content = json.dumps(course_content, ensure_ascii=False)
        lesson.status = "ready"
        lesson.generated_at = datetime.now()
        db.commit()

        if progress_cb:
            progress_cb("done", {"status": "ready"})

        logger.info(f"[v2] Course v2 generation complete for node {knode_id}")
        return {
            "project_name": project_name,
            "knode_id": knode_id,
            "status": "ready",
            "course_content": course_content,
        }

    except Exception as exc:
        try:
            if lesson:
                lesson.status = "failed"
                db.commit()
        except Exception:
            pass
        if progress_cb:
            progress_cb("error", {"message": str(exc)})
        raise
    finally:
        db.close()


def _course_content_to_dict(lesson) -> dict:
    """Convert a LessonContent ORM object to a course_content-focused dict."""
    course_content = {}
    try:
        if lesson.course_content:
            course_content = json.loads(lesson.course_content)
    except (json.JSONDecodeError, TypeError, AttributeError):
        pass
    return {
        "project_name": lesson.project_name,
        "knode_id": lesson.knode_id,
        "status": lesson.status,
        "course_content": course_content,
    }
