"""Mem0 memory client for persistent user/project/session memory."""

import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from backend directory
_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_env_path)

DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY", "")

# Lazy singleton
_memory_instance = None


def _build_config() -> dict:
    """Build Mem0 config using Qwen LLM + DashScope embeddings + local Qdrant."""
    qdrant_path = os.getenv(
        "QDRANT_PATH",
        str(Path(__file__).resolve().parent.parent / ".qdrant_data"),
    )
    return {
        "llm": {
            "provider": "openai",
            "config": {
                "model": "qwen-plus",
                "api_key": DASHSCOPE_API_KEY,
                "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
                "temperature": 0.1,
                "max_tokens": 2000,
            },
        },
        "embedder": {
            "provider": "openai",
            "config": {
                "model": "text-embedding-v3",
                "api_key": DASHSCOPE_API_KEY,
                "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
                "embedding_dims": 1024,
            },
        },
        "vector_store": {
            "provider": "qdrant",
            "config": {
                "collection_name": "systemedu_memories",
                "path": qdrant_path,
                "embedding_model_dims": 1024,
                "on_disk": True,
            },
        },
    }


def get_memory():
    """Get or create the singleton Mem0 Memory instance."""
    global _memory_instance
    if _memory_instance is None:
        if not DASHSCOPE_API_KEY:
            raise ValueError("DASHSCOPE_API_KEY not set. Add it to backend/.env")
        from mem0 import Memory

        _memory_instance = Memory.from_config(config_dict=_build_config())
    return _memory_instance


def retrieve_memories(
    user_id: int,
    query: str,
    project_id: int | None = None,
    limit: int = 5,
) -> list[str]:
    """Search relevant memories for a user and return as a list of strings."""
    mem = get_memory()
    user_key = f"user_{user_id}"

    kwargs: dict = {"query": query, "user_id": user_key, "limit": limit}
    if project_id:
        kwargs["filters"] = {"project_id": str(project_id)}

    results = mem.search(**kwargs)
    memories = results.get("results", [])
    return [m["memory"] for m in memories if m.get("memory")]


def store_conversation(
    user_id: int,
    messages: list[dict],
    project_id: int | None = None,
    knode_id: int | None = None,
) -> dict:
    """Store a conversation in Mem0 for the user. Mem0 auto-extracts key facts."""
    mem = get_memory()
    user_key = f"user_{user_id}"

    metadata = {}
    if project_id:
        metadata["project_id"] = str(project_id)
    if knode_id:
        metadata["knode_id"] = str(knode_id)

    result = mem.add(messages, user_id=user_key, metadata=metadata)
    return result
