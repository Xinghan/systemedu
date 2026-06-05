"""复杂 EEG 合成测试项目 — 7 knode / 3 stage / DAG 依赖。

供 L2 机制 E2E + L3 质量评估使用。领域知识点对照仓库 eeg-minecraft-bci 素材，
含可被 judge 判对错的专业事实与学生常见误区锚点。
"""
from __future__ import annotations

import hashlib
import json
import tarfile
from pathlib import Path

SLUG = "eeg-signals-test"

# (module_id, dir_slug, stage, title, 北极星, theory_facts, 误区锚点, prereq_module_ids)
KNODES = [
    ("M01", "M01-w1-what-is-eeg", "S1", "脑电是什么",
     "做出能区分你左右手运动想象的脑机接口",
     "EEG 是头皮记录的神经元同步放电产生的电位，量级约 10-100 微伏(μV)。",
     "学生常误以为 EEG 能直接读出具体念头/文字。",
     []),
    ("M02", "M02-w1-sampling-nyquist", "S1", "采样率与奈奎斯特",
     "做出能区分你左右手运动想象的脑机接口",
     "奈奎斯特定理：采样率 fs 必须 >= 2 倍信号最高频率 fmax 才能不失真。EEG 关心 1-40Hz，常用 250 或 500Hz。",
     "学生常误以为采样率越高越好、没有代价。",
     ["M01"]),
    ("M03", "M03-w2-bands-alpha-beta", "S2", "频带 alpha 与 beta",
     "做出能区分你左右手运动想象的脑机接口",
     "alpha 波 8-13Hz，放松闭眼时枕区增强；beta 波 13-30Hz，专注/运动时增强。",
     "学生常误以为闭眼 alpha 增强就等于睡着了。",
     ["M02"]),
    ("M04", "M04-w2-electrode-impedance", "S2", "电极与阻抗",
     "做出能区分你左右手运动想象的脑机接口",
     "电极-头皮阻抗应低于 5kΩ；需要参考电极和导电膏降低阻抗。",
     "学生常误以为电极数量越多信号一定越好。",
     ["M01"]),
    ("M05", "M05-w2-filtering", "S2", "滤波",
     "做出能区分你左右手运动想象的脑机接口",
     "带通滤波 1-40Hz 去基线漂移与高频噪声；陷波 50Hz 去工频干扰。滤波是取舍不是无损增益。",
     "学生常误以为滤波能凭空无损提高信噪比。",
     ["M02", "M04"]),
    ("M06", "M06-w3-erd-ers", "S3", "ERD 与 ERS",
     "做出能区分你左右手运动想象的脑机接口",
     "运动想象会在对侧感觉运动区引起 mu/beta 频段能量下降(ERD)。",
     "学生常误以为想得越用力 ERD 就越强。",
     ["M03", "M05"]),
    ("M07", "M07-w3-csp-classify", "S3", "简单分类",
     "做出能区分你左右手运动想象的脑机接口",
     "CSP(共空间模式)提取左右手最具区分度的空间滤波器，再用分类器区分。",
     "学生常误以为准确率必须 100% 才算成功。",
     ["M06"]),
]


def _lesson_md(k) -> str:
    mid, _, _, title, northstar, facts, misconcept, _ = k
    return (
        f"# {title}\n\n"
        "## 这一步在通向哪 (北极星)\n"
        f"- 项目目标: {northstar}\n"
        f"- 本节产出: 理解并能解释「{title}」\n"
        f"- 为何需要: 它是构建脑机接口管线中不可跳过的一环\n"
        f"- 完成判据: 能用自己的话讲清「{title}」的核心\n\n"
        "## 核心知识\n"
        f"{facts}\n\n"
        "## 常见误区(导师锚点)\n"
        f"{misconcept}\n"
    )


def _stages():
    return [
        {"stage_id": "S1", "title": "信号基础"},
        {"stage_id": "S2", "title": "采集与预处理"},
        {"stage_id": "S3", "title": "特征与分类"},
    ]


def build_eeg_tarball(tmp: Path) -> tuple[Path, str]:
    """构造 EEG 项目 tarball，返回 (tarball_path, slug)。"""
    root = tmp / SLUG
    (root / "tree").mkdir(parents=True)
    (root / "blueprint").mkdir()

    knode_entries = []
    for k in KNODES:
        mid, dir_slug, stage, title, _, _, _, prereqs = k
        kd = root / "knodes" / dir_slug
        kd.mkdir(parents=True)
        (kd / "lesson.md").write_text(_lesson_md(k), encoding="utf-8")
        (kd / "sections.json").write_text('{"sections":[]}', encoding="utf-8")
        (kd / "audio_scripts.json").write_text('{"scripts":[]}', encoding="utf-8")
        knode_entries.append({
            "module_id": mid, "title": title, "week": 1, "stage": stage,
            "duration_minutes": 45, "knode_dir": f"knodes/{dir_slug}",
        })

    modules = [{"module_id": k[0], "stage_id": k[2], "title": k[3]} for k in KNODES]
    edges = []
    for k in KNODES:
        for pre in k[7]:
            edges.append({"from": pre, "to": k[0], "type": "prerequisite"})

    (root / "tree" / "knowledge_tree.json").write_text(json.dumps({
        "schema_version": "5.0", "title": "EEG signals test",
        "stages": _stages(), "modules": modules, "edges": edges,
    }, ensure_ascii=False), encoding="utf-8")
    (root / "blueprint" / "README.zh.md").write_text("# EEG 测试项目\n", encoding="utf-8")

    def sha256(p: Path) -> str:
        return hashlib.sha256(p.read_bytes()).hexdigest()

    files = [
        {"path": p.relative_to(root).as_posix(), "sha256": sha256(p), "size": p.stat().st_size}
        for p in sorted(root.rglob("*")) if p.is_file() and p.name != "manifest.json"
    ]
    manifest = {
        "schema_version": "1.0", "slug": SLUG,
        "title": "EEG signals test project", "title_zh": "EEG 信号测试项目",
        "description": "脑机接口信号基础(测试专用，含 DAG 依赖与领域误区)",
        "version": "1.0.0",
        "frontmatter": {"age_band": "12-15", "domain": "Neuroscience", "duration_weeks": 3},
        "knode_count": len(KNODES), "stage_count": 3, "languages": ["zh-CN"],
        "total_size_bytes": sum(f["size"] for f in files), "files": files,
        "knodes": knode_entries, "tags": ["eeg", "bci", "test"],
    }
    (root / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False), encoding="utf-8")
    tarball = tmp / f"{SLUG}.tar.gz"
    with tarfile.open(tarball, "w:gz") as tar:
        tar.add(root, arcname=SLUG)
    return tarball, SLUG
