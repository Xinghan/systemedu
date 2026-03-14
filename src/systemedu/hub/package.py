"""Project packaging for Hub distribution (Phase 4 placeholder)."""

from pathlib import Path


def pack_project(project_dir: Path, output_path: Path | None = None) -> Path:
    """Pack a project directory into a .tar.gz archive.

    Phase 4 will implement full packaging.
    """
    raise NotImplementedError("Project packaging not yet implemented (Phase 4)")


def unpack_project(archive_path: Path, output_dir: Path) -> Path:
    """Unpack a project archive to a directory.

    Phase 4 will implement full unpacking.
    """
    raise NotImplementedError("Project unpacking not yet implemented (Phase 4)")
