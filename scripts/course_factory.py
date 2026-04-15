"""DEPRECATED shim — import from `course_factory` package instead.

This module was moved to the top-level `course_factory/` package on
2026-04-15 (spec 013-factory-extraction). Existing callers continue to
work via this shim but should migrate to `from course_factory import ...`.
"""
import warnings

warnings.warn(
    "scripts/course_factory.py is deprecated; import from course_factory instead",
    DeprecationWarning,
    stacklevel=2,
)

from course_factory import *  # noqa: F401, F403, E402
from course_factory.factory import *  # noqa: F401, F403, E402
