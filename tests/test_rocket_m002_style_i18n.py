from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = {
    "animation": ROOT / "scripts" / "_regen_anim_rocket_m002_weight_scale.html",
    "game": ROOT / "scripts" / "_regen_game_rocket_m002_weight_lab.html",
    "diagram": ROOT / "scripts" / "_regen_diagram_rocket_m002_size_weight.html",
}
FORBIDDEN_COPIED_UI = (
    "KINETIC",
    "STATION",
    "MISSION CONTROL",
    "DASHBOARD",
    "TELEMETRY",
    "ANALYSIS",
    "SENSORS",
    "ARCHIVE",
    "MASS SORTING PROTOCOL",
    "SIZE AND WEIGHT ARE DIFFERENT",
)


def test_rocket_m002_artifacts_exist():
    missing = [str(path) for path in ARTIFACTS.values() if not path.exists()]
    assert not missing


def test_rocket_m002_uses_style_reference_without_copying_ui():
    for name, path in ARTIFACTS.items():
        html = path.read_text(encoding="utf-8")
        hits = [token for token in FORBIDDEN_COPIED_UI if token in html]
        assert not hits, f"{name} still contains copied reference UI text: {hits}"


def test_rocket_m002_defaults_to_chinese_and_has_language_toggle():
    for name, path in ARTIFACTS.items():
        html = path.read_text(encoding="utf-8")
        assert 'lang="zh-CN"' in html or "let lang='zh'" in html, name
        assert 'id="langBtn"' in html, name
        assert "中文" in html or "火箭" in html or "证据" in html, name
