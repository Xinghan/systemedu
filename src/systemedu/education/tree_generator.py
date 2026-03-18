"""AI-powered knowledge tree generation."""

import json
import logging
import re

from .models import KnowledgeTree
from .services import parse_knowledge_tree

logger = logging.getLogger(__name__)


def _extract_json(content: str) -> dict:
    """Extract JSON from LLM response using multiple strategies.

    Tries in order:
    1. ```json ... ``` fenced block
    2. ``` ... ``` generic fenced block
    3. First { ... } block (greedy)

    Raises ValueError if no valid JSON found.
    """
    # Strategy 1: ```json block
    match = re.search(r"```json\s*\n?(.*?)```", content, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1).strip())
        except json.JSONDecodeError:
            pass

    # Strategy 2: ``` block
    match = re.search(r"```\s*\n?(.*?)```", content, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1).strip())
        except json.JSONDecodeError:
            pass

    # Strategy 3: First { ... } block (find matching braces)
    brace_start = content.find("{")
    if brace_start >= 0:
        # Find the matching closing brace
        depth = 0
        for i in range(brace_start, len(content)):
            if content[i] == "{":
                depth += 1
            elif content[i] == "}":
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(content[brace_start : i + 1])
                    except json.JSONDecodeError:
                        break

    raise ValueError("No valid JSON found in content")


async def generate_knowledge_tree(
    project_title: str,
    project_description: str,
    user_age: int = 12,
    target_nodes: int = 20,
    llm_provider: str | None = None,
    max_retries: int = 3,
) -> KnowledgeTree:
    """Generate a knowledge tree for a project using the Planner agent.

    Retries up to max_retries times on failure.
    Returns a validated KnowledgeTree model.
    """
    from systemedu.agents.base import AgentConfig
    from systemedu.agents.builtin.planner import PlannerAgent

    config = AgentConfig(name="planner", type="builtin:planner", llm_provider=llm_provider)
    planner = PlannerAgent(config)

    last_error = None
    for attempt in range(1, max_retries + 1):
        try:
            content = await planner.process(
                f"项目标题：{project_title}\n项目描述：{project_description}",
                context={"user_age": user_age, "target_nodes": target_nodes},
            )

            tree_data = _extract_json(content)
            return parse_knowledge_tree(tree_data)

        except Exception as e:
            last_error = e
            logger.warning(
                f"Knowledge tree generation attempt {attempt}/{max_retries} failed: {e}"
            )

    raise RuntimeError(
        f"Failed to generate knowledge tree after {max_retries} attempts: {last_error}"
    )
