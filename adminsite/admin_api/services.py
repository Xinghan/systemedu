"""
AI-powered knowledge tree generation using Qwen (DashScope).
"""

import json
import os

from openai import OpenAI

from apps.projects.models import Project

SYSTEM_PROMPT = """You are an expert curriculum designer for SystemEdu, an AI-powered project-based learning platform for ages 6-18. Your task is to generate a knowledge tree JSON for a learning project.

## Output Format (STRICT JSON — no markdown, no code fences)

Return a single JSON object with this exact structure:

{
  "milestones": [
    {
      "title": "string (required)",
      "description": "string (optional, default empty)",
      "order": 0,
      "knodes": [
        {
          "title": "string (required)",
          "summary": "string (optional)",
          "difficulty_level": 3,
          "content_type": "text",
          "acceptance_type": "quiz",
          "estimated_minutes": 15,
          "xp_reward": 20,
          "order": 0,
          "prerequisite_indices": []
        }
      ]
    }
  ]
}

## Field Rules

- **order**: milestones from 0 ascending; knodes from 0 ascending within each milestone
- **difficulty_level**: integer 1-10
- **content_type**: one of "text", "interactive", "code", "experiment", "quiz", "video"
- **acceptance_type**: one of "quiz", "code_submit", "essay", "demo", "peer_review", "auto"
- **estimated_minutes**: positive integer, typically 10-60
- **xp_reward**: positive integer, typically 10-100
- **prerequisite_indices**: global indices across ALL milestones' knodes flattened sequentially
  - milestones[0].knodes[0] = index 0
  - milestones[0].knodes[1] = index 1
  - milestones[1].knodes[0] = N (where N = len(milestones[0].knodes))
  - Must form a DAG (no cycles, no self-references)
  - Earlier milestone knodes should generally be prerequisites for later ones

## Curriculum Design Guidelines

1. **Progressive difficulty**: Start with foundational concepts, build to advanced topics
2. **Age-appropriate**: Adjust language complexity, content depth, and estimated_minutes for the target age range
3. **Balanced content types**: Mix text, interactive, code, quiz, and experiment nodes
4. **Meaningful prerequisites**: Create logical learning paths (a concept should depend on its foundations)
5. **Milestone grouping**: Group related knowledge into coherent milestones (3-15 nodes per milestone is ideal)
6. **Real-world application**: Include practical, hands-on nodes alongside theoretical ones
"""


GRANULARITY_PROMPT = {
    "coarse": (
        "Generate a **coarse-grained** knowledge tree with approximately 20-50 knowledge nodes. "
        "Focus on major topics and high-level concepts only. Each node covers a broad area. "
        "This tree serves as an initial outline that can be expanded later."
    ),
    "medium": (
        "Generate a **medium-grained** knowledge tree with approximately 100-300 knowledge nodes. "
        "Break topics into clear sub-concepts with moderate detail. "
        "Balance breadth and depth — enough granularity for guided learning."
    ),
    "fine": (
        "Generate a **fine-grained** knowledge tree with approximately 500-1500 knowledge nodes. "
        "Break every concept into small, atomic learning units. "
        "Each node should cover one specific skill or piece of knowledge. "
        "Include all foundational prerequisites in detail."
    ),
}


def build_user_prompt(
    project: Project,
    granularity: str = "medium",
    instructions: str = "",
) -> str:
    """Build the user prompt from project info and granularity level."""
    granularity_desc = GRANULARITY_PROMPT.get(granularity, GRANULARITY_PROMPT["medium"])

    parts = [
        granularity_desc,
        "",
        f"**Project Title**: {project.title}",
    ]

    if project.subtitle:
        parts.append(f"**Subtitle**: {project.subtitle}")

    if project.description:
        parts.append(f"**Description**: {project.description}")

    category_display = dict(Project.CATEGORY_CHOICES).get(project.category, project.category)
    parts.append(f"**Category**: {category_display}")
    parts.append(f"**Target Age Range**: {project.min_age}-{project.max_age} years old")

    if instructions:
        parts.append("")
        parts.append(f"**Additional Instructions**: {instructions}")

    parts.append("")
    parts.append(
        f"Consider that the learners are ages {project.min_age}-{project.max_age}. "
        f"If they are beginners, include all necessary foundational knowledge nodes "
        f"(e.g., for an image recognition project with zero CS background, include "
        f"basic programming, data types, math foundations, etc.). "
        f"Ensure difficulty levels are appropriate for the target age range."
    )

    return "\n".join(parts)


def generate_knowledge_tree(
    project: Project,
    granularity: str = "medium",
    instructions: str = "",
) -> dict:
    """
    Call Qwen via DashScope to generate a knowledge tree JSON.

    granularity: "coarse" (~20-50 nodes), "medium" (~100-300), "fine" (~500-1500)
    Returns the parsed JSON dict (milestones + knodes).
    Raises ValueError if API key is missing or response is invalid.
    Raises openai.APITimeoutError on timeout.
    """
    api_key = os.environ.get("DASHSCOPE_API_KEY")
    if not api_key:
        raise ValueError("DASHSCOPE_API_KEY environment variable is not set")

    client = OpenAI(
        api_key=api_key,
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
    )

    user_prompt = build_user_prompt(project, granularity, instructions)

    response = client.chat.completions.create(
        model="qwen-plus",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"},
        timeout=120,
    )

    content = response.choices[0].message.content
    if not content:
        raise ValueError("AI returned empty response")

    try:
        tree_data = json.loads(content)
    except json.JSONDecodeError as e:
        raise ValueError(f"AI returned invalid JSON: {e}")

    if "milestones" not in tree_data:
        raise ValueError("AI response missing 'milestones' key")

    return tree_data
