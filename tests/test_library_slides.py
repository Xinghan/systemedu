"""library slides 链路测试 (spec 2026-06-06)。"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, "packages/library-app/src")


def test_read_json_safely_reads_slides(tmp_path):
    from library.importer import _read_json_safely
    kd = tmp_path / "knodes" / "M01-w0-x"
    kd.mkdir(parents=True)
    (kd / "slides.json").write_text(
        json.dumps({"slides": [
            {"slide_id": "intro", "kind": "intro", "title": "开场",
             "body_markdown": "正文", "audio_script": "讲稿文字", "payload": {}}
        ]}, ensure_ascii=False), encoding="utf-8")
    data = _read_json_safely(kd / "slides.json", default={})
    slides = data.get("slides", []) if isinstance(data, dict) else []
    assert len(slides) == 1
    assert slides[0]["slide_id"] == "intro"
    assert slides[0]["audio_script"] == "讲稿文字"


def test_get_knode_returns_slides_key(tmp_path, monkeypatch):
    import importlib
    monkeypatch.setenv("LIBRARY_HOME", str(tmp_path / "libhome2"))
    from library import settings as _s; importlib.reload(_s)
    from library import models as _m; importlib.reload(_m)
    _m.init_db()
    from library.models import Project, Lesson, ProjectStatus
    with _m.get_session() as db:
        db.add(Project(slug="p1", title="t", status=ProjectStatus.published,
                       manifest_json={}, version="1.0.0"))
        db.add(Lesson(project_slug="p1", knode_id="M01", title="t",
                      slides=[{"slide_id": "s1", "kind": "intro", "title": "x",
                               "body_markdown": "b", "audio_script": "a", "payload": {}}],
                      version="1.0.0"))
        db.commit()
    from library.routes.public import get_knode
    out = get_knode("p1", "M01")
    assert "slides" in out
    assert out["slides"][0]["slide_id"] == "s1"


def test_proxy_knode_content_maps_slides():
    from systemedu.core.library_client.client import KnodeContent
    k = KnodeContent.from_dict(
        {"project_slug": "p1", "knode_id": "M01", "slides": [{"slide_id": "x"}]}
    )
    assert k.slides and k.slides[0]["slide_id"] == "x"
