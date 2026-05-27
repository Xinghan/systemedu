"""spec 036 T3.3 + T4.3: 跨项目聚合 + 推荐项目算法测试 (mock library client)."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest


@pytest.fixture(autouse=True)
def _setup_db(tmp_path, monkeypatch):
    db_file = tmp_path / "student.db"
    monkeypatch.setenv("STUDENT_DB_URL", f"sqlite:///{db_file}")
    from systemedu.student import db as student_db
    student_db.reset_engine_for_tests()
    student_db.init_db()
    with student_db.get_session() as s:
        s.add(student_db.User(id="user-1", username="u1", password_hash="x"))
        s.commit()
    yield
    student_db.reset_engine_for_tests()


# 测试用 stub library client
class _StubLib:
    """模拟 library_proxy.client.get_library_client() 返回的 AsyncLibraryClient."""

    def __init__(self, projects=None, project_kts=None, platform=None):
        self._projects = projects or []
        self._project_kts = project_kts or {}
        self._platform = platform or {"schema_version": "1.0", "subjects": []}

    async def list_projects(self):
        return self._projects

    async def get_project_knowledge_tree(self, slug):
        if slug not in self._project_kts:
            raise FileNotFoundError(slug)
        return self._project_kts[slug]

    async def get_platform_knowledge_tree(self):
        return self._platform


# 构造一棵 mini platform tree
_PLATFORM = {
    "schema_version": "1.0",
    "subjects": [
        {
            "id": "math", "name_zh": "数学", "color": "#527B95",
            "nodes": [
                {"id": "math.algebra.linear_func", "name_zh": "一次函数", "name_en": "Linear",
                 "depth_level": "K7", "prerequisites": [], "description": ""},
                {"id": "math.algebra.piecewise_func", "name_zh": "分段函数", "name_en": "Piecewise",
                 "depth_level": "K9", "prerequisites": [], "description": ""},
                {"id": "math.stats.variance", "name_zh": "方差", "name_en": "Variance",
                 "depth_level": "K9", "prerequisites": [], "description": ""},
            ],
        },
        {
            "id": "cs", "name_zh": "计算机", "color": "#7AE0E8",
            "nodes": [
                {"id": "cs.prog.loop_for", "name_zh": "for 循环", "name_en": "For",
                 "depth_level": "K7", "prerequisites": [], "description": ""},
                {"id": "cs.prog.variable", "name_zh": "变量", "name_en": "Variable",
                 "depth_level": "K5", "prerequisites": [], "description": ""},
            ],
        },
    ],
}


def _make_proj_kt(lit_pairs):
    """[(node_id, [knode_id...])] → project knowledge-tree dict."""
    return {
        "lit_nodes": [
            {"node_id": nid, "lit_by": ks, "reason": ""}
            for nid, ks in lit_pairs
        ],
        "subjects_used": [],
        "missing_concepts": [],
    }


# ---------------------- compute_user_lit_nodes ----------------------

@pytest.mark.asyncio
async def test_aggregate_empty_user_returns_zero():
    from systemedu.student.catalog import user_lit

    stub = _StubLib(platform=_PLATFORM)
    with patch.object(user_lit, "get_library_client", return_value=stub):
        result = await user_lit.compute_user_lit_nodes("user-1")

    assert result["total_lit"] == 0
    assert result["total_platform_nodes"] == 5
    assert len(result["subjects_summary"]) == 2
    assert all(s["lit_count"] == 0 for s in result["subjects_summary"])


@pytest.mark.asyncio
async def test_aggregate_single_project():
    from systemedu.student.catalog import user_lit

    # 完成 purpleair M05 → 教 piecewise_func 和 linear_func
    user_lit.toggle_complete("user-1", "purpleair", "M05", action="complete")

    stub = _StubLib(
        platform=_PLATFORM,
        project_kts={
            "purpleair": _make_proj_kt([
                ("math.algebra.piecewise_func", ["M05"]),
                ("math.algebra.linear_func", ["M05"]),
                ("math.stats.variance", ["M07"]),  # M07 没完成 → 不应点亮
            ]),
        },
    )
    with patch.object(user_lit, "get_library_client", return_value=stub):
        result = await user_lit.compute_user_lit_nodes("user-1")

    assert result["total_lit"] == 2
    lit_ids = {n["node_id"] for n in result["lit_nodes"]}
    assert lit_ids == {"math.algebra.piecewise_func", "math.algebra.linear_func"}

    math_sum = next(s for s in result["subjects_summary"] if s["subject_id"] == "math")
    assert math_sum["lit_count"] == 2
    assert math_sum["total_count"] == 3


@pytest.mark.asyncio
async def test_aggregate_cross_project_dedup_with_sources():
    """同一 platform 节点被多项目教过, lit_by_projects 应该是 list 多项."""
    from systemedu.student.catalog import user_lit

    user_lit.toggle_complete("user-1", "purpleair", "M05", action="complete")
    user_lit.toggle_complete("user-1", "ai-ant", "M12", action="complete")

    stub = _StubLib(
        platform=_PLATFORM,
        project_kts={
            "purpleair": _make_proj_kt([
                ("math.algebra.linear_func", ["M05"]),
            ]),
            "ai-ant": _make_proj_kt([
                ("math.algebra.linear_func", ["M12"]),
                ("cs.prog.loop_for", ["M12"]),
            ]),
        },
    )
    with patch.object(user_lit, "get_library_client", return_value=stub):
        result = await user_lit.compute_user_lit_nodes("user-1")

    assert result["total_lit"] == 2  # 去重: linear_func 只算 1 个 platform 节点

    linear_entry = next(n for n in result["lit_nodes"] if n["node_id"] == "math.algebra.linear_func")
    sources = {p["slug"] for p in linear_entry["lit_by_projects"]}
    assert sources == {"purpleair", "ai-ant"}


@pytest.mark.asyncio
async def test_aggregate_undo_toggle_removes_lit():
    from systemedu.student.catalog import user_lit

    user_lit.toggle_complete("user-1", "purpleair", "M05", action="complete")
    stub = _StubLib(
        platform=_PLATFORM,
        project_kts={
            "purpleair": _make_proj_kt([("math.algebra.linear_func", ["M05"])]),
        },
    )
    with patch.object(user_lit, "get_library_client", return_value=stub):
        result = await user_lit.compute_user_lit_nodes("user-1")
    assert result["total_lit"] == 1

    # 撤销
    user_lit.toggle_complete("user-1", "purpleair", "M05", action="incomplete")
    with patch.object(user_lit, "get_library_client", return_value=stub):
        result = await user_lit.compute_user_lit_nodes("user-1")
    assert result["total_lit"] == 0


@pytest.mark.asyncio
async def test_aggregate_lib_failure_skips_project():
    from systemedu.student.catalog import user_lit

    user_lit.toggle_complete("user-1", "good-proj", "M01", action="complete")
    user_lit.toggle_complete("user-1", "bad-proj", "M01", action="complete")

    stub = _StubLib(
        platform=_PLATFORM,
        project_kts={
            "good-proj": _make_proj_kt([("cs.prog.variable", ["M01"])]),
            # bad-proj 不在 → get 抛 FileNotFoundError → 跳过
        },
    )
    with patch.object(user_lit, "get_library_client", return_value=stub):
        result = await user_lit.compute_user_lit_nodes("user-1")

    # good-proj 仍计入, bad-proj 被跳过 (不抛错)
    assert result["total_lit"] == 1


# ---------------------- recommend_next_projects ----------------------

class _Meta:
    def __init__(self, slug, title_zh="", cover=None, difficulty=3):
        self.slug = slug
        self.title_zh = title_zh
        self.title = title_zh or slug
        self.cover_image_path = cover
        self.difficulty = difficulty


@pytest.mark.asyncio
async def test_recommend_excludes_done_projects():
    from systemedu.student.catalog import user_lit

    # 用户完成 purpleair
    user_lit.toggle_complete("user-1", "purpleair", "M05", action="complete")

    stub = _StubLib(
        platform=_PLATFORM,
        projects=[_Meta("purpleair", "空气"), _Meta("ai-ant", "蚂蚁")],
        project_kts={
            "purpleair": _make_proj_kt([("math.algebra.linear_func", ["M05"])]),
            "ai-ant": _make_proj_kt([("cs.prog.loop_for", ["M01"])]),
        },
    )
    with patch.object(user_lit, "get_library_client", return_value=stub):
        result = await user_lit.recommend_next_projects("user-1", limit=3)

    slugs = [r["slug"] for r in result["recommendations"]]
    # purpleair 已做过 → 不推
    assert "purpleair" not in slugs
    assert "ai-ant" in slugs


@pytest.mark.asyncio
async def test_recommend_ranks_by_new_nodes_count():
    from systemedu.student.catalog import user_lit

    stub = _StubLib(
        platform=_PLATFORM,
        projects=[_Meta("small"), _Meta("big")],
        project_kts={
            "small": _make_proj_kt([("cs.prog.variable", ["M01"])]),  # 1 新节
            "big": _make_proj_kt([
                ("cs.prog.loop_for", ["M01"]),
                ("math.algebra.linear_func", ["M01"]),
                ("math.algebra.piecewise_func", ["M02"]),
            ]),  # 3 新节
        },
    )
    with patch.object(user_lit, "get_library_client", return_value=stub):
        result = await user_lit.recommend_next_projects("user-1", limit=3)

    recs = result["recommendations"]
    assert recs[0]["slug"] == "big"
    assert recs[0]["new_nodes_count"] == 3
    assert recs[1]["slug"] == "small"
    assert recs[1]["new_nodes_count"] == 1


@pytest.mark.asyncio
async def test_recommend_new_nodes_by_subject_breakdown():
    from systemedu.student.catalog import user_lit

    stub = _StubLib(
        platform=_PLATFORM,
        projects=[_Meta("mixed")],
        project_kts={
            "mixed": _make_proj_kt([
                ("math.algebra.linear_func", ["M01"]),
                ("math.algebra.piecewise_func", ["M02"]),
                ("cs.prog.loop_for", ["M03"]),
            ]),
        },
    )
    with patch.object(user_lit, "get_library_client", return_value=stub):
        result = await user_lit.recommend_next_projects("user-1", limit=3)

    assert len(result["recommendations"]) == 1
    rec = result["recommendations"][0]
    assert rec["new_nodes_subjects"] == {"math": 2, "cs": 1}


@pytest.mark.asyncio
async def test_recommend_zero_new_nodes_excluded():
    """如果项目能教的所有节点用户都已点亮, 不推."""
    from systemedu.student.catalog import user_lit

    # 用户已点亮 cs.prog.variable (做了 some-proj)
    user_lit.toggle_complete("user-1", "some-proj", "M01", action="complete")

    stub = _StubLib(
        platform=_PLATFORM,
        projects=[_Meta("dup-proj"), _Meta("some-proj")],
        project_kts={
            "some-proj": _make_proj_kt([("cs.prog.variable", ["M01"])]),
            "dup-proj": _make_proj_kt([("cs.prog.variable", ["M01"])]),  # 跟用户已点亮重叠 100%
        },
    )
    with patch.object(user_lit, "get_library_client", return_value=stub):
        result = await user_lit.recommend_next_projects("user-1", limit=3)

    slugs = [r["slug"] for r in result["recommendations"]]
    assert "dup-proj" not in slugs  # 0 新节点 → 不推
