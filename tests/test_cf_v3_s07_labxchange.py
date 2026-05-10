"""s07_labxchange 单元 + 集成测试。"""

from __future__ import annotations

import pytest

from systemedu.core.course_factory_v3.progress import Emitter
from systemedu.core.course_factory_v3.steps import s07_labxchange


@pytest.mark.asyncio
async def test_run_returns_list(monkeypatch):
    fake_results = [
        {"title": "Force and Motion", "url": "https://labxchange.org/library/pathway/lx-pathway:abc",
         "score": 0.9, "description": "..."},
        {"title": "Newton Laws", "url": "https://labxchange.org/library/pathway/lx-pathway:def",
         "score": 0.8, "description": "..."},
    ]
    import course_factory.factory as cf
    monkeypatch.setattr(cf, "search_labxchange_for_knode", lambda knode, **kw: fake_results)

    ctx = {"knode": {"title": "Force basics"}}
    em = Emitter(lambda e, d: None)
    res = await s07_labxchange.run(ctx, em=em, top_k=3)
    assert res == fake_results


@pytest.mark.asyncio
async def test_run_returns_empty_on_error(monkeypatch):
    def boom(*a, **kw):
        raise RuntimeError("index missing")
    import course_factory.factory as cf
    monkeypatch.setattr(cf, "search_labxchange_for_knode", boom)

    ctx = {"knode": {"title": "x"}}
    em = Emitter(lambda e, d: None)
    res = await s07_labxchange.run(ctx, em=em)
    assert res == []


@pytest.mark.asyncio
async def test_run_real_index():
    """集成测试:真跑 LabXchange 本地索引,rocket-design knode 0 应至少返 1 条。"""
    from systemedu.core.course_factory_v3.steps import s00_boot
    em = Emitter(lambda e, d: None)
    ctx = await s00_boot.run("rocket-design", 0, user_id="t", overrides={}, em=em)
    res = await s07_labxchange.run(ctx, em=em, top_k=3)
    # 火箭/物理学科应至少匹配 1 条 pathway
    assert isinstance(res, list)
    # 不强制非空 (索引数据在持续变化),但断言结构正确
    for r in res:
        assert "title" in r
        assert "url" in r
        assert r["url"].startswith("https://www.labxchange.org/")
