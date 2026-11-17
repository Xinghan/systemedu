"""Build the downloadable project deterministically, excluding caches."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

root = Path(__file__).resolve().parents[2]
source = root / "standalone-courses/transformer-workshop"
target = root / "packages/student-web/public/standalone/transformer-lab/attention-project.zip"
target.parent.mkdir(parents=True, exist_ok=True)
with ZipFile(target, "w", compression=ZIP_DEFLATED) as archive:
    for file in sorted(source.rglob("*")):
        if not file.is_file() or any(p in {"__pycache__", ".venv"} for p in file.parts) or file.suffix == ".pyc" or file.name == "lecture.md":
            continue
        entry = ZipInfo("attention-project/" + file.relative_to(source).as_posix(), date_time=(2026, 10, 22, 0, 0, 0))
        entry.compress_type = ZIP_DEFLATED
        entry.external_attr = 0o644 << 16
        archive.writestr(entry, file.read_bytes())
print(target, target.stat().st_size, "bytes")
