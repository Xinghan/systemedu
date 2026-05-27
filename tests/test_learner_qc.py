"""learner_qc CLI 测试 (spec 035 T3.4) — mock LLM."""

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from course_factory import learner_qc


@pytest.fixture
def mock_workspace(tmp_path, monkeypatch):
    """构造最小 workspace project."""
    proj = tmp_path / "generated" / "test-proj"
    knodes = proj / "knodes"
    tree_dir = proj / "tree"
    knodes.mkdir(parents=True)
    tree_dir.mkdir(parents=True)

    tree_data = {
        "modules": [
            {"module_id": "M01", "title": "Hello", "core_question": "?",
             "sequence_order": 1, "generation_guide": {}},
            {"module_id": "M02", "title": "World", "core_question": "?",
             "sequence_order": 2, "generation_guide": {}},
        ]
    }
    (tree_dir / "knowledge_tree.json").write_text(json.dumps(tree_data, ensure_ascii=False))

    for mid in ["M01", "M02"]:
        d = knodes / f"{mid}-w0-test"
        d.mkdir()
        (d / "lesson.md").write_text(f"# {mid} lesson\nbody...")
        (d / "theories.json").write_text(json.dumps([
            {"title": "t", "level_bodies": [{"level": "K1", "body_markdown": "K1 body"}]}
        ], ensure_ascii=False))
        (d / "assignment.md").write_text(f"{mid} assignment")

    (proj / "manifest.json").write_text(json.dumps({
        "slug": "test-proj",
        "frontmatter": {"age_band": "10-12"},
    }, ensure_ascii=False))

    monkeypatch.setattr(learner_qc, "GENERATED", tmp_path / "generated")
    monkeypatch.setattr(learner_qc, "WORKSPACE", tmp_path)
    return tmp_path


def test_pick_persona_10_12():
    pid, txt = learner_qc._pick_persona("10-12")
    assert pid == "10-12"
    assert "10-12 岁" in txt


def test_pick_persona_13_15():
    pid, txt = learner_qc._pick_persona("13-15")
    assert pid == "13-15"


def test_pick_persona_16_18():
    pid, txt = learner_qc._pick_persona("16-18")
    assert pid == "16-18"


def test_pick_persona_override():
    pid, _ = learner_qc._pick_persona("10-12", override="16-18")
    assert pid == "16-18"


def test_pick_persona_default():
    pid, _ = learner_qc._pick_persona(None)
    assert pid == "13-15"  # 默认中段


def test_load_corpus(mock_workspace):
    corpus, mids = learner_qc._load_corpus("test-proj")
    assert mids == ["M01", "M02"]
    assert "M01 lesson" in corpus
    assert "M02 lesson" in corpus
    assert "assignment" in corpus


def test_strip_md_wrap():
    assert learner_qc._strip_md_wrap("```markdown\nhello\n```") == "hello"
    assert learner_qc._strip_md_wrap("```\nhi\n```") == "hi"
    assert learner_qc._strip_md_wrap("no wrap") == "no wrap"


def test_run_qc_writes_report(mock_workspace):
    fake_response = MagicMock()
    fake_response.content = (
        "```markdown\n"
        "## M01 reflection\n- 看懂了吗: ✓\n\n"
        "## M02 reflection\n- 看懂了吗: ⚠️\n\n"
        "## 累计断崖列表\n1. M02 卡在 ___\n"
        "```"
    )
    fake_llm = MagicMock()
    fake_llm.invoke.return_value = fake_response

    with patch.object(learner_qc, "get_llm", return_value=fake_llm):
        out_path = learner_qc.run_qc("test-proj")

    assert out_path.exists()
    assert out_path.name == "test-proj_learner_report.md"
    content = out_path.read_text(encoding="utf-8")
    assert "M01 reflection" in content
    assert "M02 reflection" in content
    assert "累计断崖列表" in content
    # 包裹被剥
    assert not content.startswith("```")
