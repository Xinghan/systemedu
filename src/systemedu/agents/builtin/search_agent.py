"""Search Agent - generates search queries via LLM and fetches resources via Tavily."""

import json
import logging

from langchain_core.messages import HumanMessage, SystemMessage

from systemedu.agents.base import BaseAgent

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """You are a resource researcher for an educational platform targeting students aged 6-18.

Given a knowledge node (title, summary, difficulty level), generate optimized search queries and use them to find high-quality learning resources.

Your task:
1. Generate a concise web search query (3-8 words) for finding tutorials, articles, and explanations
2. Generate a concise YouTube search query (3-8 words) for finding educational videos

Rules:
- Prefer English technical terms for queries (better search coverage)
- For YouTube queries, append words like "tutorial", "explained", or "for beginners" as appropriate
- For advanced difficulty (7-10), skip "for beginners"
- Output ONLY valid JSON, no markdown fences, no extra text

Output format:
{
  "web_query": "...",
  "youtube_query": "..."
}"""


class SearchAgent(BaseAgent):
    """Generates search queries via LLM and fetches resources via Tavily API."""

    name = "search_agent"
    description = "为知识点搜索相关网页和视频学习资源"

    def __init__(self, llm=None, tavily_api_key: str = "", max_results: int = 10, **kwargs):
        super().__init__(**kwargs)
        self._llm = llm
        self._tavily_api_key = tavily_api_key
        self._max_results = max_results

    async def process(self, message: str, context: dict | None = None) -> str:
        result = self.search(
            node_title=message,
            node_summary=context.get("summary", "") if context else "",
            difficulty=context.get("difficulty", 5) if context else 5,
        )
        return json.dumps(result, ensure_ascii=False) if result else ""

    def _generate_queries(self, node_title: str, node_summary: str, difficulty: int) -> tuple[str, str]:
        """Use LLM to generate optimized search queries for web and YouTube."""
        difficulty_label = "beginner" if difficulty <= 3 else "intermediate" if difficulty <= 6 else "advanced"

        user_prompt = (
            f"Knowledge node to research:\n"
            f"Title: {node_title}\n"
            f"Summary: {node_summary}\n"
            f"Difficulty: {difficulty_label} ({difficulty}/10)\n\n"
            f"Generate search queries as JSON."
        )

        try:
            response = self._llm.invoke([
                SystemMessage(content=_SYSTEM_PROMPT),
                HumanMessage(content=user_prompt),
            ])
            text = response.content.strip()
            if text.startswith("```"):
                lines = text.split("\n")
                text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
                text = text.strip()

            data = json.loads(text)
            web_query = data.get("web_query", node_title)
            youtube_query = data.get("youtube_query", f"{node_title} tutorial")
            return web_query, youtube_query

        except Exception:
            logger.exception(f"SearchAgent: LLM query generation failed for '{node_title}', using fallback")
            return node_title, f"{node_title} tutorial"

    def search(self, node_title: str, node_summary: str, difficulty: int) -> dict | None:
        """Generate queries and fetch resources via Tavily.

        Returns a dict with web_results and youtube_results, or None on failure.
        """
        if not self._tavily_api_key:
            logger.error("SearchAgent: no Tavily API key configured")
            return None

        web_query, youtube_query = self._generate_queries(node_title, node_summary, difficulty)

        try:
            from tavily import TavilyClient  # type: ignore

            client = TavilyClient(api_key=self._tavily_api_key)

            logger.info(f"SearchAgent: web_query='{web_query}' youtube_query='{youtube_query}'")

            web_raw = client.search(web_query, max_results=self._max_results)
            yt_raw = client.search(
                youtube_query,
                max_results=self._max_results,
                include_domains=["youtube.com"],
            )

            def _normalize(items: list, source_type: str) -> list[dict]:
                return [
                    {
                        "source_type": source_type,
                        "title": item.get("title", ""),
                        "url": item.get("url", ""),
                        "snippet": item.get("content", ""),
                        "score": float(item.get("score", 0.0)),
                    }
                    for item in items
                ]

            return {
                "web_query": web_query,
                "youtube_query": youtube_query,
                "web_results": _normalize(web_raw.get("results", []), "web"),
                "youtube_results": _normalize(yt_raw.get("results", []), "youtube"),
            }

        except Exception:
            logger.exception(f"SearchAgent: Tavily search failed for '{node_title}'")
            return None
