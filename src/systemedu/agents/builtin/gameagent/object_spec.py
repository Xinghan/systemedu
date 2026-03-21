"""ObjectSpec and RenderSpec Pydantic models for structured object rendering.

Pipeline:
  LLM -> ObjectSpec (what to show, which parts to label)
  Python Registry -> RenderSpec (exact shapes + anchors, deterministic)
  Validator -> checks render completeness + label legality
  Renderer -> injects RenderSpec into HTML template
"""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Strongly-typed Shape models (no attrs: dict garbage-bin)
# ---------------------------------------------------------------------------

class RectShape(BaseModel):
    type: Literal["rect"] = "rect"
    id: str
    part_id: str | None = None
    x: float
    y: float
    w: float
    h: float
    rx: float = 0           # corner radius
    fill: str = "#cccccc"
    stroke: str | None = None
    stroke_width: float = 1.0
    opacity: float = 1.0


class EllipseShape(BaseModel):
    type: Literal["ellipse"] = "ellipse"
    id: str
    part_id: str | None = None
    cx: float
    cy: float
    rx: float
    ry: float
    fill: str = "#cccccc"
    stroke: str | None = None
    stroke_width: float = 1.0
    opacity: float = 1.0


class PolygonShape(BaseModel):
    type: Literal["polygon"] = "polygon"
    id: str
    part_id: str | None = None
    points: list[tuple[float, float]]   # list of (x, y)
    fill: str = "#cccccc"
    stroke: str | None = None
    stroke_width: float = 1.0
    opacity: float = 1.0


class PathShape(BaseModel):
    type: Literal["path"] = "path"
    id: str
    part_id: str | None = None
    d: str                  # SVG path data string
    fill: str = "none"
    stroke: str = "#cccccc"
    stroke_width: float = 2.0
    opacity: float = 1.0


class LineShape(BaseModel):
    type: Literal["line"] = "line"
    id: str
    part_id: str | None = None
    x1: float
    y1: float
    x2: float
    y2: float
    stroke: str = "#cccccc"
    stroke_width: float = 2.0
    opacity: float = 1.0


# Discriminated union - renderer can switch on .type safely
AnyShape = Annotated[
    RectShape | EllipseShape | PolygonShape | PathShape | LineShape,
    Field(discriminator="type"),
]


# ---------------------------------------------------------------------------
# Label anchor: where to place the interactive dot marker
# ---------------------------------------------------------------------------

class LabelAnchor(BaseModel):
    part_id: str
    x: float    # percentage 0-100, relative to viewbox width
    y: float    # percentage 0-100, relative to viewbox height


# ---------------------------------------------------------------------------
# RenderSpec: produced by ObjectRegistry (Python, no LLM)
# ---------------------------------------------------------------------------

class RenderSpec(BaseModel):
    object_key: str             # e.g. "rocket.basic"
    viewbox: str = "0 0 560 420"
    shapes: list[AnyShape] = Field(default_factory=list)
    anchors: list[LabelAnchor]
    rendered_parts: list[str]   # part_ids actually drawn (for validator)
    # Optional high-fidelity raw SVG path (bypasses JS shapeToSVG renderer).
    # defs_svg: content for <defs> (gradients, filters, clipPaths)
    # body_svg: the full scene markup, rendered directly into #scene-group
    defs_svg: str = ""
    body_svg: str = ""


# ---------------------------------------------------------------------------
# ObjectSpec: produced by LLM
# LLM only picks object_key / view / which parts to label/highlight
# LLM does NOT produce coordinates, shapes, or descriptions
# ---------------------------------------------------------------------------

class ObjectSpec(BaseModel):
    object_key: str             # must be from SUPPORTED_OBJECTS whitelist
    view: str = "side"          # "side", "front", "cross_section", "top"
    variant: str | None = None  # "simplified", "organs", "grade3" etc.
    label_part_ids: list[str] = Field(default_factory=list)
    highlight_part_ids: list[str] = Field(default_factory=list)
    locale: str = "zh-CN"
    # LLM may NOT set descriptions - those come from Registry/KB
    custom_labels: dict[str, str] = Field(default_factory=dict)  # override display name only


# ---------------------------------------------------------------------------
# MissingObjectRequest: emitted by ObjectResolver when a key is not in Registry
# Consumed by C pipeline (ObjectFactory) for async backfill
# ---------------------------------------------------------------------------

class MissingObjectRequest(BaseModel):
    object_key: str                     # key that was requested but not in Registry
    family: str                         # e.g. "rocket" (object_key.split(".")[0])
    view: str = "side"
    topic: str = ""                     # from GameSpec.topic, helps C pipeline understand purpose
    required_parts: list[str] = Field(default_factory=list)  # from ObjectSpec.label_part_ids
    preferred_mechanic: str = ""        # from GameSpec.mechanic
    fallback_used: str | None = None    # key B actually used for this request
    request_count: int = 1
