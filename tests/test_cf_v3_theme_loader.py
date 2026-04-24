"""theme_loader 单元测试 — 解析 theme_style/themes.js 的 26 条主题。"""

from systemedu.course_factory_v3.theme_loader import (
    load_themes,
    pick_theme,
    themes_by_id,
    theme_block_for_prompt,
    DEFAULT_THEME_ID,
)


def test_load_themes_returns_26_entries():
    themes = load_themes()
    assert len(themes) == 26


def test_each_theme_has_required_fields():
    for t in load_themes():
        assert t.id, f"empty id"
        assert t.num, f"theme {t.id}: empty num"
        assert t.title, f"theme {t.id}: empty title"
        assert t.chinese, f"theme {t.id}: empty chinese"
        assert t.tagline, f"theme {t.id}: empty tagline"
        assert t.mascot, f"theme {t.id}: empty mascot"
        assert t.type_sample, f"theme {t.id}: empty type_sample"
        assert t.type_desc_title, f"theme {t.id}: empty type_desc_title"
        assert len(t.palette) == 5, f"theme {t.id}: palette len={len(t.palette)} expected 5"
        assert len(t.props) >= 2, f"theme {t.id}: props {t.props}"


def test_palette_entries_have_hex_and_name():
    for t in load_themes():
        for entry in t.palette:
            assert "hex" in entry and "name" in entry
            assert entry["hex"].startswith("oklch("), entry["hex"]


def test_themes_by_id_lookup():
    by_id = themes_by_id()
    assert "cs" in by_id
    assert "space" in by_id
    assert "agri" in by_id
    assert by_id["space"].title == "Starfield Port"


def test_pick_theme_by_keyword():
    assert pick_theme("rocket-design").id == "space"
    assert pick_theme("biology").id == "bio"
    assert pick_theme("AI Robotics").id == "ai"  # ai 在 robo 前命中
    assert pick_theme("computer science").id == "cs"
    assert pick_theme("chemistry experiment").id == "chem"


def test_pick_theme_direct_id():
    assert pick_theme("space").id == "space"
    assert pick_theme("agri").id == "agri"


def test_pick_theme_fallback_when_unknown():
    assert pick_theme("totally-unknown-xyz").id == DEFAULT_THEME_ID
    assert pick_theme(None).id == DEFAULT_THEME_ID
    assert pick_theme("").id == DEFAULT_THEME_ID


def test_prompt_block_contains_palette_hex():
    block = theme_block_for_prompt("space")
    assert "oklch(0.72 0.17 295)" in block  # ORBIT
    assert "ROCKET" in block
    assert "Starfield Port" in block
    assert "硬性规则" in block
    assert "0px 圆角" in block


def test_all_26_subject_ids_present():
    """与 SKILL/spec 中列出的 26 个学科 id 对齐。"""
    expected = {
        "cs", "bio", "space", "mech", "ai", "math", "med", "chem", "phys",
        "env", "robo", "elec", "astro", "geo", "ocean", "meteo", "paleo",
        "quant", "nuke", "neuro", "mat", "micro", "zoo", "bot", "arch", "agri",
    }
    actual = {t.id for t in load_themes()}
    assert actual == expected, f"missing={expected - actual}, extra={actual - expected}"
