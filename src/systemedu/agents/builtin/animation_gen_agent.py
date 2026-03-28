"""AnimationGenAgent — generates animation HTML via AnimationSpec DSL.

Pipeline:
  1. LLM generates AnimationSpec JSON (structured scene description)
  2. AnimationCompiler converts spec to self-contained HTML
  3. AnimationRuntime (JS) renders the SVG animation in the browser

This avoids asking LLM to write raw SVG/CSS code directly.
"""

import json
import logging

from systemedu.agents.builtin.animation_backend_router_agent import (
    AnimationBackendRouterAgent,
)
from systemedu.agents.builtin.animation_spec import (
    ANIMATION_SPEC_PROMPT,
    ANIMATION_SPEC_SCHEMA,
    compile_animation_spec,
    validate_animation_spec,
)
from systemedu.agents.builtin.manim_gen_agent import ManimGenAgent
from systemedu.agents.builtin.media_art_direction import (
    inject_katex_if_needed,
)
from systemedu.agents.builtin.pattern_router_agent import PatternRouterAgent
from systemedu.agents.builtin.scientific_model_agent import ScientificModelAgent

logger = logging.getLogger(__name__)


def _strip_code_fence(text: str) -> str:
    """Strip markdown code fences."""
    if not text.startswith("```"):
        return text
    lines = text.split("\n")
    return "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:]).strip()


class AnimationGenAgent:
    """Generates animation HTML from a frame detail plan via AnimationSpec DSL."""

    def __init__(self, llm):
        self.llm = llm
        self.router = AnimationBackendRouterAgent(llm)
        self.manim = ManimGenAgent(llm)
        self.science_model = ScientificModelAgent(llm)
        self.pattern_router = PatternRouterAgent(llm)

    async def generate(
        self,
        detail_plan: dict,
        node_title: str,
        node_summary: str = "",
        project_category: str = "",
    ) -> str:
        """Generate animation HTML from detail_plan.

        Returns HTML string, or empty string on failure.

        Layer 1: Parametric template library (highest quality, physics equations)
        Layer 2: AnimationSpec DSL (current system, frame-snapshot based)
        Layer 3: Fallback HTML
        """
        frames = detail_plan.get("frames", [])
        topic = detail_plan.get("topic", node_title)
        context = detail_plan.get("context_summary", "")

        # Layer 1: Try parametric template library first
        pattern_result = await self.pattern_router.route(
            node_title=node_title,
            node_summary=node_summary,
            topic=topic,
            context=context,
        )
        if pattern_result.get("matched") and pattern_result.get("html"):
            logger.info(
                "AnimationGenAgent: Layer 1 pattern match for '%s' -> %s",
                node_title,
                pattern_result.get("pattern_id"),
            )
            detail_plan["generation_backend"] = "pattern_template"
            detail_plan["pattern_id"] = pattern_result["pattern_id"]
            return pattern_result["html"]

        if not frames:
            logger.warning("AnimationGenAgent: no frames in detail_plan for '%s'", node_title)
            return ""

        # Route: Manim vs html_svg (Manim currently disabled via _MANIM_DISABLED)
        route = await self.router.route(
            node_title=node_title,
            node_summary=node_summary,
            detail_plan=detail_plan,
            project_category=project_category,
        )
        detail_plan.setdefault("generation_backend", route["backend"])

        if route["backend"] == "manim":
            logger.info(
                "AnimationGenAgent: routing '%s' to Manim (%s)",
                node_title,
                route.get("reason", ""),
            )
            import asyncio
            manim_html = await self.manim.generate(
                detail_plan=detail_plan,
                node_title=node_title,
                node_summary=node_summary,
                subject_hint=route.get("subject_hint", "math_formula"),
            )
            if manim_html:
                return inject_katex_if_needed(manim_html)
            logger.warning(
                "AnimationGenAgent: Manim failed for '%s', falling back to AnimationSpec",
                node_title,
            )

        return await self._generate_via_spec(
            detail_plan=detail_plan,
            node_title=node_title,
            node_summary=node_summary,
            project_category=project_category,
        )

    async def _generate_via_spec(
        self,
        detail_plan: dict,
        node_title: str,
        node_summary: str,
        project_category: str,
    ) -> str:
        """Generate animation via AnimationSpec DSL pipeline."""
        import asyncio
        from langchain_core.messages import HumanMessage

        frames = detail_plan.get("frames", [])

        # Build frames description for prompt
        frames_desc_parts = []
        for f in frames:
            idx = f.get("frame_index", 0)
            desc = f.get("description", "")
            elements = ", ".join(f.get("visual_elements", []))
            narration = f.get("narration", "")
            part = f"帧 {idx + 1}: {desc}\n  视觉元素: {elements}"
            if narration:
                part += f"\n  旁白: {narration}"
            frames_desc_parts.append(part)
        frames_description = "\n".join(frames_desc_parts)

        layout = detail_plan.get("layout", {})
        beats = detail_plan.get("beats", [])
        beats_summary = " | ".join(
            f"t={b.get('t', '')}:{b.get('action', '')}/{b.get('focus', '')}"
            for b in beats[:6]
            if isinstance(b, dict)
        ) or "anticipation → main_action → settle"

        # Pre-step: extract scientific model for science-domain nodes
        scientific_model_block = ""
        if ScientificModelAgent.should_run(project_category, node_title, node_summary):
            science_model = await self.science_model.extract(
                node_title=node_title,
                node_summary=node_summary,
                mode="animation",
            )
            if science_model:
                scientific_model_block = ScientificModelAgent.build_prompt_block(science_model)
                logger.info("AnimationGenAgent: scientific model injected for '%s'", node_title)

        style_key = detail_plan.get("style_key", "edu_soft_tech")
        prompt = ANIMATION_SPEC_PROMPT.format(
            node_title=node_title,
            anim_title=detail_plan.get("title", node_title),
            animation_type=detail_plan.get("animation_type", "流程演示"),
            style_hint=detail_plan.get("style_hint", "科技感"),
            frame_count=len(frames),
            focal_object=layout.get("focal_object", "主焦点"),
            secondary_object=layout.get("secondary_object", "次焦点"),
            beats_summary=beats_summary,
            scientific_model_block=scientific_model_block,
            style_key=style_key,
            frames_description=frames_description,
            schema=ANIMATION_SPEC_SCHEMA,
        )

        try:
            response = await asyncio.to_thread(self.llm.invoke, [HumanMessage(content=prompt)])
            raw = _strip_code_fence(response.content.strip())

            # Parse JSON spec
            try:
                spec = json.loads(raw)
            except json.JSONDecodeError as exc:
                logger.warning(
                    "AnimationGenAgent: JSON parse failed for '%s': %s", node_title, exc
                )
                return _build_fallback_html(detail_plan, node_title)

            # Validate spec
            valid, issues = validate_animation_spec(spec)
            if not valid:
                logger.warning(
                    "AnimationGenAgent: spec invalid for '%s': %s", node_title, issues
                )
                # Attempt to use as-is if frames exist, otherwise fallback
                if not spec.get("frames"):
                    return _build_fallback_html(detail_plan, node_title)

            # Ensure style_key
            if not spec.get("style_key"):
                spec["style_key"] = style_key

            html = compile_animation_spec(spec, node_title=node_title)
            logger.info(
                "AnimationGenAgent: compiled spec for '%s' -> %d chars, %d frames",
                node_title,
                len(html),
                len(spec.get("frames", [])),
            )
            return html

        except Exception:
            logger.exception("AnimationGenAgent: unexpected error for '%s'", node_title)
            return _build_fallback_html(detail_plan, node_title)


def _build_fallback_html(detail_plan: dict, node_title: str) -> str:
    """Deterministic fallback: build a minimal AnimationSpec from detail_plan and compile it."""
    frames = detail_plan.get("frames") or []
    style_key = detail_plan.get("style_key", "edu_soft_tech")

    # Build a simple spec from the detail_plan frames
    spec_frames = []
    for i, frame in enumerate(frames[:6]):
        if not isinstance(frame, dict):
            continue
        desc = str(frame.get("description") or f"步骤 {i + 1}")
        elements_text = frame.get("visual_elements", [])
        narration = str(frame.get("narration") or "")

        frame_elements: list[dict] = [
            # 背景卡片
            {
                "type": "rect",
                "x": 32, "y": 20, "w": 536, "h": 300,
                "fill": {"type": "linear", "stops": [
                    {"offset": "0%", "color": "#eff6ff"},
                    {"offset": "100%", "color": "#dbeafe"},
                ]},
                "rx": 18,
                "enter": {"duration": 0.3, "easing": "easeOut", "from_scale": 0.95},
            },
            # 帧序号标识
            {
                "type": "circle",
                "cx": 76, "cy": 58, "r": 22,
                "fill": {"type": "linear", "stops": [
                    {"offset": "0%", "color": "#1d4ed8"},
                    {"offset": "100%", "color": "#0ea5e9"},
                ]},
                "enter": {"duration": 0.4, "delay": 0.1, "easing": "spring", "from_scale": 0.2},
            },
            {
                "type": "text",
                "x": 76, "y": 64, "text": str(i + 1),
                "font_size": 18, "bold": True, "color": "#ffffff",
                "enter": {"duration": 0.3, "delay": 0.2, "easing": "easeOut", "from_y": 8},
            },
            # 主描述文字
            {
                "type": "text",
                "x": 300, "y": 180, "text": desc[:20],
                "font_size": 18, "bold": True, "color": "#1e3a8a",
                "enter": {"duration": 0.5, "delay": 0.15, "easing": "easeInOut", "from_y": 20},
            },
        ]

        # 添加视觉元素标签
        for j, elem_text in enumerate(elements_text[:3]):
            x_pos = 120 + j * 140
            frame_elements.append({
                "type": "label_bubble",
                "x": x_pos, "y": 260,
                "text": str(elem_text)[:8],
                "font_size": 12,
                "bg": "#1d4ed8",
                "enter": {"duration": 0.35, "delay": 0.2 + j * 0.08, "easing": "spring", "from_scale": 0.3},
            })

        if narration:
            frame_elements.append({
                "type": "text",
                "x": 300, "y": 215, "text": narration[:16],
                "font_size": 13, "color": "#475569",
                "enter": {"duration": 0.4, "delay": 0.3, "easing": "easeOut", "from_y": 10},
            })

        spec_frames.append({
            "caption": desc[:12],
            "narration": narration[:10],
            "elements": frame_elements,
        })

    if not spec_frames:
        # 最小化 fallback
        title = detail_plan.get("title") or node_title
        spec_frames = [{
            "caption": title[:12],
            "narration": "",
            "elements": [
                {"type": "rect", "x": 32, "y": 20, "w": 536, "h": 300, "fill": "#eff6ff", "rx": 18},
                {"type": "text", "x": 300, "y": 175, "text": title[:20], "font_size": 20, "bold": True, "color": "#1d4ed8",
                 "enter": {"duration": 0.6, "easing": "spring", "from_scale": 0.6}},
            ],
        }]

    spec = {"style_key": style_key, "frame_duration": 3.0, "frames": spec_frames}
    logger.info("AnimationGenAgent: using deterministic fallback spec for '%s'", node_title)
    return compile_animation_spec(spec, node_title=node_title)
