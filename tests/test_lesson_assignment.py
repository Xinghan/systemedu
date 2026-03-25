"""Tests for lesson project_assignment generation and code_samples cleaning."""

import json
import pytest


# ---------------------------------------------------------------------------
# _clean_empty_field tests
# ---------------------------------------------------------------------------

def test_clean_empty_field_real_content():
    from systemedu.education.lesson_generator import _clean_empty_field

    real_content = "## 基础用法\n\n```python\nx = 1\ny = 2\nprint(x + y)  # 输出 3\n```\n\n这段代码演示了变量的基本使用方式。"
    assert _clean_empty_field(real_content) == real_content


def test_clean_empty_field_placeholder_no_code():
    from systemedu.education.lesson_generator import _clean_empty_field

    assert _clean_empty_field("（本节点无代码示例）") == ""


def test_clean_empty_field_placeholder_no_programming():
    from systemedu.education.lesson_generator import _clean_empty_field

    assert _clean_empty_field("该知识点不涉及编程，无需代码示例。") == ""


def test_clean_empty_field_short_content():
    from systemedu.education.lesson_generator import _clean_empty_field

    assert _clean_empty_field("short") == ""


def test_clean_empty_field_empty():
    from systemedu.education.lesson_generator import _clean_empty_field

    assert _clean_empty_field("") == ""
    assert _clean_empty_field(None) == ""


def test_clean_empty_field_no_code_pattern():
    from systemedu.education.lesson_generator import _clean_empty_field

    assert _clean_empty_field("no code required for this section") == ""


def test_clean_empty_field_preserves_long_content_with_keyword():
    """Content that's long enough but contains placeholder should still be cleaned."""
    from systemedu.education.lesson_generator import _clean_empty_field

    placeholder_text = "该知识点不涉及编程，因此无代码示例提供。" + "x" * 100
    assert _clean_empty_field(placeholder_text) == ""


# ---------------------------------------------------------------------------
# DB: LessonContent has project_assignment field
# ---------------------------------------------------------------------------

def test_lesson_content_has_project_assignment_field():
    from systemedu.storage.db import LessonContent

    # Verify the ORM model has the new column
    assert hasattr(LessonContent, "project_assignment")


# ---------------------------------------------------------------------------
# _lesson_to_dict includes project_assignment
# ---------------------------------------------------------------------------

def test_lesson_to_dict_includes_project_assignment(tmp_path, monkeypatch):
    """_lesson_to_dict should include project_assignment field."""
    db_file = tmp_path / "test_assignment.db"
    monkeypatch.setattr("systemedu.storage.db.DB_FILE", db_file)
    from systemedu.storage.db import LessonContent, get_session, reset_db
    from systemedu.education.lesson_generator import _lesson_to_dict
    from datetime import datetime

    reset_db()
    session = get_session()
    try:
        lesson = LessonContent(
            project_name="test_proj",
            knode_id=1,
            status="ready",
            concept="## 概念\n\n这是一个测试概念内容，足够长的内容用于测试。",
            project_assignment="## 任务目标\n\n完成一个综合性项目。\n\n## 步骤\n\n1. 步骤一\n2. 步骤二",
            generated_at=datetime.now(),
        )
        session.add(lesson)
        session.commit()
        session.refresh(lesson)

        result = _lesson_to_dict(lesson)
        assert "project_assignment" in result
        assert "任务目标" in result["project_assignment"]
    finally:
        session.close()
        reset_db()


