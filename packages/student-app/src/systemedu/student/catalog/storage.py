"""spec 033: 学生本地项目存储 (~/.systemedu/student/users/<uid>/projects/<slug>/<version>/).

pull 时把 tarball 解压到本地, 学习时只读本地, 不再实时访问 library。
"""

from __future__ import annotations

import os
import shutil
import sys
import tarfile
from io import BytesIO
from pathlib import Path


def user_data_root() -> Path:
    """返回 ~/.systemedu/student/users/, 可被 STUDENT_USER_DATA_ROOT 覆盖 (测试用)."""
    override = os.environ.get("STUDENT_USER_DATA_ROOT")
    if override:
        return Path(override)
    return Path.home() / ".systemedu" / "student" / "users"


def project_local_dir(user_id: str, slug: str, version: str) -> Path:
    """返回该用户该项目该版本的本地目录路径 (不保证存在)."""
    return user_data_root() / user_id / "projects" / slug / version


def project_slug_dir(user_id: str, slug: str) -> Path:
    """返回该用户该项目的目录 (含各版本子目录)."""
    return user_data_root() / user_id / "projects" / slug


def extract_tarball_safely(data: bytes, target_dir: Path) -> Path:
    """把 tarball 解压到 target_dir, 安全过滤 (tar slip 防御).

    tarball 顶层是 `<slug>/`, 把它**展平**到 target_dir 下 (即 manifest.json 直接在
    target_dir 下, 而不是 target_dir/<slug>/manifest.json)。

    Returns:
        target_dir 本身, 解压后用户可直接 `target_dir/knodes/...` 访问内容。

    Raises:
        ValueError: tarball 不合法 (空 / 没有顶层目录 / 有越界路径)
    """
    target_dir.mkdir(parents=True, exist_ok=True)

    # Python 3.12+ tarfile filter='data' 拒绝越界路径 / 符号链接 / 不安全权限。
    # 旧版兜底: 手动检查 member 路径。
    use_data_filter = sys.version_info >= (3, 12)

    with tarfile.open(fileobj=BytesIO(data), mode="r:gz") as tar:
        # 找顶层目录
        members = tar.getmembers()
        if not members:
            raise ValueError("empty tarball")

        # 安全检查 + 找 top-level
        top_dirs: set[str] = set()
        for m in members:
            name = m.name
            # 拒绝绝对路径 / .. / 空名
            if not name or name.startswith("/") or ".." in Path(name).parts:
                raise ValueError(f"unsafe path in tar: {name!r}")
            top = name.split("/", 1)[0]
            top_dirs.add(top)
        if len(top_dirs) != 1:
            raise ValueError(
                f"tarball must have exactly 1 top-level dir, got {sorted(top_dirs)}"
            )
        top_name = next(iter(top_dirs))

        # 解压到临时位置 (target_dir/_unpack/), 再把顶层目录内容移到 target_dir
        unpack = target_dir / "_unpack"
        if unpack.exists():
            shutil.rmtree(unpack)
        unpack.mkdir(parents=True)

        if use_data_filter:
            tar.extractall(unpack, filter="data")
        else:
            tar.extractall(unpack)

    # 把 unpack/<top_name>/* 移到 target_dir
    src = unpack / top_name
    if not src.is_dir():
        shutil.rmtree(unpack, ignore_errors=True)
        raise ValueError(f"expected dir at {src}, got something else")
    for item in src.iterdir():
        dest = target_dir / item.name
        if dest.exists():
            if dest.is_dir():
                shutil.rmtree(dest)
            else:
                dest.unlink()
        shutil.move(str(item), str(dest))
    shutil.rmtree(unpack, ignore_errors=True)

    return target_dir


def cleanup_local_project(user_id: str, slug: str) -> bool:
    """删除该用户该项目的所有本地文件 (所有版本). 返回是否真删了."""
    slug_dir = project_slug_dir(user_id, slug)
    if not slug_dir.exists():
        return False
    shutil.rmtree(slug_dir, ignore_errors=True)
    # 顺手清空父目录如果空了
    parent = slug_dir.parent
    if parent.exists():
        try:
            if not any(parent.iterdir()):
                parent.rmdir()
        except OSError:
            pass
    return True


def project_disk_usage(user_id: str, slug: str | None = None) -> int:
    """返回项目占用字节数. slug=None 时返回该用户所有项目总占用."""
    if slug:
        root = project_slug_dir(user_id, slug)
    else:
        root = user_data_root() / user_id / "projects"
    if not root.exists():
        return 0
    total = 0
    for dirpath, _, filenames in os.walk(root):
        for f in filenames:
            try:
                total += (Path(dirpath) / f).stat().st_size
            except OSError:
                pass
    return total
