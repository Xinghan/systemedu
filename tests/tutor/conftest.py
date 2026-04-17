"""Tutor test fixtures (spec 014).

Provides the ``--e2e`` CLI flag; tests marked ``@pytest.mark.e2e``
are skipped unless ``pytest --e2e`` is passed.
"""

from __future__ import annotations


def pytest_addoption(parser):
    parser.addoption(
        "--e2e",
        action="store_true",
        default=False,
        help="Run E2E tests that hit a real LLM (requires DASHSCOPE_API_KEY)",
    )


def pytest_collection_modifyitems(config, items):
    if config.getoption("--e2e"):
        return
    skip_e2e = __import__("pytest").mark.skip(reason="need --e2e to run")
    for item in items:
        if "e2e" in item.keywords:
            item.add_marker(skip_e2e)
