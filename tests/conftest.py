"""根级 tests 配置 — 注册 --quality gate (L3 质量评估)。

--e2e 在 tests/tutor/conftest.py 注册，不在此处。
"""
from __future__ import annotations

import pytest


def pytest_addoption(parser):
    parser.addoption(
        "--quality",
        action="store_true",
        default=False,
        help="跑 L3 质量评估测试，落盘 transcript artifact (需要真实 LLM)",
    )


def pytest_collection_modifyitems(config, items):
    if config.getoption("--quality"):
        return
    skip_q = pytest.mark.skip(reason="need --quality to run")
    for item in items:
        if "quality" in item.keywords:
            item.add_marker(skip_q)
