"""端到端测试：弹簧物理项目创建 + 课程节点生成。

此测试真实调用 LLM，验证参数化动画模板是否在合适节点触发。
运行前需确保后端服务运行（port 18820）或直接调用内部服务层。

运行方式：
  # 直接内部调用（推荐，不依赖运行中的服务器）
  source .venv/bin/activate
  python -m pytest tests/test_e2e_spring_physics.py -v -s

  # 或单独运行某个测试
  python -m pytest tests/test_e2e_spring_physics.py::TestSpringPhysicsE2E::test_generate_spring_oscillation_course -v -s
"""

import asyncio
import json
import os
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).parent.parent
PROJECT_DIR = PROJECT_ROOT / "projects" / "spring-physics"


def _get_llm():
    """获取真实 LLM 实例（用于 E2E 测试）。"""
    import sys
    sys.path.insert(0, str(PROJECT_ROOT / "src"))
    from systemedu.core.config import load_config
    from systemedu.core.llm_client import create_llm

    cfg = load_config()
    return create_llm(cfg)


def _load_knowledge_tree():
    tree_path = PROJECT_DIR / "knowledge_tree.json"
    with open(tree_path, encoding="utf-8") as f:
        return json.load(f)


def _get_node_by_index(tree: dict, global_idx: int) -> dict | None:
    """根据全局索引获取知识节点。"""
    idx = 0
    for milestone in tree.get("milestones", []):
        for knode in milestone.get("knodes", []):
            if idx == global_idx:
                return knode, milestone["title"]
            idx += 1
    return None, None


class TestSpringPhysicsE2E:
    """弹簧物理项目端到端测试。"""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.tree = _load_knowledge_tree()

    def test_knowledge_tree_structure(self):
        """验证知识树结构正确。"""
        assert "milestones" in self.tree
        assert len(self.tree["milestones"]) == 3

        total_nodes = sum(len(m["knodes"]) for m in self.tree["milestones"])
        assert total_nodes == 8

        # 验证 node 0: 弹簧为什么会弹回来
        node, milestone = _get_node_by_index(self.tree, 0)
        assert node is not None
        assert "弹簧" in node["title"]

        # 验证 node 3: 弹簧振动是什么样的（目标测试节点）
        node, milestone = _get_node_by_index(self.tree, 3)
        assert node is not None
        assert "振动" in node["title"]

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_pattern_router_spring_oscillation(self):
        """PatternRouterAgent 对弹簧振动节点应匹配 wave_oscillation 模板。"""
        import sys
        sys.path.insert(0, str(PROJECT_ROOT / "src"))
        from systemedu.agents.builtin.pattern_router_agent import PatternRouterAgent

        llm = _get_llm()
        agent = PatternRouterAgent(llm)

        node, milestone = _get_node_by_index(self.tree, 3)
        result = await agent.route(
            node_title=node["title"],
            node_summary=node["summary"],
            topic="弹簧简谐运动动画演示",
        )

        print(f"\n=== PatternRouter 结果 ===")
        print(f"matched: {result['matched']}")
        print(f"pattern_id: {result['pattern_id']}")
        print(f"reason: {result['reason']}")
        print(f"params: {json.dumps(result['params'], ensure_ascii=False, indent=2)}")
        print(f"html length: {len(result['html'])}")

        # 对弹簧振动，应该匹配 wave_oscillation
        assert result["matched"] is True, f"Expected match but got: {result['reason']}"
        assert result["pattern_id"] == "wave_oscillation", \
            f"Expected wave_oscillation, got {result['pattern_id']}"
        assert len(result["html"]) > 500

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_generate_spring_oscillation_course(self):
        """完整课程生成：节点3（弹簧振动是什么样的）。

        验证：
        1. plan_markdown 生成
        2. ideas 中含 animation 类型
        3. animation 触发 wave_oscillation 参数化模板
        4. rendered_sections 包含渲染后的 HTML
        """
        import sys
        sys.path.insert(0, str(PROJECT_ROOT / "src"))
        from systemedu.education.lesson_generator import generate_course_v2

        node, milestone = _get_node_by_index(self.tree, 3)
        assert node is not None

        print(f"\n=== 开始生成课程 ===")
        print(f"节点: {node['title']}")
        print(f"里程碑: {milestone}")
        print(f"摘要: {node['summary'][:80]}...")

        llm = _get_llm()
        events = []

        async for event in generate_course_v2(
            llm=llm,
            node_title=node["title"],
            node_summary=node["summary"],
            difficulty=node.get("difficulty_level", 2),
            milestone_title=milestone,
            project_category="science",
        ):
            events.append(event)
            event_type = event.get("type", "unknown")
            print(f"  [event] {event_type}", end="")
            if event_type == "idea_complete":
                idea_id = event.get("idea_id", "")
                mode = event.get("mode", "")
                print(f" | idea={idea_id} mode={mode}", end="")
            print()

        # 找 done 事件
        done_events = [e for e in events if e.get("type") == "done"]
        assert len(done_events) > 0, "No 'done' event received"

        course_content = done_events[-1].get("course_content", {})
        assert course_content, "course_content is empty"

        plan_markdown = course_content.get("plan_markdown", "")
        ideas = course_content.get("ideas", [])
        rendered_sections = course_content.get("rendered_sections", {})

        print(f"\n=== 结果摘要 ===")
        print(f"plan_markdown 长度: {len(plan_markdown)}")
        print(f"ideas 数量: {len(ideas)}")
        for idea in ideas:
            print(f"  - {idea.get('idea_id')} mode={idea.get('mode')} topic={idea.get('topic', '')[:40]}")
        print(f"rendered_sections 数量: {len(rendered_sections)}")

        assert len(plan_markdown) > 100, "plan_markdown too short"
        assert len(ideas) > 0, "No ideas generated"
        assert len(rendered_sections) > 0, "No rendered sections"

        # 检查是否有 animation 类型的 idea
        anim_ideas = [i for i in ideas if i.get("mode") == "animation"]
        print(f"\n动画 ideas: {len(anim_ideas)}")

        # 检查 animation 是否用了参数化模板
        for idea in anim_ideas:
            idea_id = idea.get("idea_id")
            section = rendered_sections.get(idea_id, {})
            backend = idea.get("detail_plan", {}).get("generation_backend", "unknown")
            pattern_id = idea.get("detail_plan", {}).get("pattern_id", "")
            html = section.get("html", "")
            print(f"  animation [{idea_id}]: backend={backend} pattern={pattern_id} html_len={len(html)}")

            if backend == "pattern_template":
                print(f"  >>> 成功触发参数化模板: {pattern_id}")
                assert len(html) > 500, "Pattern template HTML too short"

        # 保存结果到文件以便查看
        output_path = PROJECT_DIR / "generated_course_node3.json"
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(course_content, f, ensure_ascii=False, indent=2)
        print(f"\n课程内容已保存到: {output_path}")

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_generate_hookes_law_course(self):
        """生成节点1（胡克定律 F=kx）的课程内容。"""
        import sys
        sys.path.insert(0, str(PROJECT_ROOT / "src"))
        from systemedu.education.lesson_generator import generate_course_v2

        node, milestone = _get_node_by_index(self.tree, 1)
        llm = _get_llm()

        print(f"\n=== 生成胡克定律课程 ===")

        events = []
        async for event in generate_course_v2(
            llm=llm,
            node_title=node["title"],
            node_summary=node["summary"],
            difficulty=node.get("difficulty_level", 2),
            milestone_title=milestone,
            project_category="science",
        ):
            events.append(event)

        done_events = [e for e in events if e.get("type") == "done"]
        assert len(done_events) > 0

        course_content = done_events[-1].get("course_content", {})
        ideas = course_content.get("ideas", [])
        rendered_sections = course_content.get("rendered_sections", {})

        print(f"ideas: {len(ideas)}, sections: {len(rendered_sections)}")
        for idea in ideas:
            sid = idea.get("idea_id")
            mode = idea.get("mode")
            section = rendered_sections.get(sid, {})
            html_len = len(section.get("html") or "")
            print(f"  {sid} mode={mode} html={html_len}")

        assert len(ideas) > 0
        assert len(rendered_sections) > 0

        # 保存
        output_path = PROJECT_DIR / "generated_course_node1.json"
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(course_content, f, ensure_ascii=False, indent=2)
        print(f"保存到: {output_path}")
