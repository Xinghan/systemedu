"""spec 028 P1.10: ChatPayload validation tests."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from systemedu.student.chat.payload import ChatPayload


def test_valid_with_module():
    p = ChatPayload(message="hi", library_slug="slug-a", module_id="M01")
    assert p.thread_id("u1") == "u1:slug-a:M01"
    assert p.context_scope == "project"


def test_valid_project_no_module():
    p = ChatPayload(message="hi", library_slug="slug-a")
    assert p.thread_id("u1") == "u1:slug-a:project-main"


def test_valid_global():
    p = ChatPayload(message="hi")
    assert p.thread_id("u1") == "u1:global"
    assert p.context_scope == "global"


def test_module_without_slug_rejected():
    with pytest.raises(ValidationError):
        ChatPayload(message="hi", module_id="M01")


def test_empty_message_rejected():
    with pytest.raises(ValidationError):
        ChatPayload(message="   ")


def test_confirm_response_passthrough():
    p = ChatPayload(message="ok", confirm_response={"confirm_id": "x"})
    assert p.confirm_response == {"confirm_id": "x"}
