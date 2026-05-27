"""lit_tree CLI 测试 (spec 035 T2.3) — mock LLM."""

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from course_factory import lit_tree


@pytest.fixture
def mock_workspace(tmp_path, monkeypatch):
    """构造最小 workspace project."""
    proj = tmp_path / "generated" / "test-proj"
    knodes = proj / "knodes"
    tree_dir = proj / "tree"
    knodes.mkdir(parents=True)
    tree_dir.mkdir(parents=True)

    # tree
    tree_data = {
        "modules": [
            {
                "module_id": "M01",
                "title": "PM2.5 入门",
                "core_question": "PM2.5 是什么?",
                "sequence_order": 1,
                "generation_guide": {"key_concepts": ["PM2.5", "颗粒物", "AQI"]},
            },
            {
                "module_id": "M02",
                "title": "AQI 计算",
                "core_question": "怎么算 AQI?",
                "sequence_order": 2,
                "generation_guide": {"key_concepts": ["分段线性插值", "一次函数"]},
            },
        ]
    }
    (tree_dir / "knowledge_tree.json").write_text(json.dumps(tree_data, ensure_ascii=False))

    # knode dirs
    for mid in ["M01", "M02"]:
        d = knodes / f"{mid}-w0-test"
        d.mkdir()
        (d / "lesson.md").write_text(f"# {mid} lesson\n这里教 {mid} 的内容.")
        (d / "theories.json").write_text(json.dumps([
            {"title": f"{mid} theory",
             "level_bodies": [{"level": "K1", "body_markdown": "K1 body"}]}
        ], ensure_ascii=False))

    # manifest
    (proj / "manifest.json").write_text(json.dumps({
        "slug": "test-proj",
        "version": "0.1.0",
        "frontmatter": {"age_band": "10-12"},
    }, ensure_ascii=False))

    monkeypatch.setattr(lit_tree, "GENERATED", tmp_path / "generated")
    return tmp_path


def test_load_project_corpus(mock_workspace):
    corpus = lit_tree._load_project_corpus("test-proj")
    assert "M01" in corpus
    assert "M02" in corpus
    assert "PM2.5" in corpus
    assert "AQI" in corpus
    assert "分段线性插值" in corpus


def test_lit_project_writes_manifest(mock_workspace):
    fake_response = MagicMock()
    fake_response.content = json.dumps({
        "lit_nodes": [
            {"node_id": "env.air.pm25_pm10", "lit_by": ["M01"], "reason": "M01 教 PM2.5"},
            {"node_id": "math.algebra.piecewise_func", "lit_by": ["M02"], "reason": "M02 教分段插值"},
            {"node_id": "nonexistent.fake.node", "lit_by": ["M02"], "reason": "should be dropped"},
        ],
        "missing_concepts": [
            {"concept": "示例缺失", "first_seen": "M01", "suggested_subject": "env"}
        ]
    })

    fake_llm = MagicMock()
    fake_llm.invoke.return_value = fake_response

    with patch.object(lit_tree, "get_llm", return_value=fake_llm):
        result = lit_tree.lit_project("test-proj", provider="claude", dry_run=False)

    # 校验: 不存在的 node_id 被丢弃
    assert len(result["lit_nodes"]) == 2
    assert all(n["node_id"] != "nonexistent.fake.node" for n in result["lit_nodes"])
    assert len(result["missing_concepts"]) == 1

    # manifest 写入校验
    m = json.loads((mock_workspace / "generated" / "test-proj" / "manifest.json").read_text())
    assert "lit_nodes" in m
    assert len(m["lit_nodes"]) == 2
    assert "missing_concepts" in m


def test_lit_project_dry_run(mock_workspace):
    fake_response = MagicMock()
    fake_response.content = json.dumps({"lit_nodes": [], "missing_concepts": []})
    fake_llm = MagicMock()
    fake_llm.invoke.return_value = fake_response

    with patch.object(lit_tree, "get_llm", return_value=fake_llm):
        lit_tree.lit_project("test-proj", dry_run=True)

    # manifest 没被改 (lit_nodes 不应出现)
    m = json.loads((mock_workspace / "generated" / "test-proj" / "manifest.json").read_text())
    assert "lit_nodes" not in m


def test_response_strips_markdown_fences(mock_workspace):
    fake_response = MagicMock()
    fake_response.content = "```json\n" + json.dumps({"lit_nodes": [], "missing_concepts": []}) + "\n```"
    fake_llm = MagicMock()
    fake_llm.invoke.return_value = fake_response

    with patch.object(lit_tree, "get_llm", return_value=fake_llm):
        result = lit_tree.lit_project("test-proj", dry_run=True)
    assert result == {"lit_nodes": [], "missing_concepts": []}
