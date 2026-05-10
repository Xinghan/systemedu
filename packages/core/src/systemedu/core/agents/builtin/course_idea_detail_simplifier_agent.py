"""CourseIdeaDetailSimplifierAgent - deterministic simplification for robust generation."""

from __future__ import annotations

from systemedu.core.agents.builtin.media_art_direction import simplify_detail_plan


class CourseIdeaDetailSimplifierAgent:
    """Simplifier node: reduce complexity while preserving teaching intent."""

    def simplify(self, mode: str, detail_plan: dict) -> dict:
        """Return simplified detail plan."""
        return simplify_detail_plan(mode, detail_plan)

    def fallback(self, mode: str, idea: dict) -> dict:
        """Return deterministic fallback detail_plan when generation fails."""
        topic = idea.get("topic", "核心知识点")
        style_key = idea.get("style_key", "")
        if mode == "animation":
            return {
                "style_key": style_key or "neural_circuit",
                "title": topic[:10],
                "frame_count": 4,
                "layout": {
                    "focal_object": "核心对象",
                    "secondary_object": "辅助对象",
                    "safe_area_fill": 0.62,
                },
                "asset_plan": ["focus_highlight", "caption_plate", "progress_dots"],
                "persuasion": {
                    "learning_claim": "通过一个场景解释核心概念。",
                    "evidence": "展示前后状态变化作为证据。",
                    "takeaway": "学生能复述关键规律。",
                },
                "beats": [
                    {"t": 0.0, "action": "enter", "focus": "核心对象"},
                    {"t": 0.2, "action": "anticipation", "focus": "触发点"},
                    {"t": 0.55, "action": "main_action", "focus": "关键变化"},
                    {"t": 0.8, "action": "secondary_overlap", "focus": "辅助反馈"},
                    {"t": 1.0, "action": "settle", "focus": "结论"},
                ],
                "frames": [
                    {"frame_index": 0, "description": "呈现初始状态", "visual_elements": ["核心对象", "背景"], "narration": ""},
                    {"frame_index": 1, "description": "触发关键变化", "visual_elements": ["核心对象", "信号"], "narration": ""},
                    {"frame_index": 2, "description": "展示变化结果", "visual_elements": ["结果状态", "标注"], "narration": ""},
                    {"frame_index": 3, "description": "总结规律", "visual_elements": ["结论卡片", "对比元素"], "narration": ""},
                ],
                "style_hint": "科技感",
                "animation_type": "流程演示",
            }

        if mode == "game":
            return {
                "style_key": style_key or "neural_circuit",
                "game_mechanic": "simulation",
                "game_concept": f"通过调参理解{topic}中的因果关系",
                "game_title": topic[:10],
                "visual_focus": "核心实验对象",
                "visual_storyboard": ["初始状态", "参数变化反馈", "结果总结"],
                "persuasion": {
                    "learning_claim": "参数变化会导致可观测结果变化。",
                    "evidence": "通过实时反馈看到趋势变化。",
                    "takeaway": "学生能说出参数与结果关系。",
                },
                "interaction_flow": ["步骤1：调节参数A", "步骤2：观察现象", "步骤3：给出结论"],
                "win_condition": "正确解释参数影响",
                "difficulty_hint": "easy",
                "simulation_params": [
                    {"param_name": "param_a", "label": "参数A", "min": 0, "max": 100, "default": 50, "unit": ""},
                    {"param_name": "param_b", "label": "参数B", "min": 0, "max": 100, "default": 50, "unit": ""},
                ],
                "scene_description": "单一实验场景，学生调节两个参数并观察核心对象反馈。",
            }

        return {
            "style_key": style_key or "celestial_observatory",
            "title": topic[:10],
            "character_bible": [{"name": "小探险家", "appearance": "短发背包", "personality": "好奇勇敢"}],
            "persuasion": {
                "learning_claim": "故事中的现象可以解释该知识点。",
                "evidence": "关键转折段落给出直观证据。",
                "takeaway": "学生能把故事现象对应到知识规律。",
            },
            "paragraphs": [
                {
                    "text": f"小探险家在校园里遇到一个与{topic}有关的现象，他决定亲自验证。",
                    "image_prompt": "children's book illustration, kid explorer in school, warm color, clear focal subject, no text",
                },
                {
                    "text": "他通过观察和尝试发现变化并非偶然，而是有规律可循。",
                    "image_prompt": "children doing simple experiment, expressive faces, educational illustration, no text",
                },
                {
                    "text": "最后他把发现告诉同学，大家都能用自己的话解释这个规律。",
                    "image_prompt": "classroom sharing moment, joyful educational scene, storybook style, no text",
                },
            ],
        }
