"""spec 017 E2E: 验证 web/api 路径上 LLM 请求被路由到正确的 provider URL。

起两个 aiohttp mock 子 server (creative_port, qwen_port)，把 config 里
两个 provider 的 base_url 指过去。然后:

1. 调 api_generate_description / api_generate_tree → 应打到 creative
   port (不是 qwen)
2. 调 course_factory.factory.generate_assignment → 应打到 qwen port
   (不是 creative)
3. 清空 creative.api_key 后再调 generate-description → 412 LLM_NOT_CONFIGURED
"""

from __future__ import annotations

import asyncio
import json
import socket
import threading
from pathlib import Path
from typing import Any

import pytest
import yaml
from aiohttp import web
from starlette.testclient import TestClient


# ---------------------------------------------------------------------------
# Mock OpenAI-compatible server
# ---------------------------------------------------------------------------

def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class MockLLMServer:
    """最小 OpenAI-compatible /v1/chat/completions 实现，记录所有请求。"""

    def __init__(self, label: str, default_response: str = "ok") -> None:
        self.label = label
        self.port = _free_port()
        self.default_response = default_response
        self.requests: list[dict[str, Any]] = []
        self._loop: asyncio.AbstractEventLoop | None = None
        self._thread: threading.Thread | None = None
        self._runner: web.AppRunner | None = None
        self._started = threading.Event()
        self._stop_event: asyncio.Event | None = None

    @property
    def base_url(self) -> str:
        return f"http://127.0.0.1:{self.port}/v1"

    async def _handler(self, request: web.Request) -> web.Response:
        body = await request.json()
        self.requests.append({
            "label": self.label,
            "path": request.path,
            "model": body.get("model"),
            "messages": body.get("messages"),
            "headers": dict(request.headers),
        })
        # 默认返回看起来像合法 JSON 的内容（生成知识树/描述等都期望 JSON）
        return web.json_response({
            "choices": [{
                "message": {
                    "role": "assistant",
                    "content": self.default_response,
                }
            }],
            "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
        })

    def start(self) -> None:
        def _run() -> None:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            self._loop = loop
            self._stop_event = asyncio.Event()
            app = web.Application()
            app.router.add_post("/v1/chat/completions", self._handler)
            runner = web.AppRunner(app)
            self._runner = runner
            loop.run_until_complete(runner.setup())
            site = web.TCPSite(runner, "127.0.0.1", self.port)
            loop.run_until_complete(site.start())
            self._started.set()
            loop.run_until_complete(self._stop_event.wait())
            loop.run_until_complete(runner.cleanup())
            loop.close()

        self._thread = threading.Thread(target=_run, daemon=True)
        self._thread.start()
        assert self._started.wait(timeout=5), f"mock server {self.label} did not start"

    def stop(self) -> None:
        if self._loop and self._stop_event:
            self._loop.call_soon_threadsafe(self._stop_event.set)
        if self._thread:
            self._thread.join(timeout=5)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_creative():
    s = MockLLMServer(
        label="creative",
        default_response='{"description": "测试描述", "tags": ["t1", "t2"]}',
    )
    s.start()
    yield s
    s.stop()


@pytest.fixture
def mock_qwen():
    # qwen 用于 v3 fast 路径（audio_script / assignment 等纯文本）
    s = MockLLMServer(label="qwen", default_response="# Test Assignment\n\nContent\n")
    s.start()
    yield s
    s.stop()


@pytest.fixture
def isolated_config(tmp_path: Path, monkeypatch, mock_creative, mock_qwen):
    cfg_path = tmp_path / "config.yaml"
    cfg_path.write_text(yaml.dump({
        "llm": {
            "default": "creative",
            "providers": {
                "creative": {
                    "base_url": mock_creative.base_url,
                    "api_key": "sk-creative-test",
                    "model": "test-model-creative",
                    "temperature": 0.4,
                    "max_tokens": 4096,
                },
                "qwen": {
                    "base_url": mock_qwen.base_url,
                    "api_key": "sk-qwen-test",
                    "model": "test-model-qwen",
                    "temperature": 0.3,
                    "max_tokens": 8192,
                },
            },
        },
        "gateway": {"host": "127.0.0.1", "port": 18820},
        "sandbox": {"enabled": False},
        "memory": {"enabled": False, "backend": "mem0"},
    }, default_flow_style=False), encoding="utf-8")

    from systemedu.core import config as cfg_mod
    monkeypatch.setattr(cfg_mod, "CONFIG_FILE", cfg_path)
    cfg_mod.reset_config()

    return cfg_path


@pytest.fixture
def auth_client(isolated_config):
    from systemedu.gateway.server import create_app
    app = create_app()
    client = TestClient(app, raise_server_exceptions=False)
    token = client.post(
        "/api/auth/login", json={"username": "root", "password": "123systemedu"}
    ).json()["token"]
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_generate_description_routes_to_creative(auth_client, mock_creative, mock_qwen) -> None:
    res = auth_client.post(
        "/api/projects/generate-description",
        json={"title": "测试项目", "age": 9, "node_count": 25},
    )
    assert res.status_code == 200, res.text

    # 应该打到 creative 不到 qwen
    assert len(mock_creative.requests) >= 1, "creative server 应至少收到 1 个请求"
    assert mock_creative.requests[0]["model"] == "test-model-creative"
    assert mock_creative.requests[0]["headers"]["Authorization"] == "Bearer sk-creative-test"
    assert len(mock_qwen.requests) == 0, "qwen server 不应收到请求"


def test_generate_tree_routes_to_creative(auth_client, mock_creative, mock_qwen) -> None:
    # 让 mock 返回最简合法的知识树 JSON
    mock_creative.default_response = json.dumps({
        "title": "测试项目",
        "milestones": [{
            "title": "M1",
            "description": "test",
            "knodes": [{
                "id": 1,
                "name": "N1",
                "description": "desc",
                "duration_minutes": 30,
            }],
        }],
    })
    res = auth_client.post(
        "/api/projects/generate-tree",
        json={"title": "测试", "description": "一个测试项目", "age": 9, "node_count": 5},
    )
    # 即使解析后的树不完美，gateway 也至少要打了请求到 creative
    assert len(mock_creative.requests) >= 1
    assert all(r["model"] == "test-model-creative" for r in mock_creative.requests)
    assert len(mock_qwen.requests) == 0


def test_factory_assignment_routes_to_qwen(isolated_config, mock_creative, mock_qwen) -> None:
    """course_factory/factory.py:generate_assignment 应该打到 qwen 而非 creative。"""
    from course_factory.factory import generate_assignment

    result = generate_assignment(
        knode={"name": "测试节点", "module_role": "regular"},
        milestone={"title": "M1"},
        plan_markdown="## test\n",
    )
    # 调用成功
    assert isinstance(result, str)
    # 应该打到 qwen 不到 creative
    assert len(mock_qwen.requests) >= 1
    assert mock_qwen.requests[0]["model"] == "test-model-qwen"
    assert mock_qwen.requests[0]["headers"]["Authorization"] == "Bearer sk-qwen-test"
    assert len(mock_creative.requests) == 0


def test_412_when_creative_key_empty(auth_client, isolated_config, mock_creative, mock_qwen) -> None:
    raw = yaml.safe_load(isolated_config.read_text(encoding="utf-8"))
    raw["llm"]["providers"]["creative"]["api_key"] = ""
    isolated_config.write_text(yaml.dump(raw, default_flow_style=False), encoding="utf-8")
    from systemedu.core import config as cfg_mod
    cfg_mod.reset_config()

    res = auth_client.post(
        "/api/projects/generate-description",
        json={"title": "测试", "age": 9, "node_count": 25},
    )
    assert res.status_code == 412
    body = res.json()
    assert body["error"] == "LLM_NOT_CONFIGURED"
    assert body["provider"] == "creative"
    # 请求不应打出去
    assert len(mock_creative.requests) == 0
    assert len(mock_qwen.requests) == 0
