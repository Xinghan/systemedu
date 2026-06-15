"""Tests for systemedu.core.memory.client.

memory 模块依赖可选的 mem0 包。这些单测策略:
- enabled=False 直接短路 (不触发 mem0 import)
- enabled=True 时 mock mem0.Memory, 验证 build_config / retrieve / store 参数转发
- mem0 没装 (ImportError) 时 get_memory 应该抛 ImportError
"""

from __future__ import annotations

import sys
import types
from unittest.mock import MagicMock, patch

import pytest

from systemedu.core.memory import client as memory_client


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _make_fake_config(*, enabled: bool = True):
    """构造一个最小可用的 fake config (含 llm 和 memory)."""
    provider = MagicMock()
    provider.model = "qwen3.6-flash"
    provider.api_key = "sk-test"
    provider.base_url = "https://example.com/v1"

    config = MagicMock()
    config.llm.default = "thinking"
    config.llm.providers = {"thinking": provider}
    config.memory.enabled = enabled
    return config


@pytest.fixture(autouse=True)
def _reset_singleton():
    """每个测试前后清掉 module 级别的 _memory_instance singleton."""
    memory_client._memory_instance = None
    yield
    memory_client._memory_instance = None


# ---------------------------------------------------------------------------
# _build_config
# ---------------------------------------------------------------------------

class TestBuildConfig:
    def test_uses_default_provider(self):
        with patch.object(memory_client, "get_config", return_value=_make_fake_config()):
            cfg = memory_client._build_config()
        assert cfg["llm"]["config"]["model"] == "qwen3.6-flash"
        assert cfg["llm"]["config"]["api_key"] == "sk-test"
        assert cfg["llm"]["config"]["base_url"] == "https://example.com/v1"
        assert cfg["embedder"]["config"]["api_key"] == "sk-test"
        assert cfg["vector_store"]["provider"] == "qdrant"

    def test_raises_when_default_provider_missing(self):
        config = _make_fake_config()
        config.llm.providers = {}  # 没有 "thinking" provider
        with patch.object(memory_client, "get_config", return_value=config):
            with pytest.raises(ValueError, match="not configured"):
                memory_client._build_config()


# ---------------------------------------------------------------------------
# retrieve_memories
# ---------------------------------------------------------------------------

class TestRetrieveMemories:
    def test_short_circuit_when_disabled(self):
        with patch.object(memory_client, "get_config",
                          return_value=_make_fake_config(enabled=False)):
            out = memory_client.retrieve_memories("u1", "q")
        assert out == []

    def test_returns_memory_strings(self):
        fake_mem = MagicMock()
        fake_mem.search.return_value = {
            "results": [
                {"memory": "first"},
                {"memory": "second"},
                {"memory": ""},        # empty -> 过滤掉
                {"other": "no key"},   # 没 memory key -> 过滤掉
            ]
        }
        with patch.object(memory_client, "get_config", return_value=_make_fake_config()), \
             patch.object(memory_client, "get_memory", return_value=fake_mem):
            out = memory_client.retrieve_memories("u1", "what's up", limit=3)
        assert out == ["first", "second"]
        # kwargs 校验: 默认无 filters
        kwargs = fake_mem.search.call_args.kwargs
        assert kwargs["user_id"] == "u1"
        assert kwargs["query"] == "what's up"
        assert kwargs["limit"] == 3
        assert "filters" not in kwargs

    def test_project_id_becomes_filter(self):
        fake_mem = MagicMock()
        fake_mem.search.return_value = {"results": []}
        with patch.object(memory_client, "get_config", return_value=_make_fake_config()), \
             patch.object(memory_client, "get_memory", return_value=fake_mem):
            memory_client.retrieve_memories("u1", "q", project_id="proj-A")
        kwargs = fake_mem.search.call_args.kwargs
        assert kwargs["filters"] == {"project_id": "proj-A"}

    def test_swallows_exceptions(self, caplog):
        fake_mem = MagicMock()
        fake_mem.search.side_effect = RuntimeError("boom")
        with patch.object(memory_client, "get_config", return_value=_make_fake_config()), \
             patch.object(memory_client, "get_memory", return_value=fake_mem):
            out = memory_client.retrieve_memories("u1", "q")
        assert out == []
        # 异常被 logger.exception 记录, 不上抛


# ---------------------------------------------------------------------------
# store_conversation
# ---------------------------------------------------------------------------

class TestStoreConversation:
    def test_short_circuit_when_disabled(self):
        with patch.object(memory_client, "get_config",
                          return_value=_make_fake_config(enabled=False)):
            out = memory_client.store_conversation("u1", [{"role": "user", "content": "hi"}])
        assert out is None

    def test_writes_metadata(self):
        fake_mem = MagicMock()
        fake_mem.add.return_value = {"id": "mem-1"}
        with patch.object(memory_client, "get_config", return_value=_make_fake_config()), \
             patch.object(memory_client, "get_memory", return_value=fake_mem):
            out = memory_client.store_conversation(
                "u1",
                [{"role": "user", "content": "hi"}],
                project_id="proj-A",
                knode_id="M01",
            )
        assert out == {"id": "mem-1"}
        kwargs = fake_mem.add.call_args.kwargs
        assert kwargs["user_id"] == "u1"
        assert kwargs["metadata"] == {"project_id": "proj-A", "knode_id": "M01"}

    def test_no_metadata_when_omitted(self):
        fake_mem = MagicMock()
        fake_mem.add.return_value = {"id": "mem-2"}
        with patch.object(memory_client, "get_config", return_value=_make_fake_config()), \
             patch.object(memory_client, "get_memory", return_value=fake_mem):
            memory_client.store_conversation("u1", [{"role": "user", "content": "hi"}])
        assert fake_mem.add.call_args.kwargs["metadata"] == {}

    def test_swallows_exceptions(self):
        fake_mem = MagicMock()
        fake_mem.add.side_effect = RuntimeError("boom")
        with patch.object(memory_client, "get_config", return_value=_make_fake_config()), \
             patch.object(memory_client, "get_memory", return_value=fake_mem):
            assert memory_client.store_conversation("u1", []) is None


# ---------------------------------------------------------------------------
# get_memory: ImportError when mem0 missing
# ---------------------------------------------------------------------------

class TestGetMemoryImport:
    def test_import_error_when_mem0_missing(self):
        # 用 import 钩子伪装 mem0 不存在
        original_import = __import__

        def fake_import(name, *args, **kwargs):
            if name == "mem0":
                raise ImportError("No module named 'mem0'")
            return original_import(name, *args, **kwargs)

        with patch("builtins.__import__", side_effect=fake_import):
            with pytest.raises(ImportError, match="mem0 is not installed"):
                memory_client.get_memory()

    def test_singleton_caches_instance(self):
        fake_mem = MagicMock()
        fake_module = types.ModuleType("mem0")
        fake_module.Memory = MagicMock()
        fake_module.Memory.from_config.return_value = fake_mem

        with patch.dict(sys.modules, {"mem0": fake_module}), \
             patch.object(memory_client, "get_config", return_value=_make_fake_config()):
            a = memory_client.get_memory()
            b = memory_client.get_memory()
        assert a is b
        assert a is fake_mem
        # from_config 只被调一次
        assert fake_module.Memory.from_config.call_count == 1
