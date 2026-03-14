"""Mem0 memory client (migrated from backend/agents/memory.py).

Provides persistent user/project/session memory using Mem0.
Requires the `mem0` optional dependency: pip install systemedu[mem0]
"""

import logging

from systemedu.core.config import get_config

logger = logging.getLogger(__name__)

_memory_instance = None


def _build_config() -> dict:
    """Build Mem0 config using the current LLM provider settings."""
    config = get_config()

    # Use the default LLM provider for memory operations
    provider_name = config.llm.default
    provider = config.llm.providers.get(provider_name)
    if provider is None:
        raise ValueError(f"LLM provider '{provider_name}' not configured")

    return {
        "llm": {
            "provider": "openai",
            "config": {
                "model": provider.model,
                "api_key": provider.api_key,
                "base_url": provider.base_url,
                "temperature": 0.1,
                "max_tokens": 2000,
            },
        },
        "embedder": {
            "provider": "openai",
            "config": {
                "model": "text-embedding-v3",
                "api_key": provider.api_key,
                "base_url": provider.base_url,
                "embedding_dims": 1024,
            },
        },
        "vector_store": {
            "provider": "qdrant",
            "config": {
                "collection_name": "systemedu_memories",
                "path": str(get_config_home() / "memory" / "qdrant_data"),
                "embedding_model_dims": 1024,
                "on_disk": True,
            },
        },
    }


def get_config_home():
    from systemedu.core.config import SYSTEMEDU_HOME
    return SYSTEMEDU_HOME


def get_memory():
    """Get or create the singleton Mem0 Memory instance."""
    global _memory_instance
    if _memory_instance is None:
        try:
            from mem0 import Memory
        except ImportError:
            raise ImportError(
                "mem0 is not installed. Install it with: pip install systemedu[mem0]"
            )
        _memory_instance = Memory.from_config(config_dict=_build_config())
    return _memory_instance


def retrieve_memories(
    user_id: str,
    query: str,
    project_id: str | None = None,
    limit: int = 5,
) -> list[str]:
    """Search relevant memories for a user."""
    config = get_config()
    if not config.memory.enabled:
        return []

    try:
        mem = get_memory()
        kwargs: dict = {"query": query, "user_id": user_id, "limit": limit}
        if project_id:
            kwargs["filters"] = {"project_id": project_id}

        results = mem.search(**kwargs)
        memories = results.get("results", [])
        return [m["memory"] for m in memories if m.get("memory")]
    except Exception:
        logger.exception("Failed to retrieve memories")
        return []


def store_conversation(
    user_id: str,
    messages: list[dict],
    project_id: str | None = None,
    knode_id: str | None = None,
) -> dict | None:
    """Store a conversation in Mem0."""
    config = get_config()
    if not config.memory.enabled:
        return None

    try:
        mem = get_memory()
        metadata = {}
        if project_id:
            metadata["project_id"] = project_id
        if knode_id:
            metadata["knode_id"] = knode_id

        return mem.add(messages, user_id=user_id, metadata=metadata)
    except Exception:
        logger.exception("Failed to store memories")
        return None
