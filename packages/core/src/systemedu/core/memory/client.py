"""Mem0 memory client (migrated from backend/agents/memory.py).

Provides persistent user/project/session memory using Mem0.
Requires the `mem0` optional dependency: pip install systemedu[mem0]
"""

import logging

from systemedu.core.config import get_config

logger = logging.getLogger(__name__)

_memory_instance = None


def _build_config() -> dict:
    """Build Mem0 config using the current LLM provider settings.

    spec 031: 优先用 qdrant_url (docker server), 否则 fallback embedded file.
    """
    config = get_config()
    mem_cfg = config.memory

    # Use the default LLM provider for memory operations
    provider_name = config.llm.default
    provider = config.llm.providers.get(provider_name)
    if provider is None:
        raise ValueError(f"LLM provider '{provider_name}' not configured")

    # embed provider: 可独立配置 (默认跟 LLM 同 provider)
    embed_provider_name = mem_cfg.embed_provider or provider_name
    embed_provider = config.llm.providers.get(embed_provider_name) or provider

    # vector store: server (qdrant_url) or embedded file fallback
    if mem_cfg.qdrant_url:
        # parse url -> host + port
        from urllib.parse import urlparse
        parsed = urlparse(mem_cfg.qdrant_url)
        vector_store = {
            "provider": "qdrant",
            "config": {
                "collection_name": mem_cfg.qdrant_collection,
                "host": parsed.hostname or "127.0.0.1",
                "port": parsed.port or 6333,
                "embedding_model_dims": mem_cfg.embed_dims,
            },
        }
    else:
        vector_store = {
            "provider": "qdrant",
            "config": {
                "collection_name": mem_cfg.qdrant_collection,
                "path": str(get_config_home() / "memory" / "qdrant_data"),
                "embedding_model_dims": mem_cfg.embed_dims,
                "on_disk": True,
            },
        }

    return {
        "llm": {
            "provider": "openai",
            "config": {
                "model": provider.model,
                "api_key": provider.api_key,
                "openai_base_url": provider.base_url,  # Mem0 用 openai_base_url
                "temperature": 0.1,
                "max_tokens": 2000,
            },
        },
        "embedder": {
            "provider": "openai",
            "config": {
                "model": mem_cfg.embed_model,
                "api_key": embed_provider.api_key,
                "openai_base_url": embed_provider.base_url,  # Mem0 用 openai_base_url
                "embedding_dims": mem_cfg.embed_dims,
            },
        },
        "vector_store": vector_store,
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
    *,
    project_id: str | None = None,
    limit: int = 5,
) -> list[str]:
    """Search relevant memories for a user.

    Per spec 014 (2-context model, context-matrix §4) we no longer
    filter by knode_id — within a project, memory is fully open across
    all knodes, and across projects (scope=global) we return
    unfiltered results.
    """
    config = get_config()
    if not config.memory.enabled:
        return []

    try:
        mem = get_memory()
        # Mem0 v2: user_id 走 filters
        filters: dict = {"user_id": user_id}
        if project_id:
            filters["project_id"] = project_id
        results = mem.search(query=query, filters=filters, limit=limit)
        memories = results.get("results", []) if isinstance(results, dict) else results
        return [m["memory"] for m in memories if isinstance(m, dict) and m.get("memory")]
    except Exception:
        logger.exception("Failed to retrieve memories")
        return []


def store_conversation(
    user_id: str,
    messages: list[dict],
    *,
    project_id: str | None = None,
    knode_id: str | None = None,
) -> dict | None:
    """Store a conversation in Mem0.

    `knode_id` is still written into metadata for audit / later
    analysis even though the 2-context retrieval path no longer
    filters by it.
    """
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
