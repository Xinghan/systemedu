"""spec 031 P6.C: contract tests — payload / snapshot / pg schema."""

from __future__ import annotations

import pytest


# ============================== Payload contract ==============================

EXPECTED_PAYLOAD_FIELDS = {
    "message", "session_id", "library_slug", "module_id",
    "page_kind", "confirm_response",
}


def test_payload_field_set():
    """ChatPayload 公开字段集严格对齐. 加 / 删字段必须改本测试 + 版本号."""
    from systemedu.student.chat.payload import ChatPayload
    assert set(ChatPayload.model_fields.keys()) == EXPECTED_PAYLOAD_FIELDS


def test_payload_page_kind_literal():
    """page_kind 是 Literal 而非自由 str."""
    from systemedu.student.chat.payload import ChatPayload
    with pytest.raises(Exception):
        ChatPayload(message="x", page_kind="weird")  # type: ignore


# ============================== MemorySnapshot contract ==============================

EXPECTED_SNAPSHOT_FIELDS = {
    "l1_profile", "l2_project_ctx",
    "l3_knode_state", "l3_knode_content",  # state 字段沿用 cloud-app 老 schema
    "l4_semantic_recall", "l5_skill_ctx", "injected_at",
}


def test_snapshot_fields_aligned():
    """MemorySnapshot TypedDict 字段集稳定 — 删字段会破前端 / prompt."""
    from systemedu.student.chat.memory_layers import MemorySnapshot
    fields = set(MemorySnapshot.__annotations__.keys())
    assert fields == EXPECTED_SNAPSHOT_FIELDS


def test_render_memory_includes_all_section_headers():
    """渲染模板必须包含 L1-L5 五个 section header (即使内容空)."""
    from systemedu.student.chat.memory_layers import render_memory
    out = render_memory({})
    for header in ("## L1", "## L2", "## L3", "## L4", "## L5"):
        assert header in out, f"missing {header}"


# ============================== PG schema contract ==============================

def test_alembic_head_present():
    """alembic head 必须可解析 — 否则 init_db 在 PG 上会爆."""
    import sys
    from pathlib import Path
    pkg = Path(__file__).resolve().parent.parent.parent / "packages" / "student-app"
    versions = pkg / "alembic" / "versions"
    assert versions.is_dir()
    migrations = list(versions.glob("*.py"))
    assert migrations, "no migrations found"


EXPECTED_NEW_TABLES_SPEC_031 = {
    "exercise_attempts", "student_facts", "pending_extractions",
}


def test_spec_031_tables_in_metadata():
    """新表必须 SQLAlchemy metadata 注册. autogenerate 才能比对."""
    from systemedu.student.db import Base
    tables = set(Base.metadata.tables.keys())
    missing = EXPECTED_NEW_TABLES_SPEC_031 - tables
    assert not missing, f"spec 031 missing tables: {missing}"


def test_student_facts_supersede_columns():
    """supersede chain 必须有 valid_from/valid_to/superseded_by."""
    from systemedu.student.db import StudentFact
    cols = {c.name for c in StudentFact.__table__.columns}
    for required in ("valid_from", "valid_to", "superseded_by", "scope", "category"):
        assert required in cols, f"missing column {required}"


def test_pending_extraction_unique_session():
    """同 session_id 只能一条 pending — 防 worker 重复处理."""
    from systemedu.student.db import PendingExtraction
    uqs = [c for c in PendingExtraction.__table__.constraints
           if c.__class__.__name__ == "UniqueConstraint"]
    cols = set()
    for c in uqs:
        cols.update(col.name for col in c.columns)
    assert "session_id" in cols
