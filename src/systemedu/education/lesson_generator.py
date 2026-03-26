"""AI-powered course content generation via 6-agent pipeline (v2)."""

import json
import logging
from datetime import datetime

from systemedu.education.project_loader import load_project_context

logger = logging.getLogger(__name__)


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
            f"node_title={node_title!r}, plan_length={len(plan_markdown)} chars\n\n{plan_markdown[:800]}",
            "(pending...)",
        )
        plan_with_placeholders, ideas = await CourseIdeaAgent(llm).identify(
            plan_markdown=plan_markdown,
            node_title=node_title,
        )
        if not ideas:
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
                    f"idea_id={idea['idea_id']!r}, mode={idea['mode']!r}, topic={idea['topic']!r}\ncontext_summary={idea.get('context_summary', '')!r}",
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
            if progress_cb:
                progress_cb("details_ready", {"count": len(ideas)})

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
                _emit_log(agent_name, "output", f"topic={idea.get('topic')!r}", "ERROR: status=failed")

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

        # Step 6: Generate assignment (parallel-friendly, non-blocking)
        logger.info(f"[v2] Step 6: generate assignment for node {knode_id}")
        assignment_text = await _generate_assignment(
            llm=llm,
            node_title=node_title,
            node_summary=node_summary,
            difficulty=difficulty,
            milestone_title=milestone_title,
        )
        _emit_log(
            "AssignmentAgent",
            "output",
            f"node_title={node_title!r}",
            assignment_text[:400] if assignment_text else "(empty)",
        )

        # Step 6a: Segment plan + generate audio scripts
        logger.info(f"[v2] Step 6a: CourseSegmentAgent for node {knode_id}")
        from systemedu.agents.builtin.course_segment_agent import CourseSegmentAgent
        segments = await CourseSegmentAgent(llm).segment(
            plan_markdown=plan_with_placeholders,
            node_title=node_title,
        )
        logger.info(f"[v2] Step 6a: {len(segments)} sections generated")

        # Step 6b: Parallel TTS for each section
        logger.info(f"[v2] Step 6b: TTS x {len(segments)} sections (parallel)")
        from systemedu.education.tts import synthesize_speech

        async def _tts_one(seg: dict) -> dict:
            script = seg.get("audio_script", "")
            if not script:
                seg["audio_url"] = ""
                return seg
            try:
                path, _ = await asyncio.to_thread(
                    synthesize_speech,
                    script,
                    project_name,
                    knode_id,
                    f"section_{seg['section_id'][:8]}.wav",
                )
                seg["audio_url"] = path
            except Exception:
                logger.exception(
                    f"[v2] TTS failed for section {seg.get('section_id', '')[:8]}"
                )
                seg["audio_url"] = ""
            return seg

        segments = list(await asyncio.gather(*[_tts_one(s) for s in segments]))
        course_content["sections"] = segments
        logger.info(
            f"[v2] Step 6b: TTS complete, "
            f"{sum(1 for s in segments if s.get('audio_url'))} / {len(segments)} succeeded"
        )
        if progress_cb:
            progress_cb("audio_ready", {"count": len(segments)})

        # Step 7: Save to DB
        lesson.course_content = json.dumps(course_content, ensure_ascii=False)
        lesson.project_assignment = assignment_text
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


_ASSIGNMENT_PROMPT = """你是一位经验丰富的教育内容设计师。请根据以下知识节点信息，生成一份循序渐进的作业练习。

知识节点：{node_title}
内容摘要：{node_summary}
难度等级：{difficulty}/5
所属模块：{milestone_title}

请按照以下结构生成作业（全部用中文）：

## 一、选择题（3题）

每题给出4个选项，标注正确答案。格式：
**1. 题目内容**
A. 选项A
B. 选项B
C. 选项C
D. 选项D
**答案：X**

## 二、问答题（2题）

开放性问题，引导学生深入思考。每题后附参考答案要点。

## 三、动手项目

设计一个可以在家完成的动手操作项目（实验/制作/观察均可），要求：
- 使用身边容易获得的材料
- 步骤清晰，适合独立完成
- 与本节知识点紧密相关

在动手项目标题前加上 [HANDS_ON] 标记。

请直接输出作业内容，不要有额外的前言说明。"""


async def _generate_assignment(
    llm,
    node_title: str,
    node_summary: str,
    difficulty: int,
    milestone_title: str,
) -> str:
    """Generate assignment content for a knowledge node using LLM."""
    import asyncio

    prompt = _ASSIGNMENT_PROMPT.format(
        node_title=node_title,
        node_summary=node_summary[:300] if node_summary else "",
        difficulty=difficulty,
        milestone_title=milestone_title,
    )

    try:
        messages = [
            {"role": "system", "content": "你是专业的教育内容设计师，擅长为中小学生设计循序渐进的练习题。"},
            {"role": "user", "content": prompt},
        ]
        response = await asyncio.to_thread(
            llm.invoke,
            messages,
        )
        text = response.content if hasattr(response, "content") else str(response)
        return text.strip()
    except Exception:
        logger.exception(f"[v2] Assignment generation failed for node {node_title!r}")
        return ""


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
