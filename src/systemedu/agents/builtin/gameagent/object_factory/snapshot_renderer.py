"""SnapshotRenderer: pure Python SVG renderer for RenderSpec objects.

No LLM required. Converts RenderSpec shapes to SVG strings.
Three rendering modes:
  - render_normal: plain object
  - render_highlighted: highlight specific parts
  - render_with_anchors: show anchor dot markers
"""

from __future__ import annotations

from systemedu.agents.builtin.gameagent.object_spec import (
    AnyShape,
    EllipseShape,
    LabelAnchor,
    LineShape,
    PathShape,
    PolygonShape,
    RectShape,
    RenderSpec,
)


def _shape_to_svg(shape: AnyShape, highlight: bool = False, highlight_color: str = "#FFD54F") -> str:
    """Convert a single shape to an SVG element string."""
    extra_style = ""
    if highlight and shape.part_id:
        extra_style = f' filter="url(#highlight)"'

    if isinstance(shape, RectShape):
        stroke_attr = ""
        if shape.stroke:
            stroke_attr = f' stroke="{shape.stroke}" stroke-width="{shape.stroke_width}"'
        rx_attr = f' rx="{shape.rx}"' if shape.rx else ""
        opacity_attr = f' opacity="{shape.opacity}"' if shape.opacity != 1.0 else ""
        fill = highlight_color if highlight and shape.part_id else shape.fill
        return (
            f'<rect id="{shape.id}" x="{shape.x}" y="{shape.y}" '
            f'width="{shape.w}" height="{shape.h}"{rx_attr} '
            f'fill="{fill}"{stroke_attr}{opacity_attr}{extra_style}/>'
        )

    if isinstance(shape, EllipseShape):
        stroke_attr = ""
        if shape.stroke:
            stroke_attr = f' stroke="{shape.stroke}" stroke-width="{shape.stroke_width}"'
        opacity_attr = f' opacity="{shape.opacity}"' if shape.opacity != 1.0 else ""
        fill = highlight_color if highlight and shape.part_id else shape.fill
        return (
            f'<ellipse id="{shape.id}" cx="{shape.cx}" cy="{shape.cy}" '
            f'rx="{shape.rx}" ry="{shape.ry}" '
            f'fill="{fill}"{stroke_attr}{opacity_attr}{extra_style}/>'
        )

    if isinstance(shape, PolygonShape):
        pts = " ".join(f"{x},{y}" for x, y in shape.points)
        stroke_attr = ""
        if shape.stroke:
            stroke_attr = f' stroke="{shape.stroke}" stroke-width="{shape.stroke_width}"'
        opacity_attr = f' opacity="{shape.opacity}"' if shape.opacity != 1.0 else ""
        fill = highlight_color if highlight and shape.part_id else shape.fill
        return (
            f'<polygon id="{shape.id}" points="{pts}" '
            f'fill="{fill}"{stroke_attr}{opacity_attr}{extra_style}/>'
        )

    if isinstance(shape, PathShape):
        opacity_attr = f' opacity="{shape.opacity}"' if shape.opacity != 1.0 else ""
        stroke = highlight_color if highlight and shape.part_id else shape.stroke
        return (
            f'<path id="{shape.id}" d="{shape.d}" '
            f'fill="{shape.fill}" stroke="{stroke}" '
            f'stroke-width="{shape.stroke_width}"{opacity_attr}{extra_style}/>'
        )

    if isinstance(shape, LineShape):
        opacity_attr = f' opacity="{shape.opacity}"' if shape.opacity != 1.0 else ""
        stroke = highlight_color if highlight and shape.part_id else shape.stroke
        return (
            f'<line id="{shape.id}" x1="{shape.x1}" y1="{shape.y1}" '
            f'x2="{shape.x2}" y2="{shape.y2}" '
            f'stroke="{stroke}" stroke-width="{shape.stroke_width}"{opacity_attr}{extra_style}/>'
        )

    raise TypeError(f"Unknown shape type: {type(shape)}")


def _parse_viewbox(viewbox: str) -> tuple[float, float, float, float]:
    """Parse 'x y w h' viewbox string."""
    parts = viewbox.split()
    return float(parts[0]), float(parts[1]), float(parts[2]), float(parts[3])


def _anchor_to_svg(anchor: LabelAnchor, vw: float, vh: float) -> str:
    """Convert a LabelAnchor to an SVG circle dot marker."""
    px = anchor.x * vw / 100.0
    py = anchor.y * vh / 100.0
    return (
        f'<circle cx="{px:.1f}" cy="{py:.1f}" r="5" '
        f'fill="#FF5252" stroke="#fff" stroke-width="1.5" opacity="0.9">'
        f'<title>{anchor.part_id}</title></circle>'
    )


class SnapshotRenderer:
    """Pure Python SVG renderer for RenderSpec objects."""

    def render_normal(self, render_spec: RenderSpec) -> str:
        """Render object as plain SVG."""
        _, _, vw, vh = _parse_viewbox(render_spec.viewbox)
        shapes_svg = "\n  ".join(_shape_to_svg(s) for s in render_spec.shapes)
        return (
            f'<svg xmlns="http://www.w3.org/2000/svg" '
            f'viewBox="{render_spec.viewbox}" '
            f'width="{vw:.0f}" height="{vh:.0f}">\n'
            f'  {shapes_svg}\n'
            f'</svg>'
        )

    def render_highlighted(self, render_spec: RenderSpec, parts: list[str]) -> str:
        """Render object with specified parts highlighted in gold."""
        parts_set = set(parts)
        _, _, vw, vh = _parse_viewbox(render_spec.viewbox)

        defs = (
            '<defs>'
            '<filter id="highlight" x="-10%" y="-10%" width="120%" height="120%">'
            '<feFlood flood-color="#FFD54F" flood-opacity="0.5" result="color"/>'
            '<feComposite in="color" in2="SourceGraphic" operator="atop"/>'
            '</filter>'
            '</defs>'
        )

        shapes_svg = "\n  ".join(
            _shape_to_svg(s, highlight=(s.part_id in parts_set))
            for s in render_spec.shapes
        )
        return (
            f'<svg xmlns="http://www.w3.org/2000/svg" '
            f'viewBox="{render_spec.viewbox}" '
            f'width="{vw:.0f}" height="{vh:.0f}">\n'
            f'  {defs}\n'
            f'  {shapes_svg}\n'
            f'</svg>'
        )

    def render_with_anchors(self, render_spec: RenderSpec) -> str:
        """Render object with anchor dot markers overlaid."""
        _, _, vw, vh = _parse_viewbox(render_spec.viewbox)
        shapes_svg = "\n  ".join(_shape_to_svg(s) for s in render_spec.shapes)
        anchors_svg = "\n  ".join(
            _anchor_to_svg(a, vw, vh) for a in render_spec.anchors
        )
        return (
            f'<svg xmlns="http://www.w3.org/2000/svg" '
            f'viewBox="{render_spec.viewbox}" '
            f'width="{vw:.0f}" height="{vh:.0f}">\n'
            f'  {shapes_svg}\n'
            f'  {anchors_svg}\n'
            f'</svg>'
        )
