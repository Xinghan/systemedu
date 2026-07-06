"""Tutor safety layer (spec 043 P5 A6).

Output-side moderation of the tutor's final reply before it reaches the student.
The input side lives in `nodes/safety_gate.py` (pre-filters the student's
message); this package is the symmetric guard on what the tutor says back.
"""

from .output_filter import (
    SAFE_FALLBACK,
    OutputSafetyVerdict,
    check_output_safety,
)

__all__ = [
    "SAFE_FALLBACK",
    "OutputSafetyVerdict",
    "check_output_safety",
]
