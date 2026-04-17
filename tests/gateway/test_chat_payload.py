"""Tests for ChatPayload validation (T5.1).

Covers context-matrix.md 2-context model enforcement:
- project scope requires project_name
- global scope disallows project_name / knode_id
- legacy "project" alias works
- thread_id construction matches context-matrix.md section 5
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from systemedu.gateway.chat_payload import ChatPayload


class TestProjectScope:
    def test_valid_project_payload(self):
        p = ChatPayload(
            message="hello",
            context_scope="project",
            project_name="mars-risk-map",
            knode_id="3",
        )
        assert p.context_scope == "project"
        assert p.project_name == "mars-risk-map"
        assert p.knode_id == "3"

    def test_project_scope_missing_project_name(self):
        with pytest.raises(ValidationError, match="requires project_name"):
            ChatPayload(
                message="hello",
                context_scope="project",
            )

    def test_project_scope_knode_optional(self):
        p = ChatPayload(
            message="hello",
            context_scope="project",
            project_name="mars",
        )
        assert p.knode_id is None


class TestGlobalScope:
    def test_valid_global_payload(self):
        p = ChatPayload(
            message="hello",
            context_scope="global",
        )
        assert p.context_scope == "global"
        assert p.project_name is None

    def test_global_scope_with_project_name(self):
        with pytest.raises(ValidationError, match="conflicts with project_name"):
            ChatPayload(
                message="hello",
                context_scope="global",
                project_name="mars",
            )

    def test_global_scope_with_knode_id(self):
        with pytest.raises(ValidationError, match="conflicts with knode_id"):
            ChatPayload(
                message="hello",
                context_scope="global",
                knode_id="3",
            )


class TestLegacyCompat:
    def test_project_alias(self):
        """Old frontend sends {"project": "mars"} instead of {"project_name": "mars"}."""
        p = ChatPayload(
            message="hello",
            project="mars",
        )
        assert p.project_name == "mars"

    def test_node_id_alias(self):
        """Old frontend sends {"node_id": 3} instead of {"knode_id": "3"}."""
        p = ChatPayload(
            message="hello",
            project_name="mars",
            node_id=3,
        )
        assert p.knode_id == "3"

    def test_default_scope_is_project(self):
        """If omitted, context_scope defaults to 'project' for backward compat
        (all existing calls send a project name)."""
        p = ChatPayload(
            message="hello",
            project_name="mars",
        )
        assert p.context_scope == "project"


class TestThreadId:
    def test_project_thread_id(self):
        p = ChatPayload(
            message="hello",
            context_scope="project",
            project_name="mars",
        )
        assert p.thread_id("u1") == "u1:mars:project-main"

    def test_global_thread_id(self):
        p = ChatPayload(
            message="hello",
            context_scope="global",
        )
        assert p.thread_id("u1") == "u1:global"


class TestConfirmResponse:
    def test_confirm_response_passes_through(self):
        p = ChatPayload(
            message="yes",
            project_name="mars",
            confirm_response={"confirm_id": "c-42", "approved": True},
        )
        assert p.confirm_response is not None
        assert p.confirm_response["approved"] is True
