"""Tests for ObjectFactory (C方案): SnapshotRenderer, CandidateValidator,
CandidateGenerator (mocked LLM), RegistryPromoter, ObjectFactory pipeline."""

import json
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from systemedu.agents.builtin.gameagent.object_factory.candidate_validator import (
    CandidateValidator,
    ValidationReport,
)
from systemedu.agents.builtin.gameagent.object_factory.snapshot_renderer import (
    SnapshotRenderer,
)
from systemedu.agents.builtin.gameagent.objects import ObjectRegistry


# ---------------------------------------------------------------------------
# Fixtures / helpers
# ---------------------------------------------------------------------------

def make_staging_dict(
    object_key: str = "test_obj.basic",
    must_have: list | None = None,
    labelable: list | None = None,
    extra_meta: dict | None = None,
    extra_shapes: list | None = None,
    extra_anchors: list | None = None,
    status: str = "candidate",
    score: float = 0.9,
) -> dict:
    """Build a minimal valid staging dict for testing."""
    must_have = must_have or ["body", "head"]
    labelable = labelable or ["body", "head", "arm"]

    shapes = [
        {"type": "rect", "id": "body_rect", "part_id": "body",
         "x": 200, "y": 100, "w": 100, "h": 200,
         "fill": "#B0BEC5", "stroke": "#78909C", "stroke_width": 1.5, "opacity": 1.0, "rx": 4},
        {"type": "ellipse", "id": "head_ellipse", "part_id": "head",
         "cx": 250, "cy": 80, "rx": 40, "ry": 40,
         "fill": "#FFCCBC", "stroke": "#FFAB91", "stroke_width": 1.5, "opacity": 1.0},
        {"type": "rect", "id": "arm_left", "part_id": "arm",
         "x": 150, "y": 110, "w": 40, "h": 100,
         "fill": "#B0BEC5", "stroke": "#78909C", "stroke_width": 1.0, "opacity": 1.0, "rx": 2},
    ]
    if extra_shapes:
        shapes.extend(extra_shapes)

    anchors = [
        {"part_id": "body", "x": 50.0, "y": 45.0},
        {"part_id": "head", "x": 50.0, "y": 15.0},
        {"part_id": "arm",  "x": 30.0, "y": 35.0},
    ]
    if extra_anchors:
        anchors.extend(extra_anchors)

    rendered_parts = list({s["part_id"] for s in shapes if s.get("part_id")})

    meta = {
        "must_have": must_have,
        "optional": [],
        "labelable": labelable,
        "parts": {
            pid: {"label_zh": pid, "label_en": pid, "desc_brief": "", "hint": ""}
            for pid in must_have + labelable
        },
    }
    if extra_meta:
        meta.update(extra_meta)

    return {
        "object_key": object_key,
        "base_family": "",
        "view": "side",
        "status": status,
        "generated_at": "2026-03-20T10:00:00",
        "validation_score": score,
        "validation_errors": [],
        "meta": meta,
        "render_spec": {
            "viewbox": "0 0 560 420",
            "shapes": shapes,
            "anchors": anchors,
            "rendered_parts": rendered_parts,
        },
    }


# ---------------------------------------------------------------------------
# SnapshotRenderer tests
# ---------------------------------------------------------------------------

class TestSnapshotRenderer:
    def setup_method(self):
        self.renderer = SnapshotRenderer()

    def _get_rocket_rs(self):
        return ObjectRegistry.build("rocket.basic")

    def test_render_normal_returns_svg_string(self):
        rs = self._get_rocket_rs()
        svg = self.renderer.render_normal(rs)
        assert svg.startswith("<svg")
        assert svg.endswith("</svg>")
        # viewBox should match the RenderSpec's viewbox field
        assert f'viewBox="{rs.viewbox}"' in svg

    def test_render_normal_contains_shapes(self):
        rs = self._get_rocket_rs()
        svg = self.renderer.render_normal(rs)
        # High-fidelity objects use body_svg (path/ellipse etc.); legacy use shapes
        has_content = ("<rect" in svg or "<polygon" in svg or "<path" in svg
                       or "<ellipse" in svg or "<line" in svg)
        assert has_content

    def test_render_normal_svg_length_reasonable(self):
        rs = self._get_rocket_rs()
        svg = self.renderer.render_normal(rs)
        # Should produce non-trivial SVG
        assert len(svg) > 500

    def test_render_highlighted_returns_svg(self):
        rs = self._get_rocket_rs()
        svg = self.renderer.render_highlighted(rs, ["nose_cone", "engine_nozzle"])
        assert "<svg" in svg
        assert "filter" in svg   # highlight filter added

    def test_render_highlighted_empty_parts(self):
        rs = self._get_rocket_rs()
        svg = self.renderer.render_highlighted(rs, [])
        assert "<svg" in svg

    def test_render_with_anchors_returns_svg(self):
        rs = self._get_rocket_rs()
        svg = self.renderer.render_with_anchors(rs)
        assert "<svg" in svg
        assert "<circle" in svg  # anchor dots

    def test_render_with_anchors_has_dot_per_anchor(self):
        rs = self._get_rocket_rs()
        svg = self.renderer.render_with_anchors(rs)
        circle_count = svg.count("<circle")
        assert circle_count == len(rs.anchors)

    def test_render_rect_shape(self):
        from systemedu.agents.builtin.gameagent.object_spec import LabelAnchor, RectShape, RenderSpec
        rs = RenderSpec(
            object_key="test",
            viewbox="0 0 200 100",
            shapes=[RectShape(id="r1", part_id="body", x=10, y=10, w=80, h=50, fill="#ff0000")],
            anchors=[LabelAnchor(part_id="body", x=50, y=50)],
            rendered_parts=["body"],
        )
        svg = self.renderer.render_normal(rs)
        assert 'id="r1"' in svg
        assert 'fill="#ff0000"' in svg

    def test_render_ellipse_shape(self):
        from systemedu.agents.builtin.gameagent.object_spec import EllipseShape, LabelAnchor, RenderSpec
        rs = RenderSpec(
            object_key="test",
            viewbox="0 0 200 200",
            shapes=[EllipseShape(id="e1", part_id="head", cx=100, cy=100, rx=50, ry=40, fill="#00ff00")],
            anchors=[LabelAnchor(part_id="head", x=50, y=50)],
            rendered_parts=["head"],
        )
        svg = self.renderer.render_normal(rs)
        assert "<ellipse" in svg
        assert 'fill="#00ff00"' in svg

    def test_render_polygon_shape(self):
        from systemedu.agents.builtin.gameagent.object_spec import LabelAnchor, PolygonShape, RenderSpec
        rs = RenderSpec(
            object_key="test",
            viewbox="0 0 200 200",
            shapes=[PolygonShape(id="p1", part_id="fin", points=[(100, 10), (150, 90), (50, 90)], fill="#0000ff")],
            anchors=[LabelAnchor(part_id="fin", x=50, y=50)],
            rendered_parts=["fin"],
        )
        svg = self.renderer.render_normal(rs)
        assert "<polygon" in svg
        assert "100" in svg  # x coordinate present (may be 100 or 100.0)

    def test_render_line_shape(self):
        from systemedu.agents.builtin.gameagent.object_spec import LabelAnchor, LineShape, RenderSpec
        rs = RenderSpec(
            object_key="test",
            viewbox="0 0 200 200",
            shapes=[LineShape(id="l1", part_id=None, x1=10, y1=10, x2=190, y2=190, stroke="#333333")],
            anchors=[],
            rendered_parts=[],
        )
        svg = self.renderer.render_normal(rs)
        assert "<line" in svg

    def test_render_path_shape(self):
        from systemedu.agents.builtin.gameagent.object_spec import LabelAnchor, PathShape, RenderSpec
        rs = RenderSpec(
            object_key="test",
            viewbox="0 0 200 200",
            shapes=[PathShape(id="path1", part_id="curve", d="M 10 10 Q 100 100 190 10", stroke="#ff0000")],
            anchors=[LabelAnchor(part_id="curve", x=50, y=30)],
            rendered_parts=["curve"],
        )
        svg = self.renderer.render_normal(rs)
        assert "<path" in svg
        assert "M 10 10" in svg

    def test_smoke_test_all_registry_objects(self):
        """SnapshotRenderer works for all production objects."""
        renderer = SnapshotRenderer()
        for key in ObjectRegistry.supported_keys():
            rs = ObjectRegistry.build(key)
            svg = renderer.render_normal(rs)
            assert len(svg) > 100, f"SVG too short for {key}"
            assert "<svg" in svg


# ---------------------------------------------------------------------------
# CandidateValidator tests
# ---------------------------------------------------------------------------

class TestCandidateValidator:
    def setup_method(self):
        self.v = CandidateValidator()

    def test_valid_candidate_passes(self):
        candidate = make_staging_dict()
        report = self.v.validate(candidate)
        assert report.passed
        assert report.score > 0.5

    def test_missing_must_have_part_fails(self):
        """A must_have part not in rendered_parts fails geometry check."""
        candidate = make_staging_dict(must_have=["body", "head", "legs"])
        # legs is in must_have but not in shapes/rendered_parts
        report = self.v.validate(candidate)
        assert not report.passed
        assert any("legs" in e for e in report.errors)

    def test_too_many_shapes_fails(self):
        """More than 60 shapes triggers error."""
        extra = [
            {"type": "rect", "id": f"extra_{i}", "part_id": None,
             "x": 10, "y": 10, "w": 5, "h": 5,
             "fill": "#aaa", "stroke": None, "stroke_width": 1.0, "opacity": 1.0, "rx": 0}
            for i in range(60)
        ]
        candidate = make_staging_dict(extra_shapes=extra)
        report = self.v.validate(candidate)
        assert not report.passed
        assert any("shapes" in e.lower() for e in report.errors)

    def test_too_few_anchors_fails(self):
        """Fewer than 3 anchors fails semantic check."""
        candidate = make_staging_dict()
        candidate["render_spec"]["anchors"] = [
            {"part_id": "body", "x": 50, "y": 50}
        ]
        report = self.v.validate(candidate)
        assert not report.passed
        assert any("3" in e for e in report.errors)

    def test_anchor_out_of_range_fails(self):
        """Anchor with x > 100 fails geometry check."""
        candidate = make_staging_dict()
        candidate["render_spec"]["anchors"][0]["x"] = 150  # invalid
        report = self.v.validate(candidate)
        assert not report.passed
        assert any("150" in e or "range" in e.lower() for e in report.errors)

    def test_invalid_part_id_format_fails(self):
        """Part ID with uppercase or spaces fails semantic check."""
        candidate = make_staging_dict()
        # Add a shape with invalid part_id
        candidate["render_spec"]["shapes"].append({
            "type": "rect", "id": "bad_part", "part_id": "BadPart",
            "x": 100, "y": 100, "w": 30, "h": 30,
            "fill": "#aaa", "stroke": None, "stroke_width": 1.0, "opacity": 1.0, "rx": 0
        })
        candidate["render_spec"]["rendered_parts"].append("BadPart")
        report = self.v.validate(candidate)
        assert not report.passed
        assert any("BadPart" in e for e in report.errors)

    def test_forbidden_part_id_word_fails(self):
        """Part ID containing 'background' fails semantic check."""
        candidate = make_staging_dict()
        candidate["render_spec"]["shapes"].append({
            "type": "rect", "id": "bg", "part_id": "background_fill",
            "x": 0, "y": 0, "w": 560, "h": 420,
            "fill": "#eee", "stroke": None, "stroke_width": 1.0, "opacity": 1.0, "rx": 0
        })
        candidate["render_spec"]["rendered_parts"].append("background_fill")
        report = self.v.validate(candidate)
        assert not report.passed
        assert any("background" in e for e in report.errors)

    def test_path_d_too_long_fails(self):
        """Path shape with d > 300 chars fails style check."""
        long_d = "M 10 10 " + " ".join(f"L {i} {i * 2}" for i in range(50))  # >> 300 chars
        candidate = make_staging_dict()
        candidate["render_spec"]["shapes"].append({
            "type": "path", "id": "path_long", "part_id": None,
            "d": long_d, "fill": "none", "stroke": "#333", "stroke_width": 1.0, "opacity": 1.0
        })
        report = self.v.validate(candidate)
        assert not report.passed
        assert any("path_long" in e or "300" in e for e in report.errors)

    def test_too_many_path_shapes_fails(self):
        """Path shapes > 60% of total fails style check."""
        candidate = make_staging_dict()
        # Add 10 more path shapes to dominate (3 existing shapes + 10 paths = 76% path)
        for i in range(10):
            candidate["render_spec"]["shapes"].append({
                "type": "path", "id": f"p_{i}", "part_id": None,
                "d": f"M {i*5} 10 L {i*5+4} 20",
                "fill": "none", "stroke": "#333", "stroke_width": 1.0, "opacity": 1.0
            })
        report = self.v.validate(candidate)
        assert not report.passed
        assert any("path" in e.lower() for e in report.errors)

    def test_anchor_part_not_in_rendered_fails(self):
        """Anchor part_id not in rendered_parts fails semantic check."""
        candidate = make_staging_dict()
        candidate["render_spec"]["anchors"].append(
            {"part_id": "nonexistent_part", "x": 50, "y": 50}
        )
        report = self.v.validate(candidate)
        assert not report.passed
        assert any("nonexistent_part" in e for e in report.errors)

    def test_validation_report_has_score(self):
        """ValidationReport always has a numeric score 0-1."""
        candidate = make_staging_dict()
        report = self.v.validate(candidate)
        assert 0.0 <= report.score <= 1.0

    def test_validation_report_structure(self):
        """ValidationReport has expected fields."""
        candidate = make_staging_dict()
        report = self.v.validate(candidate)
        assert isinstance(report, ValidationReport)
        assert isinstance(report.passed, bool)
        assert isinstance(report.score, float)
        assert isinstance(report.errors, list)
        assert isinstance(report.warnings, list)


# ---------------------------------------------------------------------------
# CandidateGenerator tests (mocked LLM)
# ---------------------------------------------------------------------------

class TestCandidateGenerator:
    def _make_semantic_response(self) -> str:
        return json.dumps({
            "must_have": ["hull", "periscope", "propeller"],
            "optional": ["torpedo_tube"],
            "labelable": ["hull", "periscope", "propeller"],
            "parts": {
                "hull": {"label_zh": "艇身", "label_en": "Hull", "desc_brief": "主体结构", "hint": "为何是流线型？"},
                "periscope": {"label_zh": "潜望镜", "label_en": "Periscope", "desc_brief": "水下观察用", "hint": ""},
                "propeller": {"label_zh": "螺旋桨", "label_en": "Propeller", "desc_brief": "提供推力", "hint": ""},
            }
        })

    def _make_geometry_response(self) -> str:
        return json.dumps({
            "shapes": [
                {"type": "ellipse", "id": "hull_ellipse", "part_id": "hull",
                 "cx": 280, "cy": 250, "rx": 180, "ry": 60,
                 "fill": "#546E7A", "stroke": "#37474F", "stroke_width": 2.0, "opacity": 1.0},
                {"type": "rect", "id": "periscope_rect", "part_id": "periscope",
                 "x": 250, "y": 130, "w": 20, "h": 100,
                 "fill": "#78909C", "stroke": "#546E7A", "stroke_width": 1.5, "opacity": 1.0, "rx": 2},
                {"type": "polygon", "id": "propeller_poly", "part_id": "propeller",
                 "points": [[430, 240], [460, 220], [460, 260]],
                 "fill": "#B0BEC5", "stroke": "#78909C", "stroke_width": 1.5, "opacity": 1.0},
            ],
            "anchors": [
                {"part_id": "hull", "x": 50.0, "y": 60.0},
                {"part_id": "periscope", "x": 48.0, "y": 28.0},
                {"part_id": "propeller", "x": 83.0, "y": 58.0},
            ]
        })

    @pytest.mark.asyncio
    async def test_generate_returns_candidate_result(self):
        from langchain_core.messages import AIMessage
        from systemedu.agents.builtin.gameagent.object_factory.candidate_generator import CandidateGenerator

        semantic_resp = self._make_semantic_response()
        geometry_resp = self._make_geometry_response()

        call_count = 0
        async def mock_invoke(inputs):
            nonlocal call_count
            call_count += 1
            content = semantic_resp if call_count == 1 else geometry_resp
            return {"messages": [AIMessage(content=content)]}

        mock_agent = MagicMock()
        mock_agent.ainvoke = mock_invoke

        with patch(
            "systemedu.agents.builtin.gameagent.object_factory.candidate_generator.create_deep_agent",
            return_value=mock_agent
        ):
            gen = CandidateGenerator(llm=MagicMock())
            result = await gen.generate("submarine.basic", "侧视图潜水艇", "")

        assert result is not None
        assert result.object_key == "submarine.basic"
        assert "hull" in result.spec_template.get("must_have", [])
        shapes = result.render_candidate.get("shapes", [])
        assert len(shapes) == 3

    @pytest.mark.asyncio
    async def test_generate_returns_none_on_invalid_json(self):
        from langchain_core.messages import AIMessage
        from systemedu.agents.builtin.gameagent.object_factory.candidate_generator import CandidateGenerator

        mock_agent = MagicMock()
        mock_agent.ainvoke = AsyncMock(return_value={
            "messages": [AIMessage(content="not valid json")]
        })

        with patch(
            "systemedu.agents.builtin.gameagent.object_factory.candidate_generator.create_deep_agent",
            return_value=mock_agent
        ):
            gen = CandidateGenerator(llm=MagicMock())
            result = await gen.generate("test.obj", "test", "")

        assert result is None

    @pytest.mark.asyncio
    async def test_generate_strips_markdown_fences(self):
        from langchain_core.messages import AIMessage
        from systemedu.agents.builtin.gameagent.object_factory.candidate_generator import CandidateGenerator

        semantic_resp = f"```json\n{self._make_semantic_response()}\n```"
        geometry_resp = f"```json\n{self._make_geometry_response()}\n```"

        call_count = 0
        async def mock_invoke(inputs):
            nonlocal call_count
            call_count += 1
            content = semantic_resp if call_count == 1 else geometry_resp
            return {"messages": [AIMessage(content=content)]}

        mock_agent = MagicMock()
        mock_agent.ainvoke = mock_invoke

        with patch(
            "systemedu.agents.builtin.gameagent.object_factory.candidate_generator.create_deep_agent",
            return_value=mock_agent
        ):
            gen = CandidateGenerator(llm=MagicMock())
            result = await gen.generate("submarine.basic", "侧视图潜水艇", "")

        assert result is not None
        assert result.object_key == "submarine.basic"

    def test_candidate_result_to_staging_dict(self):
        from systemedu.agents.builtin.gameagent.object_factory.candidate_generator import CandidateResult

        cr = CandidateResult(
            object_key="submarine.basic",
            base_family="",
            spec_template={"must_have": ["hull"], "optional": [], "labelable": ["hull"], "parts": {}},
            render_candidate={
                "shapes": [
                    {"type": "ellipse", "id": "hull_e", "part_id": "hull",
                     "cx": 280, "cy": 250, "rx": 180, "ry": 60,
                     "fill": "#546E7A", "stroke": None, "stroke_width": 1.0, "opacity": 1.0}
                ],
                "anchors": [{"part_id": "hull", "x": 50.0, "y": 60.0}]
            }
        )
        staging = cr.to_staging_dict()

        assert staging["object_key"] == "submarine.basic"
        assert staging["status"] == "candidate"
        assert "hull" in staging["render_spec"]["rendered_parts"]
        assert staging["render_spec"]["viewbox"] == "0 0 560 420"


# ---------------------------------------------------------------------------
# RegistryPromoter tests
# ---------------------------------------------------------------------------

class TestRegistryPromoter:
    def _make_approved_staging(self, tmp_dir: Path, object_key: str = "submarine.basic") -> Path:
        """Write an approved staging JSON to tmp_dir."""
        candidate = make_staging_dict(
            object_key=object_key,
            must_have=["hull", "periscope"],
            labelable=["hull", "periscope"],
            status="approved",
            score=0.9,
        )
        candidate["validation_score"] = 0.9
        # Ensure rendered_parts matches must_have
        candidate["render_spec"]["rendered_parts"] = ["hull", "periscope", "arm"]

        key_safe = object_key.replace(".", "_")
        path = tmp_dir / f"{key_safe}.json"
        path.write_text(json.dumps(candidate, indent=2), encoding="utf-8")
        return path

    def test_promote_generates_py_file(self, tmp_path):
        from systemedu.agents.builtin.gameagent.object_factory.registry_promoter import RegistryPromoter

        # Create a temp gameagent dir structure
        ga_dir = tmp_path / "gameagent"
        objects_dir = ga_dir / "objects"
        staging_dir = objects_dir / "staging"
        objects_dir.mkdir(parents=True)
        staging_dir.mkdir()

        # Copy real __init__.py content
        real_init = Path(__file__).parent.parent / "src/systemedu/agents/builtin/gameagent/objects/__init__.py"
        init_content = real_init.read_text(encoding="utf-8")
        (objects_dir / "__init__.py").write_text(init_content, encoding="utf-8")

        staging_path = self._make_approved_staging(staging_dir)

        promoter = RegistryPromoter(gameagent_dir=ga_dir)
        result_path = promoter.promote(staging_path)

        assert result_path.exists()
        assert result_path.suffix == ".py"
        content = result_path.read_text(encoding="utf-8")
        assert "def build(" in content
        assert "META = " in content
        assert "submarine.basic" in content

    def test_promote_updates_init_py(self, tmp_path):
        from systemedu.agents.builtin.gameagent.object_factory.registry_promoter import RegistryPromoter

        ga_dir = tmp_path / "gameagent"
        objects_dir = ga_dir / "objects"
        staging_dir = objects_dir / "staging"
        objects_dir.mkdir(parents=True)
        staging_dir.mkdir()

        real_init = Path(__file__).parent.parent / "src/systemedu/agents/builtin/gameagent/objects/__init__.py"
        init_content = real_init.read_text(encoding="utf-8")
        (objects_dir / "__init__.py").write_text(init_content, encoding="utf-8")

        staging_path = self._make_approved_staging(staging_dir)

        promoter = RegistryPromoter(gameagent_dir=ga_dir)
        promoter.promote(staging_path)

        updated_init = (objects_dir / "__init__.py").read_text(encoding="utf-8")
        assert "submarine_basic" in updated_init
        assert "submarine.basic" in updated_init

    def test_promote_rejects_non_approved(self, tmp_path):
        from systemedu.agents.builtin.gameagent.object_factory.registry_promoter import RegistryPromoter

        ga_dir = tmp_path / "gameagent"
        objects_dir = ga_dir / "objects"
        staging_dir = objects_dir / "staging"
        objects_dir.mkdir(parents=True)
        staging_dir.mkdir()

        (objects_dir / "__init__.py").write_text("# empty\n", encoding="utf-8")

        candidate = make_staging_dict(status="candidate", score=0.9)
        staging_path = staging_dir / "test.json"
        staging_path.write_text(json.dumps(candidate), encoding="utf-8")

        promoter = RegistryPromoter(gameagent_dir=ga_dir)
        with pytest.raises(ValueError, match="approved"):
            promoter.promote(staging_path)

    def test_promote_rejects_low_score(self, tmp_path):
        from systemedu.agents.builtin.gameagent.object_factory.registry_promoter import RegistryPromoter

        ga_dir = tmp_path / "gameagent"
        objects_dir = ga_dir / "objects"
        staging_dir = objects_dir / "staging"
        objects_dir.mkdir(parents=True)
        staging_dir.mkdir()

        (objects_dir / "__init__.py").write_text("# empty\n", encoding="utf-8")

        candidate = make_staging_dict(status="approved", score=0.5)
        staging_path = staging_dir / "test.json"
        staging_path.write_text(json.dumps(candidate), encoding="utf-8")

        promoter = RegistryPromoter(gameagent_dir=ga_dir)
        with pytest.raises(ValueError, match="0.8"):
            promoter.promote(staging_path)


# ---------------------------------------------------------------------------
# ObjectFactory pipeline tests (mocked LLM)
# ---------------------------------------------------------------------------

class TestObjectFactory:
    def _make_llm_responses(self):
        semantic = json.dumps({
            "must_have": ["hull", "periscope"],
            "optional": [],
            "labelable": ["hull", "periscope", "arm"],
            "parts": {
                "hull": {"label_zh": "艇身", "label_en": "Hull", "desc_brief": "主体", "hint": ""},
                "periscope": {"label_zh": "潜望镜", "label_en": "Periscope", "desc_brief": "观察", "hint": ""},
                "arm": {"label_zh": "臂", "label_en": "Arm", "desc_brief": "臂部", "hint": ""},
            }
        })
        geometry = json.dumps({
            "shapes": [
                {"type": "ellipse", "id": "hull_e", "part_id": "hull",
                 "cx": 280, "cy": 250, "rx": 180, "ry": 60,
                 "fill": "#546E7A", "stroke": "#37474F", "stroke_width": 2.0, "opacity": 1.0},
                {"type": "rect", "id": "periscope_r", "part_id": "periscope",
                 "x": 260, "y": 130, "w": 20, "h": 100,
                 "fill": "#78909C", "stroke": "#546E7A", "stroke_width": 1.5, "opacity": 1.0, "rx": 2},
                {"type": "rect", "id": "arm_r", "part_id": "arm",
                 "x": 80, "y": 230, "w": 40, "h": 30,
                 "fill": "#B0BEC5", "stroke": "#78909C", "stroke_width": 1.0, "opacity": 1.0, "rx": 1},
            ],
            "anchors": [
                {"part_id": "hull", "x": 50.0, "y": 60.0},
                {"part_id": "periscope", "x": 48.0, "y": 28.0},
                {"part_id": "arm", "x": 20.0, "y": 58.0},
            ]
        })
        return semantic, geometry

    @pytest.mark.asyncio
    async def test_run_pipeline_generates_staging_file(self, tmp_path):
        from langchain_core.messages import AIMessage
        from systemedu.agents.builtin.gameagent.object_factory import ObjectFactory

        semantic, geometry = self._make_llm_responses()
        call_count = 0
        async def mock_invoke(inputs):
            nonlocal call_count
            call_count += 1
            return {"messages": [AIMessage(content=semantic if call_count == 1 else geometry)]}

        mock_agent = MagicMock()
        mock_agent.ainvoke = mock_invoke

        ga_dir = tmp_path / "gameagent"
        objects_dir = ga_dir / "objects"
        staging_dir = objects_dir / "staging"
        objects_dir.mkdir(parents=True)
        staging_dir.mkdir()
        (objects_dir / "__init__.py").write_text("# empty\n")

        with patch(
            "systemedu.agents.builtin.gameagent.object_factory.candidate_generator.create_deep_agent",
            return_value=mock_agent,
        ):
            factory = ObjectFactory(llm=MagicMock(), gameagent_dir=ga_dir)
            staging_path, report = await factory.run_pipeline(
                "submarine.basic", "侧视图潜水艇", auto_promote=False
            )

        assert staging_path is not None
        assert staging_path.exists()
        assert isinstance(report, ValidationReport)

    @pytest.mark.asyncio
    async def test_run_pipeline_returns_none_on_llm_failure(self, tmp_path):
        from langchain_core.messages import AIMessage
        from systemedu.agents.builtin.gameagent.object_factory import ObjectFactory

        mock_agent = MagicMock()
        mock_agent.ainvoke = AsyncMock(return_value={"messages": [AIMessage(content="invalid json")]})

        ga_dir = tmp_path / "gameagent"
        objects_dir = ga_dir / "objects"
        staging_dir = objects_dir / "staging"
        objects_dir.mkdir(parents=True)
        staging_dir.mkdir()
        (objects_dir / "__init__.py").write_text("# empty\n")

        with patch(
            "systemedu.agents.builtin.gameagent.object_factory.candidate_generator.create_deep_agent",
            return_value=mock_agent,
        ):
            factory = ObjectFactory(llm=MagicMock(), gameagent_dir=ga_dir)
            staging_path, report = await factory.run_pipeline("bad.obj", "bad", auto_promote=False)

        assert staging_path is None
        assert not report.passed

    @pytest.mark.asyncio
    async def test_run_pipeline_staging_json_content(self, tmp_path):
        from langchain_core.messages import AIMessage
        from systemedu.agents.builtin.gameagent.object_factory import ObjectFactory

        semantic, geometry = self._make_llm_responses()
        call_count = 0
        async def mock_invoke(inputs):
            nonlocal call_count
            call_count += 1
            return {"messages": [AIMessage(content=semantic if call_count == 1 else geometry)]}

        mock_agent = MagicMock()
        mock_agent.ainvoke = mock_invoke

        ga_dir = tmp_path / "gameagent"
        objects_dir = ga_dir / "objects"
        staging_dir = objects_dir / "staging"
        objects_dir.mkdir(parents=True)
        staging_dir.mkdir()
        (objects_dir / "__init__.py").write_text("# empty\n")

        with patch(
            "systemedu.agents.builtin.gameagent.object_factory.candidate_generator.create_deep_agent",
            return_value=mock_agent,
        ):
            factory = ObjectFactory(llm=MagicMock(), gameagent_dir=ga_dir)
            staging_path, report = await factory.run_pipeline(
                "submarine.basic", "侧视图潜水艇", auto_promote=False
            )

        assert staging_path is not None
        data = json.loads(staging_path.read_text(encoding="utf-8"))
        assert data["object_key"] == "submarine.basic"
        assert "validation_score" in data
        assert "status" in data
        assert data["render_spec"]["viewbox"] == "0 0 560 420"

    def test_validate_candidate_from_staging_dict(self):
        from systemedu.agents.builtin.gameagent.object_factory import ObjectFactory
        from systemedu.agents.builtin.gameagent.object_factory.candidate_generator import CandidateResult

        factory = ObjectFactory(llm=None)

        cr = CandidateResult(
            object_key="test.obj",
            base_family="",
            spec_template={
                "must_have": ["body", "head", "arm"],
                "optional": [],
                "labelable": ["body", "head", "arm"],
                "parts": {}
            },
            render_candidate={
                "shapes": [
                    {"type": "rect", "id": "body_r", "part_id": "body",
                     "x": 200, "y": 100, "w": 100, "h": 200,
                     "fill": "#aaa", "stroke": None, "stroke_width": 1.0, "opacity": 1.0, "rx": 0},
                    {"type": "ellipse", "id": "head_e", "part_id": "head",
                     "cx": 250, "cy": 80, "rx": 40, "ry": 40,
                     "fill": "#aaa", "stroke": None, "stroke_width": 1.0, "opacity": 1.0},
                    {"type": "rect", "id": "arm_r", "part_id": "arm",
                     "x": 150, "y": 110, "w": 40, "h": 100,
                     "fill": "#aaa", "stroke": None, "stroke_width": 1.0, "opacity": 1.0, "rx": 0},
                ],
                "anchors": [
                    {"part_id": "body", "x": 50.0, "y": 45.0},
                    {"part_id": "head", "x": 50.0, "y": 15.0},
                    {"part_id": "arm",  "x": 30.0, "y": 35.0},
                ]
            },
        )
        report = factory.validate_candidate(cr)
        assert isinstance(report, ValidationReport)
        assert report.passed


# ---------------------------------------------------------------------------
# Smoke test: SnapshotRenderer with real ObjectRegistry
# ---------------------------------------------------------------------------

def test_snapshot_renderer_smoke_rocket():
    """Can render rocket.basic as SVG without errors."""
    rs = ObjectRegistry.build("rocket.basic")
    renderer = SnapshotRenderer()
    svg = renderer.render_normal(rs)
    assert len(svg) > 200
    assert rs.viewbox in svg


def test_snapshot_renderer_smoke_with_anchors():
    """render_with_anchors produces more content (dots) than render_normal."""
    rs = ObjectRegistry.build("rocket.basic")
    renderer = SnapshotRenderer()
    svg_normal = renderer.render_normal(rs)
    svg_anchors = renderer.render_with_anchors(rs)
    assert len(svg_anchors) > len(svg_normal)


def test_snapshot_renderer_highlighted_contains_filter():
    """render_highlighted includes the highlight filter def."""
    rs = ObjectRegistry.build("cell.animal")
    renderer = SnapshotRenderer()
    svg = renderer.render_highlighted(rs, ["nucleus", "mitochondria_1"])
    assert "<defs>" in svg
    assert "highlight" in svg
