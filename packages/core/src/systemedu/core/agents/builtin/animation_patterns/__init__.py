"""Parametric animation pattern library.

Each pattern is a self-contained HTML+JS animation driven by physics equations.
LLM only extracts parameters; the animation code itself is human-reviewed.

Available patterns:
  relative_motion   — two objects moving toward/away from each other
  wave_oscillation  — spring/pendulum/wave oscillation
  crank_slider      — crankshaft-piston mechanical motion
  projectile        — parabolic projectile / rocket trajectory
  formula_reveal    — step-by-step formula derivation (math-focused)
"""

from .registry import PATTERN_REGISTRY, render_pattern

__all__ = ["PATTERN_REGISTRY", "render_pattern"]
