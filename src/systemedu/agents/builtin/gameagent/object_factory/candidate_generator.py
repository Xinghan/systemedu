"""CandidateGenerator: two-step LLM pipeline for generating new object candidates.

Two modes:
- Parametric (base_family exists in Registry): LLM outputs diff shapes only
- Pure generation (no base_family or not in Registry): LLM outputs full shapes

Step 1: Semantic layer - LLM outputs ObjectSpecTemplate (parts, must_have, labelable)
Step 2: Geometry layer - LLM outputs shapes (strongly typed, no complex paths)
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field

from deepagents import create_deep_agent
from langchain_core.messages import AIMessage, HumanMessage

logger = logging.getLogger(__name__)

_STEP1_SYSTEM_PROMPT = """你是一位教育游戏物体语义设计师。
你的任务是：给定一个教育场景中的物体名称和描述，输出该物体的结构化语义定义（ObjectSpecTemplate）。

规则：
- must_have：物体必须有的核心部件（3-6 个）
- optional：可选装饰部件（0-4 个）
- labelable：学生可以标注的部件（= must_have 中最有教育意义的 3-8 个）
- parts：每个部件的中英文标签和简介

part_id 格式：snake_case，全小写英文，如 nose_cone、cell_membrane
不允许使用 background、decoration、misc、other、filler 作为 part_id

输出严格 JSON（无其他文字）：
{
  "must_have": ["part_id1", "part_id2", ...],
  "optional": ["part_id3", ...],
  "labelable": ["part_id1", "part_id2", ...],
  "parts": {
    "part_id1": {
      "label_zh": "中文名",
      "label_en": "English Name",
      "desc_brief": "简短描述（15字以内）",
      "hint": "学习提示"
    }
  }
}"""

_STEP2_SYSTEM_PROMPT = """你是一位 SVG 图形设计师，专门为教育游戏绘制简洁清晰的 2D 物体图形。

给你一个物体的语义定义和 viewbox 大小，输出该物体的图形形状列表（shapes）。

形状类型只允许：rect、ellipse、polygon、line（优先使用这四种）
path 仅在其他形状无法表达时使用，且 d 字符串长度不超过 200 字符

每个 shape 字段：
- type: "rect" | "ellipse" | "polygon" | "line" | "path"
- id: 唯一字符串（如 "body_rect", "wing_left"）
- part_id: 对应语义部件 id（装饰性形状填 null）
- 坐标字段：根据类型填写（见示例）

额外规则：
- 总形状数不超过 50
- 每个 must_have 部件至少有 1 个 shape
- 所有坐标在 viewbox 范围内（允许 5% 溢出）
- path shapes 数量不超过形状总数的 50%

输出严格 JSON（无其他文字），格式：
{
  "shapes": [...],
  "anchors": [
    {"part_id": "...", "x": 50.0, "y": 20.0}
  ]
}

anchors 是标注锚点，x/y 是相对 viewbox 的百分比（0-100）。
每个 labelable 部件必须有一个 anchor。

rect 示例：{"type": "rect", "id": "body_rect", "part_id": "body", "x": 230, "y": 90, "w": 60, "h": 200, "rx": 4, "fill": "#B0BEC5", "stroke": "#78909C", "stroke_width": 1.5, "opacity": 1.0}
ellipse 示例：{"type": "ellipse", "id": "window", "part_id": "window", "cx": 260, "cy": 136, "rx": 12, "ry": 12, "fill": "#80DEEA", "stroke": "#4DD0E1", "stroke_width": 2.0, "opacity": 1.0}
polygon 示例：{"type": "polygon", "id": "fin_left", "part_id": "left_fin", "points": [[250, 234], [250, 290], [212, 290]], "fill": "#546E7A", "stroke": "#37474F", "stroke_width": 1.5, "opacity": 1.0}
line 示例：{"type": "line", "id": "grid_v1", "part_id": null, "x1": 100, "y1": 180, "x2": 100, "y2": 200, "stroke": "#78909C", "stroke_width": 0.8, "opacity": 1.0}"""


@dataclass
class CandidateResult:
    object_key: str
    base_family: str
    spec_template: dict          # ObjectSpecTemplate (meta)
    render_candidate: dict       # {shapes: [...], anchors: [...]}
    raw_llm_output: str = ""     # for debugging

    def to_staging_dict(self) -> dict:
        """Build the staging JSON dict."""
        import datetime
        shapes = self.render_candidate.get("shapes", [])
        anchors = self.render_candidate.get("anchors", [])
        rendered_parts = list({s.get("part_id") for s in shapes if s.get("part_id")})
        return {
            "object_key": self.object_key,
            "base_family": self.base_family,
            "view": "side",
            "status": "candidate",
            "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "validation_score": 0.0,
            "validation_errors": [],
            "meta": self.spec_template,
            "render_spec": {
                "viewbox": "0 0 560 420",
                "shapes": shapes,
                "anchors": anchors,
                "rendered_parts": rendered_parts,
            },
        }


class CandidateGenerator:
    """Two-step LLM pipeline for generating object candidates."""

    def __init__(self, llm=None):
        self._llm = llm

    async def generate(
        self,
        object_key: str,
        description: str,
        base_family: str = "",
    ) -> CandidateResult | None:
        """Generate a new object candidate via two-step LLM.

        Args:
            object_key: target key, e.g. "submarine.basic"
            description: natural language description of the object
            base_family: optional family to base on (e.g. "rocket")

        Returns CandidateResult or None on failure.
        """
        try:
            # Step 1: Semantic layer
            spec_template = await self._generate_semantic(object_key, description, base_family)
            if spec_template is None:
                logger.warning(f"CandidateGenerator step1 failed for {object_key!r}")
                return None

            # Step 2: Geometry layer
            render_candidate, raw = await self._generate_geometry(
                object_key, description, spec_template
            )
            if render_candidate is None:
                logger.warning(f"CandidateGenerator step2 failed for {object_key!r}")
                return None

            return CandidateResult(
                object_key=object_key,
                base_family=base_family,
                spec_template=spec_template,
                render_candidate=render_candidate,
                raw_llm_output=raw,
            )

        except Exception:
            logger.exception(f"CandidateGenerator failed for {object_key!r}")
            return None

    async def _generate_semantic(
        self,
        object_key: str,
        description: str,
        base_family: str,
    ) -> dict | None:
        """Step 1: LLM generates ObjectSpecTemplate."""
        user_prompt = (
            f"物体标识：{object_key}\n"
            f"描述：{description}\n"
        )
        if base_family:
            user_prompt += f"参考家族：{base_family}（请参考该家族的结构风格）\n"
        user_prompt += "\n请输出该物体的语义定义 JSON。"

        raw = await self._call_llm(_STEP1_SYSTEM_PROMPT, user_prompt)
        if not raw:
            return None
        try:
            data = _parse_json_from_llm(raw)
            if not isinstance(data, dict):
                return None
            return data
        except Exception:
            logger.warning(f"Step1 JSON parse failed: {raw[:200]}")
            return None

    async def _generate_geometry(
        self,
        object_key: str,
        description: str,
        spec_template: dict,
    ) -> tuple[dict | None, str]:
        """Step 2: LLM generates shapes + anchors from semantic constraints."""
        must_have = spec_template.get("must_have", [])
        labelable = spec_template.get("labelable", [])

        user_prompt = (
            f"物体：{object_key}\n"
            f"描述：{description}\n"
            f"Viewbox：0 0 560 420\n"
            f"必须包含的部件：{', '.join(must_have)}\n"
            f"需要锚点标注的部件：{', '.join(labelable)}\n"
            f"\n部件语义定义：\n{json.dumps(spec_template.get('parts', {}), ensure_ascii=False, indent=2)}\n"
            f"\n请输出 shapes 和 anchors JSON。"
        )

        raw = await self._call_llm(_STEP2_SYSTEM_PROMPT, user_prompt)
        if not raw:
            return None, ""
        try:
            data = _parse_json_from_llm(raw)
            if not isinstance(data, dict):
                return None, raw
            return data, raw
        except Exception:
            logger.warning(f"Step2 JSON parse failed: {raw[:200]}")
            return None, raw

    async def _call_llm(self, system_prompt: str, user_prompt: str) -> str:
        """Call the LLM and return the raw text response."""
        try:
            agent = create_deep_agent(
                model=self._llm,
                tools=[],
                system_prompt=system_prompt,
            )
            result = await agent.ainvoke({"messages": [HumanMessage(content=user_prompt)]})

            for msg in reversed(result["messages"]):
                if isinstance(msg, AIMessage) and msg.content:
                    return msg.content.strip()
            return ""
        except Exception:
            logger.exception("LLM call failed")
            return ""


def _parse_json_from_llm(raw: str) -> dict:
    """Strip markdown fences and parse JSON."""
    text = raw.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        # Remove first line (```json or ```) and last line (```)
        end = -1 if lines[-1].strip() == "```" else len(lines)
        text = "\n".join(lines[1:end]).strip()
    return json.loads(text)
