"""AI-powered knowledge tree generation."""

from systemedu.agents.builtin.planner import PlannerAgent

from .models import KnowledgeTree
from .services import parse_knowledge_tree


async def generate_knowledge_tree(
    project_title: str,
    project_description: str,
    user_age: int = 12,
    llm_provider: str | None = None,
) -> KnowledgeTree:
    """Generate a knowledge tree for a project using the Planner agent.

    Returns a validated KnowledgeTree model.
    """
    from systemedu.agents.base import AgentConfig

    config = AgentConfig(name="planner", type="builtin:planner", llm_provider=llm_provider)
    planner = PlannerAgent(config)

    content = await planner.process(
        f"项目标题：{project_title}\n项目描述：{project_description}",
        context={"user_age": user_age},
    )

    # Extract JSON from response
    if "```json" in content:
        content = content.split("```json")[1].split("```")[0]
    elif "```" in content:
        content = content.split("```")[1].split("```")[0]

    import json

    tree_data = json.loads(content.strip())
    return parse_knowledge_tree(tree_data)
