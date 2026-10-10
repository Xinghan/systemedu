"""Version barrier for the coordinated molecule course ID migration.

The version header is a consistency check, NOT authentication or authorization.
Existing route authentication and ownership checks remain mandatory.
"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from urllib.parse import unquote

from sqlalchemy import inspect, text
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

_MAP_PATH = Path(__file__).with_name("molecule-numbering-v2.json")
SPEC = json.loads(_MAP_PATH.read_text())
SLUG = SPEC["project"]
VERSION = SPEC["version"]
LEGACY_BY_CURRENT = {m["new"]: m["old"] for m in SPEC["modules"]}


def numbering_active() -> bool:
    value = os.environ.get("STUDENT_MOLECULE_NUMBERING", "legacy-v1")
    if value not in {"legacy-v1", VERSION}:
        raise RuntimeError("Unknown molecule numbering version")
    return value == VERSION


def verify_numbering_activation(engine) -> None:
    """Fail startup if the configured runtime and transactional migration disagree."""
    with engine.connect() as conn:
        marker = None
        if "course_numbering_migrations" in inspect(conn).get_table_names():
            marker = conn.execute(text("SELECT mapping_sha256 FROM course_numbering_migrations WHERE migration_id=:id"), {"id": "molecule-numbering-consecutive-v2"}).scalar_one_or_none()
    if bool(marker) != numbering_active():
        raise RuntimeError("Course numbering environment and database migration disagree")
    if marker and marker != hashlib.sha256(_MAP_PATH.read_bytes()).hexdigest():
        raise RuntimeError("Course numbering map does not match migration audit")


def version_error(slug: str | None, version: str | None) -> str | None:
    if slug != SLUG:
        return None
    if numbering_active() and version != VERSION:
        return "课程编号已更新，请刷新页面后重试。此次操作未保存。"
    if not numbering_active() and version == VERSION:
        return "连续编号课程尚未在此环境启用，请稍后再试。"
    return None


def checkpoint_module_id(slug: str | None, current: str | None) -> str | None:
    # Retain only opaque historical conversation identity, not the current course ID.
    if slug == SLUG and current and numbering_active():
        if current not in LEGACY_BY_CURRENT:
            raise ValueError("Unknown current molecule module")
        return LEGACY_BY_CURRENT[current]
    return current


def summary_cache_key(slug: str, module_id: str) -> str:
    namespace = VERSION + ":" if slug == SLUG and numbering_active() else ""
    return f"knode:{namespace}{slug}:{module_id}:summary"


class CourseNumberingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        if request.method == "OPTIONS":
            return await call_next(request)
        parts = unquote(request.url.path).split("/")
        scoped = SLUG in parts
        # These aggregate responses also carry module IDs. An old homepage must
        # not turn a newly returned M23 into an ambiguous legacy link.
        aggregate = request.url.path.rstrip('/') in {"/api/my/projects", "/api/my/badges", "/api/user/knowledge-tree"}
        sessions = request.url.path.rstrip('/') == "/api/chat/sessions" or request.url.path.startswith('/api/chat/sessions/')
        explicit_other = request.query_params.get('library_slug') not in {None, '', SLUG}
        if request.method in {'GET','HEAD'} and (aggregate or (sessions and not explicit_other)):
            scoped = True
        # Immutable assets keep historical filenames; module HTML is versioned.
        if scoped and "files" in parts:
            after = parts[parts.index("files") + 1:]
            scoped = bool(after and after[0] == "knodes")
        scoped = scoped or any(request.query_params.get(k) == SLUG for k in ("slug", "library_slug", "project_slug", "project_name"))
        if not scoped and request.method in {"POST", "PUT", "PATCH", "DELETE"} and "application/json" in request.headers.get("content-type", ""):
            try:
                body = await request.json()
            except (ValueError, UnicodeDecodeError):
                body = None
            if isinstance(body, dict):
                scoped = any(body.get(k) == SLUG for k in ("slug", "library_slug", "project_slug", "project_name"))
        if scoped:
            error = version_error(SLUG, request.headers.get("x-course-numbering"))
            if error:
                return JSONResponse({"error": "course_numbering_mismatch", "message": error}, status_code=409)
        return await call_next(request)
