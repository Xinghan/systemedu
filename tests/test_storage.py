"""Tests for local SQLite storage."""

import pytest

from systemedu.core.storage.db import (
    Base,
    ChatMessage,
    ChatSession,
    Enrollment,
    Highlight,
    LessonContent,
    LocalProject,
    NodeContextCache,
    get_engine,
    get_session,
    reset_db,
)


@pytest.fixture(autouse=True)
def setup_test_db(tmp_path, monkeypatch):
    """Use a temp database for tests."""
    reset_db()
    db_file = tmp_path / "test.db"
    monkeypatch.setattr("systemedu.core.storage.db.DB_FILE", db_file)
    yield
    reset_db()


class TestDatabase:
    def test_create_session(self):
        db = get_session()
        session = ChatSession(id="test-123", agent_name="tutor")
        db.add(session)
        db.commit()

        found = db.query(ChatSession).filter_by(id="test-123").first()
        assert found is not None
        assert found.agent_name == "tutor"
        db.close()

    def test_create_message(self):
        db = get_session()
        session = ChatSession(id="test-456", agent_name="default")
        db.add(session)
        db.commit()

        msg = ChatMessage(session_id="test-456", role="user", content="hello")
        db.add(msg)
        db.commit()

        messages = db.query(ChatMessage).filter_by(session_id="test-456").all()
        assert len(messages) == 1
        assert messages[0].content == "hello"
        db.close()

    def test_session_message_relationship(self):
        db = get_session()
        session = ChatSession(id="test-789", agent_name="default")
        db.add(session)
        db.commit()

        db.add(ChatMessage(session_id="test-789", role="user", content="hi"))
        db.add(ChatMessage(session_id="test-789", role="assistant", content="hello"))
        db.commit()

        found = db.query(ChatSession).filter_by(id="test-789").first()
        assert len(found.messages) == 2
        db.close()

    def test_create_local_project(self):
        db = get_session()
        project = LocalProject(
            name="test-project",
            title="Test Project",
            path="/tmp/test",
        )
        db.add(project)
        db.commit()

        found = db.query(LocalProject).filter_by(name="test-project").first()
        assert found.title == "Test Project"
        db.close()

    def test_node_context_cache(self):
        db = get_session()
        cache = NodeContextCache(
            project_name="test-project",
            knode_id=0,
            prerequisites_trace="需要了解基础数学",
            learning_suggestions="建议从线性代数开始",
            related_extensions="可以拓展到深度学习",
        )
        db.add(cache)
        db.commit()

        found = db.query(NodeContextCache).filter_by(
            project_name="test-project", knode_id=0
        ).first()
        assert found is not None
        assert found.prerequisites_trace == "需要了解基础数学"
        assert found.learning_suggestions == "建议从线性代数开始"
        assert found.related_extensions == "可以拓展到深度学习"
        db.close()

    def test_node_context_cache_unique_constraint(self):
        db = get_session()
        cache1 = NodeContextCache(
            project_name="proj", knode_id=1,
            prerequisites_trace="a", learning_suggestions="b", related_extensions="c",
        )
        db.add(cache1)
        db.commit()

        cache2 = NodeContextCache(
            project_name="proj", knode_id=1,
            prerequisites_trace="x", learning_suggestions="y", related_extensions="z",
        )
        db.add(cache2)
        with pytest.raises(Exception):
            db.commit()
        db.close()

    def test_lesson_content_crud(self):
        db = get_session()
        lesson = LessonContent(
            project_name="test-project",
            knode_id=0,
            status="ready",
            concept="# 核心概念\n这是核心概念内容",
            examples="# 示例\n示例内容",
            code_samples="```python\nprint('hello')\n```",
            practice="# 练习\n练习题",
            key_takeaways="- 要点1\n- 要点2",
            quiz_data='[{"question":"题目","options":["A","B","C","D"],"answer":0,"explanation":"解析"}]',
            content_type="text",
        )
        db.add(lesson)
        db.commit()

        found = db.query(LessonContent).filter_by(
            project_name="test-project", knode_id=0
        ).first()
        assert found is not None
        assert found.status == "ready"
        assert found.concept == "# 核心概念\n这是核心概念内容"
        assert found.examples == "# 示例\n示例内容"
        assert found.code_samples == "```python\nprint('hello')\n```"
        assert found.practice == "# 练习\n练习题"
        assert found.key_takeaways == "- 要点1\n- 要点2"
        assert '"question"' in found.quiz_data
        assert found.content_type == "text"
        db.close()

    def test_lesson_content_unique_constraint(self):
        db = get_session()
        lesson1 = LessonContent(
            project_name="proj", knode_id=1, status="ready",
        )
        db.add(lesson1)
        db.commit()

        lesson2 = LessonContent(
            project_name="proj", knode_id=1, status="pending",
        )
        db.add(lesson2)
        with pytest.raises(Exception):
            db.commit()
        db.close()

    def test_lesson_content_default_values(self):
        db = get_session()
        lesson = LessonContent(
            project_name="proj", knode_id=5,
        )
        db.add(lesson)
        db.commit()

        found = db.query(LessonContent).filter_by(
            project_name="proj", knode_id=5
        ).first()
        assert found.status == "pending"
        assert found.concept == ""
        assert found.examples == ""
        assert found.code_samples == ""
        assert found.practice == ""
        assert found.key_takeaways == ""
        assert found.quiz_data == ""
        assert found.content_type == "text"
        assert found.generated_at is None
        db.close()


class TestEnrollment:
    def test_create_enrollment(self):
        from datetime import datetime

        db = get_session()
        enrollment = Enrollment(
            user_id="user1",
            project_name="test-proj",
            status="active",
            started_at=datetime.now(),
            total_nodes=10,
        )
        db.add(enrollment)
        db.commit()

        found = db.query(Enrollment).filter_by(
            user_id="user1", project_name="test-proj"
        ).first()
        assert found is not None
        assert found.status == "active"
        assert found.total_nodes == 10
        assert found.nodes_passed == 0
        assert found.total_time_seconds == 0
        assert found.started_at is not None
        db.close()

    def test_enrollment_unique_constraint(self):
        db = get_session()
        e1 = Enrollment(user_id="user1", project_name="proj1", status="active")
        db.add(e1)
        db.commit()

        e2 = Enrollment(user_id="user1", project_name="proj1", status="paused")
        db.add(e2)
        with pytest.raises(Exception):
            db.commit()
        db.close()

    def test_enrollment_different_users(self):
        db = get_session()
        e1 = Enrollment(user_id="user1", project_name="proj1", status="active")
        e2 = Enrollment(user_id="user2", project_name="proj1", status="active")
        db.add(e1)
        db.add(e2)
        db.commit()

        count = db.query(Enrollment).filter_by(project_name="proj1").count()
        assert count == 2
        db.close()

    def test_enrollment_update_fields(self):
        from datetime import datetime

        db = get_session()
        enrollment = Enrollment(
            user_id="default",
            project_name="proj2",
            status="active",
            started_at=datetime.now(),
            total_nodes=5,
        )
        db.add(enrollment)
        db.commit()

        found = db.query(Enrollment).filter_by(
            user_id="default", project_name="proj2"
        ).first()
        found.nodes_passed = 3
        found.total_time_seconds = 1800
        found.last_activity_at = datetime.now()
        db.commit()

        updated = db.query(Enrollment).filter_by(
            user_id="default", project_name="proj2"
        ).first()
        assert updated.nodes_passed == 3
        assert updated.total_time_seconds == 1800
        assert updated.last_activity_at is not None
        db.close()

    def test_enrollment_default_values(self):
        db = get_session()
        enrollment = Enrollment(
            project_name="proj3",
        )
        db.add(enrollment)
        db.commit()

        found = db.query(Enrollment).filter_by(project_name="proj3").first()
        assert found.user_id == "default"
        assert found.status == "active"
        assert found.total_time_seconds == 0
        assert found.nodes_passed == 0
        assert found.total_nodes == 0
        assert found.started_at is None
        assert found.last_activity_at is None
        assert found.created_at is not None
        db.close()


class TestHighlight:
    def test_create_highlight(self):
        db = get_session()
        h = Highlight(
            user_id="default",
            project_name="test-proj",
            knode_id=0,
            tab="concept",
            page_index=1,
            text="Hello world",
            start_offset=10,
            end_offset=21,
            color="yellow",
        )
        db.add(h)
        db.commit()

        found = db.query(Highlight).filter_by(project_name="test-proj", knode_id=0).first()
        assert found is not None
        assert found.text == "Hello world"
        assert found.tab == "concept"
        assert found.page_index == 1
        assert found.start_offset == 10
        assert found.end_offset == 21
        assert found.color == "yellow"
        assert found.created_at is not None
        db.close()

    def test_highlight_unique_constraint(self):
        from sqlalchemy.exc import IntegrityError

        db = get_session()
        h1 = Highlight(
            user_id="default", project_name="proj", knode_id=0,
            tab="concept", page_index=0, text="same text", start_offset=0, end_offset=9,
        )
        h2 = Highlight(
            user_id="default", project_name="proj", knode_id=0,
            tab="concept", page_index=0, text="same text", start_offset=0, end_offset=9,
        )
        db.add(h1)
        db.commit()
        db.add(h2)
        with pytest.raises(IntegrityError):
            db.commit()
        db.close()

    def test_highlight_different_text_same_tab(self):
        """Different text on same tab/page should be allowed."""
        db = get_session()
        h1 = Highlight(
            user_id="default", project_name="proj", knode_id=0,
            tab="concept", page_index=0, text="text one", start_offset=0, end_offset=8,
        )
        h2 = Highlight(
            user_id="default", project_name="proj", knode_id=0,
            tab="concept", page_index=0, text="text two", start_offset=0, end_offset=8,
        )
        db.add(h1)
        db.add(h2)
        db.commit()

        count = db.query(Highlight).filter_by(project_name="proj", knode_id=0).count()
        assert count == 2
        db.close()

    def test_highlight_delete(self):
        db = get_session()
        h = Highlight(
            user_id="default", project_name="proj", knode_id=1,
            tab="code_samples", text="x = 1", start_offset=0, end_offset=5,
        )
        db.add(h)
        db.commit()
        hid = h.id

        db.delete(h)
        db.commit()

        found = db.query(Highlight).filter_by(id=hid).first()
        assert found is None
        db.close()

    def test_highlight_default_values(self):
        db = get_session()
        h = Highlight(
            project_name="proj", knode_id=0,
            tab="practice", text="test", start_offset=0, end_offset=4,
        )
        db.add(h)
        db.commit()

        found = db.query(Highlight).filter_by(project_name="proj", tab="practice").first()
        assert found.user_id == "default"
        assert found.page_index == 0
        assert found.note == ""
        assert found.color == "yellow"
        db.close()
