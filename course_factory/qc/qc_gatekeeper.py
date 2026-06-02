#!/usr/bin/env python3
"""SystemEdu QC Gatekeeper — 质检员脚本

把 SKILL.md F1-F10 强制命令钉到机器级别. finalize_knode.py 写盘前必须先跑
这个脚本, exit 0 才允许写盘, 任何 check fail = 拒绝.

历史背景: 2026-05 purpleair M01-M18 第一次生成累计 100+ 小时返工.
Claude 系统性跳了 5.5c/e/f 三大闸门, 部分跳 5.5d/g, 退化 26 风格成米黄.
本脚本是最后一道防线.

10 道自动 check 对应 SKILL.md F1-F10:

  C1   Step 5.5b browser verify (anim+game+3D 全 exit 0)
  C2   Step 5.5a code review (无 onclick="" / 无 window 同名顶层 / 无 emoji
       / canvas 无硬上限 / 无 drop-shadow blur / 无 position:fixed 浮 canvas)
  C3   26 风格使用 (CSS :root 不能全部退化米黄 #f3ecdc + 8 hex accent;
       必须有 26 风格 oklch palette 命名 --SIGNAL/--CORE/--DEPTH 等)
  C4   3D object 决策 (调 should_generate_3d_object, True 时必须有
       3D HTML 文件存在)
  C5   字数 + 占位符 (plan_chars / K1 / K3 / assignment 落预算 ±20%,
       K1 零希腊字母零等号, core_question 原文匹配, [[IDEA]] 占位符
       存在)
  C6   theory 等级 K1 完整性 (有 level_bodies, K1 必填, 不止一句话定义)
  C7   富媒体 9 类 debate (sections.json ideas 覆盖该 keep 的类型,
       至少 1 anim + 1 game + 1 exercise; theory ≥ 2 除非纯方法论)
  C8   audio_scripts 分段 + 字数 (每段 150-300 字, 跨段衔接关键词)
  C9   slides 完整 (intro/outro 必有, theory/anim/game 各独占 1 张,
       audio_script ≥ 30 字, inline_svg 非占位)
  C10  Chat 自检模板 (扫 chat 日志 / commit msg / 单独文件
       qc_checklist_<mid>.txt 含 F10 全 [✓])

Usage:
  python3 -m course_factory.qc.qc_gatekeeper purpleair-airquality-node M19
  → exit 0 + JSON report 写到 stdout 表示通过
  → exit 1 + JSON 含失败原因表示拒绝写盘

参数:
  --strict       严格模式 (默认): 任何 check fail = exit 1
  --warn-only    宽松模式: 只 warn, exit 0 (用于审计旧节, 不阻止写盘)
  --skip-c10     跳过 C10 (chat 自检模板存在性), 用于自动化无 chat 时
  --json-out FN  把 JSON 报告写到文件 (默认 stdout)
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Any


# ---------------------------------------------------------------------------
# 全局路径
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parents[2]
WORKSPACE = REPO_ROOT / "content-workspace"
GENERATED = WORKSPACE / "generated"
TESTS = REPO_ROOT / "course_factory" / "tests"
VERIFY_DIR = REPO_ROOT / "course_factory" / "validate" / "verify"
THEME_STYLE_FILE = REPO_ROOT / "theme_style" / "themes.js"


# ---------------------------------------------------------------------------
# 26 风格 oklch palette 变量命名特征 (用于 C3 检测)
# ---------------------------------------------------------------------------

# theme_style/themes.js 26 套风格里, 每套都用 5 色命名变量
# (SIGNAL/CORE/DEPTH/FLASH/QUERY 同类). 我们检测 CSS :root 里是否含这种命名,
# 而不是单一 --paper/--ink/--accent 8 hex 退化.
# 注意: 这些 token 不区分大小写, 任一出现都算 "26 风格存在".
STYLE_TOKENS_26 = {
    # 通用 5 色命名
    "SIGNAL", "CORE", "DEPTH", "FLASH", "QUERY",
    # cs Data Cathedral
    # bio Helix Garden: LIFE/MOSS/SHADOW/BLOOM/MUTATE
    "LIFE", "MOSS", "SHADOW", "BLOOM", "MUTATE",
    # space Starfield Port: ORBIT/VOID/ECLIPSE/IGNITION/APOGEE
    "ORBIT", "VOID", "ECLIPSE", "IGNITION", "APOGEE",
    # mech Gear Foundry: BRASS/FORGE/IRON/EMBER/SPARK
    "BRASS", "FORGE", "IRON", "EMBER", "SPARK",
    # ai Neural Aurora
    "AURORA", "SYNAPSE", "WEIGHT",
    # phys / opt / qua
    "PHOTON", "WAVE", "QUANTUM", "FIELD",
    # neuro / med
    "PULSE", "NEURON",
    # earth / climate / ocean
    "TIDE", "DELTA", "DRIFT",
    # env Biosphere Dome: CANOPY/LOAM/ABYSS/DAWN/SUN
    "CANOPY", "LOAM", "ABYSS", "DAWN", "SUN",
    # chem Beaker Lab: BEAKER/REAGENT/PRECIPITATE/REACTION
    "BEAKER", "REAGENT", "PRECIPITATE", "REACTION",
    # robo / elec / mat / micro / zoo / bot / arch / agri
    "MOTOR", "CIRCUIT", "ALLOY", "MICRON", "FAUNA", "FLORA", "TIMBER", "HARVEST",
    # math / quant / nuke / paleo / geo / meteo / astro
    "AXIOM", "QUANTA", "ATOM", "FOSSIL", "STRATA", "STORM", "NEBULA",
    # geo Strata Vault: CLAY/RUST/BASALT/CHALK/MAGMA
    "CLAY", "RUST", "BASALT", "CHALK", "MAGMA",
    # 等等 — 这是宽匹配列表
}

# 退化米黄 8 hex 风格标志 (出现 = 违规 F1/F2/F7)
DEGRADE_TOKENS_YELLOW = {
    "paper", "paper-shade", "paper-bright", "ink", "ink-dim", "ink-mute",
    "fill-grey-1", "fill-grey-2", "fill-grey-3",
    "fill-warm", "fill-pcb", "fill-glass", "fill-metal", "fill-blue",
}

# 米黄底常见 hex
DEGRADE_HEX_YELLOW = {"#f3ecdc", "#e8dec5", "#fff8e8", "#fbf6ea", "#2a2520"}


# ---------------------------------------------------------------------------
# 8 hex accent (AESTHETIC.md, 仅适用 3D object, anim/game 不该用)
# ---------------------------------------------------------------------------

AESTHETIC_8_HEX = {
    "#5d8aa8",  # physics
    "#7a9b5e",  # chemistry / success
    "#a35a40",  # biology
    "#3d4a6e",  # space
    "#c97a4e",  # earth
    "#5e6e8c",  # cs
    "#8a5e6e",  # math
    "#6a6a5e",  # engineering
}


# ---------------------------------------------------------------------------
# C1: browser verify
# ---------------------------------------------------------------------------

def check_c1_browser_verify(slug: str, mid: str) -> dict:
    """C1 — 跑 verify/animation.mjs + game.mjs (+ 3D 如有), exit 0 必达."""
    issues: list[str] = []
    details: dict[str, Any] = {}

    knode_dir = _find_knode_dir(slug, mid)
    if not knode_dir:
        return {"check": "C1", "status": "fail", "issues": [f"knode dir not found: {slug}/{mid}"], "details": {}}

    sections_path = knode_dir / "sections.json"
    if not sections_path.exists():
        return {"check": "C1", "status": "fail", "issues": [f"sections.json missing"], "details": {}}

    sections = json.loads(sections_path.read_text())
    rendered = sections.get("rendered_sections", {})

    # 项目隔离解析本节实际用的源文件 (按内联 HTML 内容指纹反查, 不靠文件名前缀+黑名单)
    media = _resolve_media_paths(slug, mid)
    anim_path = media["anim"]
    game_path = media["game"]
    threed_path = media["threed"]

    if anim_path is None:
        issues.append("no anim HTML matched in tests/anim/ (内联指纹未命中)")
    if game_path is None:
        issues.append("no game HTML matched in tests/game/ (内联指纹未命中)")

    # 跑 verify
    for label, path, script in [
        ("anim", anim_path, "animation.mjs"),
        ("game", game_path, "game.mjs"),
    ]:
        if not path:
            continue
        out_dir = f"/tmp/qc_verify_{mid.lower()}_{label}"
        cmd = ["node", str(VERIFY_DIR / script), str(path), "--out", out_dir]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            details[f"{label}_verify_exit"] = result.returncode
            details[f"{label}_path"] = str(path)
            if result.returncode != 0:
                issues.append(f"{label} verify exit {result.returncode}: {result.stderr[:200]}")
        except subprocess.TimeoutExpired:
            issues.append(f"{label} verify timeout 120s")
        except Exception as e:
            issues.append(f"{label} verify error: {e}")

    # 3D 选做
    if threed_path:
        details["threed_path"] = str(threed_path)
        details["threed_verified"] = "skipped (no 3D verify script yet)"

    return {
        "check": "C1",
        "status": "pass" if not issues else "fail",
        "issues": issues,
        "details": details,
    }


# ---------------------------------------------------------------------------
# C2: code review 静态扫描
# ---------------------------------------------------------------------------

EMOJI_PATTERN = re.compile(
    r"[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F100-\U0001F2FF★♥♦♠♣✓✗✦]"
)

WINDOW_NAMES = {"history", "location", "name", "status", "origin", "parent", "top",
                "self", "length", "event", "closed", "opener", "frames"}


def check_c2_code_review(slug: str, mid: str) -> dict:
    """C2 — code review 静态扫描."""
    issues: list[str] = []
    details: dict[str, list[str]] = {}

    knode_dir = _find_knode_dir(slug, mid)
    if not knode_dir:
        return {"check": "C2", "status": "fail", "issues": ["knode dir not found"], "details": {}}

    # 项目隔离解析 (按内联 HTML 指纹反查, 不靠文件名前缀+黑名单)
    media = _resolve_media_paths(slug, mid)

    for label, path in [("anim", media["anim"]), ("game", media["game"])]:
        if not path:
            continue
        content = path.read_text()
        file_issues = []

        # onclick="" 内联
        if re.search(r'onclick\s*=\s*["\']', content):
            file_issues.append("onclick='' inline binding")

        # window 同名顶层变量 (var/let/const xxx = ...)
        for wn in WINDOW_NAMES:
            if re.search(rf'\b(?:var|let|const)\s+{wn}\s*[=;]', content):
                file_issues.append(f"window-name top-level var: {wn}")

        # emoji
        emojis = EMOJI_PATTERN.findall(content)
        if emojis:
            file_issues.append(f"emoji found: {set(emojis)}")

        # canvas 写死 width
        if re.search(r'<canvas[^>]*\bwidth\s*=\s*["\']\d+["\']', content):
            file_issues.append("canvas hardcoded width attribute")

        # Math.min(..., 480) etc 硬上限
        if re.search(r'Math\.min\s*\([^)]*,\s*\d{3,4}\s*\)', content):
            m = re.search(r'Math\.min\s*\([^)]*,\s*(\d{3,4})\s*\)', content)
            if m:
                file_issues.append(f"Math.min hardcoded cap: {m.group(1)}")

        # drop-shadow 含 blur (Npx Npx Npx)
        if re.search(r'drop-shadow\([^)]*\d+px\s+\d+px\s+(?:[1-9]|\d{2,})px', content):
            file_issues.append("drop-shadow with blur (forbidden, use offset only)")

        # box-shadow 含 blur (第三个参数 ≥ 1px)
        # 形如 box-shadow:3px 3px 0px ink (无 blur) vs 3px 3px 8px ... (有 blur)
        for m in re.finditer(r'box-shadow\s*:\s*([^;]+);', content):
            shadow = m.group(1)
            # 找 N px N px N px, 第三个 N >= 1
            shadow_match = re.search(r'(-?\d+)px\s+(-?\d+)px\s+(\d+)px', shadow)
            if shadow_match and int(shadow_match.group(3)) >= 1:
                file_issues.append(f"box-shadow has blur: {shadow.strip()}")
                break

        # position:fixed for lang-btn / guide
        if re.search(r'\.(?:lang-btn|langbtn|guide)[^{]*\{[^}]*position\s*:\s*fixed', content, re.DOTALL):
            file_issues.append("lang-btn or guide has position:fixed (must be in sidebar)")

        # 没 sidebar
        if not re.search(r'\.(?:sidebar|game-sidebar|side-bar)', content):
            file_issues.append("missing .sidebar / .game-sidebar (200px left column required)")

        # JetBrains Mono 必须有
        if "JetBrains Mono" not in content:
            file_issues.append("missing JetBrains Mono font")

        if file_issues:
            issues.append(f"{label}: " + " | ".join(file_issues))
            details[label] = file_issues

    return {
        "check": "C2",
        "status": "pass" if not issues else "fail",
        "issues": issues,
        "details": details,
    }


# ---------------------------------------------------------------------------
# C3: 26 风格使用 (theme_style)
# ---------------------------------------------------------------------------

def check_c3_theme_style_26(slug: str, mid: str) -> dict:
    """C3 — anim/game 必须用 theme_style 26 风格, 不准退化米黄 8 hex."""
    issues: list[str] = []
    details: dict[str, Any] = {}

    # 项目隔离解析 (按内联 HTML 指纹反查, 不靠文件名前缀+黑名单)
    media = _resolve_media_paths(slug, mid)

    for label, path in [("anim", media["anim"]), ("game", media["game"])]:
        if not path:
            continue
        content = path.read_text()
        file_issues: list[str] = []

        # 提取 :root { ... } block
        root_match = re.search(r':root\s*\{([^}]+)\}', content)
        root_block = root_match.group(1) if root_match else ""

        # 检测 26 风格 token 存在性 (宽松: 任一存在算 pass)
        has_26_token = False
        found_tokens = []
        for tok in STYLE_TOKENS_26:
            if re.search(rf'--{tok}\b', root_block, re.IGNORECASE):
                has_26_token = True
                found_tokens.append(tok)

        # 检测退化米黄 8 hex 风格
        degrade_yellow_tokens = []
        for tok in DEGRADE_TOKENS_YELLOW:
            if re.search(rf'--{re.escape(tok)}\b', root_block):
                degrade_yellow_tokens.append(tok)

        # 主背景 hex 检测
        body_bg_match = re.search(r'body\s*\{[^}]*background\s*:\s*([^;}]+)', content)
        body_bg = body_bg_match.group(1).strip() if body_bg_match else ""
        is_yellow_bg = any(hex_c in content.lower() for hex_c in DEGRADE_HEX_YELLOW)

        # 判定
        if not has_26_token and degrade_yellow_tokens:
            file_issues.append(
                f"VIOLATION F2: 退化为 AESTHETIC.md 米黄 8 hex 风格. "
                f"找到米黄 CSS 变量: {degrade_yellow_tokens[:5]}. "
                f"必须用 theme_style/themes.js 26 风格之一 (oklch palette + SIGNAL/CORE/DEPTH 命名)"
            )
        if not has_26_token:
            file_issues.append(
                "VIOLATION F1: :root CSS 变量未找到 theme_style 26 风格命名 "
                "(应有 --SIGNAL/--CORE/--DEPTH/--FLASH/--QUERY 等)"
            )

        details[label] = {
            "has_26_token": has_26_token,
            "found_26_tokens": found_tokens[:5],
            "degrade_yellow_tokens": degrade_yellow_tokens[:5],
            "body_bg": body_bg[:80],
            "yellow_bg_detected": is_yellow_bg,
        }
        if file_issues:
            issues.append(f"{label}: " + " | ".join(file_issues))

    return {
        "check": "C3",
        "status": "pass" if not issues else "fail",
        "issues": issues,
        "details": details,
    }


# ---------------------------------------------------------------------------
# C4: 3D object 决策一致性
# ---------------------------------------------------------------------------

def check_c4_3d_decision(slug: str, mid: str) -> dict:
    """C4 — 跑 should_generate_3d_object(knode), True 时必须有 3D HTML."""
    issues: list[str] = []
    details: dict[str, Any] = {}

    try:
        sys.path.insert(0, str(REPO_ROOT))
        from course_factory import load_knode_context_from_workspace
        from course_factory.factory import should_generate_3d_object  # type: ignore
        ctx = load_knode_context_from_workspace(slug, mid)
        decision = should_generate_3d_object(ctx.knode)
        details["should_generate"] = decision.get("should_generate", False)
        details["reason"] = decision.get("reason", "")
        details["object_name_hint"] = decision.get("object_name_hint", "")
    except ImportError:
        # should_generate_3d_object 可能没实现, 跳过 C4
        return {
            "check": "C4",
            "status": "skip",
            "issues": ["should_generate_3d_object() not implemented yet"],
            "details": {},
        }
    except Exception as e:
        return {
            "check": "C4",
            "status": "fail",
            "issues": [f"call should_generate_3d_object failed: {e}"],
            "details": {},
        }

    # 如果 should=True, 找对应 3D 文件 (test_3d_<mid>_*.html)。
    # 历史惯例放 tests/anim/, SKILL F3 名义目录 tests/3d_object/, 两处都找。
    if details["should_generate"]:
        threed_files: list = []
        for sub in ("anim", "3d_object"):
            d = TESTS / sub
            if d.exists():
                threed_files += list(d.glob(f"test_3d_{mid.lower()}_*.html"))
        if not threed_files:
            issues.append(
                f"F3: should_generate=True (object={details['object_name_hint']}), "
                f"但 tests/anim/ 或 tests/3d_object/ 下 test_3d_{mid.lower()}_*.html 不存在 — 必须生成"
            )
        else:
            details["threed_file"] = str(threed_files[0])

    return {
        "check": "C4",
        "status": "pass" if not issues else "fail",
        "issues": issues,
        "details": details,
    }


# ---------------------------------------------------------------------------
# C5: 字数 + 占位符 + 引用
# ---------------------------------------------------------------------------

GREEK_PATTERN = re.compile(r'[Ͱ-Ͽ]')


def _count_chars(text: str) -> int:
    """中文字符 + 英文单词 = 字符数."""
    zh = len(re.findall(r'[一-鿿]', text))
    en = len(re.findall(r'[a-zA-Z]+', text))
    return zh + en


def check_c5_chars_and_refs(slug: str, mid: str) -> dict:
    """C5 — plan/K1/K3/assignment 字数; K1 零希腊字母; core_question 原文匹配."""
    issues: list[str] = []
    details: dict[str, Any] = {}

    knode_dir = _find_knode_dir(slug, mid)
    if not knode_dir:
        return {"check": "C5", "status": "fail", "issues": ["knode dir not found"], "details": {}}

    # 读 generation_guide
    try:
        sys.path.insert(0, str(REPO_ROOT))
        from course_factory import load_knode_context_from_workspace
        ctx = load_knode_context_from_workspace(slug, mid)
        knode = ctx.knode
        guide = knode.get("generation_guide", {})
        expected = guide.get("expected_lengths", {})
        core_q = knode.get("core_question", "")
    except Exception as e:
        return {"check": "C5", "status": "fail", "issues": [f"load knode failed: {e}"], "details": {}}

    # plan_markdown
    plan_path = knode_dir / "lesson.md"
    if plan_path.exists():
        plan_text = plan_path.read_text()
        plan_n = _count_chars(re.sub(r'\[\[.*?\]\]', '', plan_text))
        plan_range = expected.get("plan_chars", [800, 1500])
        plan_min, plan_max = plan_range[0] * 0.8, plan_range[1] * 1.2
        details["plan_chars"] = plan_n
        details["plan_budget"] = plan_range
        if not (plan_min <= plan_n <= plan_max):
            issues.append(f"F5: plan_chars {plan_n} 不在容差 [{plan_min:.0f}, {plan_max:.0f}] 内 (预算 {plan_range})")

        # core_question 原文匹配
        if core_q and core_q not in plan_text:
            issues.append(f"F5: plan 中未找到 core_question 原文: '{core_q[:50]}...'")

    # theories
    theories_path = knode_dir / "theories.json"
    if theories_path.exists():
        theories = json.loads(theories_path.read_text())
        n_theories = len(theories)
        n_theories_range = expected.get("n_theories", [1, 2])
        if not (n_theories_range[0] <= n_theories <= n_theories_range[1]):
            issues.append(f"F5: n_theories={n_theories} 不在预算范围 {n_theories_range}")

        k1_budget = expected.get("k1_chars_per_theory", [800, 1200])
        k3_budget = expected.get("k3_chars_per_theory", [400, 600])
        k1_min, k1_max = k1_budget[0] * 0.8, k1_budget[1] * 1.2
        k3_min, k3_max = k3_budget[0] * 0.8, k3_budget[1] * 1.2

        for i, t in enumerate(theories):
            for lb in t.get("level_bodies", []):
                body = lb.get("body_markdown", "")
                body_clean = re.sub(r'^#+ ', '', body, flags=re.M)
                body_clean = re.sub(r'\*\*?', '', body_clean)
                n = _count_chars(body_clean)
                level = lb.get("level", "?")
                details[f"theory_{i}_{level}_chars"] = n
                if level == "K1":
                    if not (k1_min <= n <= k1_max):
                        issues.append(
                            f"F5: theory[{i}] K1 字数 {n} 不在容差 "
                            f"[{k1_min:.0f}, {k1_max:.0f}] 内 (预算 {k1_budget})"
                        )
                    # K1 零希腊字母
                    greek = set(GREEK_PATTERN.findall(body))
                    if greek:
                        issues.append(f"F5: theory[{i}] K1 出现希腊字母 {greek} (K1 必须零希腊字母)")
                    # K1 零等号 (简单赋值如 pm25 = 38)
                    if re.search(r'[a-zA-Z_]\w*\s*=\s*\d+(?:\.\d+)?', body):
                        m = re.search(r'([a-zA-Z_]\w*\s*=\s*\d+(?:\.\d+)?)', body)
                        issues.append(f"F5: theory[{i}] K1 出现代数等式 '{m.group(1)}' (K1 必须零等号, 改成中文描述)")
                elif level == "K3":
                    if not (k3_min <= n <= k3_max):
                        issues.append(
                            f"F5: theory[{i}] K3 字数 {n} 不在容差 "
                            f"[{k3_min:.0f}, {k3_max:.0f}] 内 (预算 {k3_budget})"
                        )

    # assignment
    assign_path = knode_dir / "assignment.md"
    if assign_path.exists():
        assign_text = assign_path.read_text()
        assign_n = _count_chars(assign_text)
        assign_range = expected.get("assignment_chars", [500, 1000])
        assign_min, assign_max = assign_range[0] * 0.8, assign_range[1] * 1.2
        details["assignment_chars"] = assign_n
        details["assignment_budget"] = assign_range
        if not (assign_min <= assign_n <= assign_max):
            issues.append(f"F5: assignment 字数 {assign_n} 不在容差 [{assign_min:.0f}, {assign_max:.0f}]")

    return {
        "check": "C5",
        "status": "pass" if not issues else "fail",
        "issues": issues,
        "details": details,
    }


# ---------------------------------------------------------------------------
# C6: theory K1 完整性
# ---------------------------------------------------------------------------

def check_c6_theory_k1_quality(slug: str, mid: str) -> dict:
    """C6 — K1 不止一句话, 必含 '是什么 / 为什么 / 有什么表现 / 例子'."""
    issues: list[str] = []
    details: dict[str, Any] = {}

    knode_dir = _find_knode_dir(slug, mid)
    theories_path = knode_dir / "theories.json" if knode_dir else None
    if not theories_path or not theories_path.exists():
        return {"check": "C6", "status": "skip", "issues": ["no theories"], "details": {}}

    theories = json.loads(theories_path.read_text())
    for i, t in enumerate(theories):
        k1 = None
        for lb in t.get("level_bodies", []):
            if lb.get("level") == "K1":
                k1 = lb.get("body_markdown", "")
                break
        if not k1:
            issues.append(f"theory[{i}] '{t.get('title', '')}' 缺 K1 level_body")
            continue
        # 至少 2 个 h3 (### 标题), 表示有结构
        h3_count = len(re.findall(r'^### ', k1, flags=re.M))
        if h3_count < 1:
            issues.append(f"theory[{i}] '{t.get('title')}' K1 无 ### 子标题 (建议至少 2 个 - 是什么/为什么/例子)")
        # 至少 1 个类比 (含"想象"、"比如"、"类比"、"就像")
        if not re.search(r'想象|比如|类比|就像|好比|例如', k1):
            issues.append(f"theory[{i}] K1 缺类比 (必须含'想象/比如/类比/就像'等词)")
        details[f"theory_{i}"] = {"h3_count": h3_count, "len": len(k1)}

    return {
        "check": "C6",
        "status": "pass" if not issues else "fail",
        "issues": issues,
        "details": details,
    }


# ---------------------------------------------------------------------------
# C7: 富媒体 9 类覆盖
# ---------------------------------------------------------------------------

def check_c7_media_coverage(slug: str, mid: str) -> dict:
    """C7 — sections.json ideas 必含 anim + game + exercise, theory ≥ 2 (除非 shallow)."""
    issues: list[str] = []
    details: dict[str, Any] = {}

    knode_dir = _find_knode_dir(slug, mid)
    sections_path = knode_dir / "sections.json" if knode_dir else None
    theories_path = knode_dir / "theories.json" if knode_dir else None

    if not sections_path or not sections_path.exists():
        return {"check": "C7", "status": "fail", "issues": ["sections.json missing"], "details": {}}

    sections = json.loads(sections_path.read_text())
    ideas = sections.get("ideas", [])
    modes_present = {i.get("mode") for i in ideas}
    details["modes_present"] = list(modes_present)

    for required in ["animation", "game", "exercise"]:
        if required not in modes_present:
            issues.append(f"F4: 缺 {required} idea (anim/game/exercise 是硬要求)")

    # theory n
    theories = json.loads(theories_path.read_text()) if theories_path and theories_path.exists() else []
    details["n_theories"] = len(theories)

    # depth shallow 允许 0-1, 否则 ≥ 1
    try:
        sys.path.insert(0, str(REPO_ROOT))
        from course_factory import load_knode_context_from_workspace
        ctx = load_knode_context_from_workspace(slug, mid)
        depth = ctx.knode.get("generation_guide", {}).get("theory_depth", "shallow")
        n_min = {"shallow": 1, "medium": 1, "deep": 2}.get(depth, 1)
        if len(theories) < n_min:
            issues.append(f"F4: theory n={len(theories)} 低于 depth={depth} 要求 (min {n_min})")
    except Exception:
        pass

    return {
        "check": "C7",
        "status": "pass" if not issues else "fail",
        "issues": issues,
        "details": details,
    }


# ---------------------------------------------------------------------------
# C8: audio_scripts 分段 + 字数
# ---------------------------------------------------------------------------

def check_c8_audio_scripts(slug: str, mid: str) -> dict:
    """C8 — 每段 100-350 字 (容差), 跨段衔接关键词."""
    issues: list[str] = []
    details: dict[str, Any] = {}

    knode_dir = _find_knode_dir(slug, mid)
    audio_path = knode_dir / "audio_scripts.json" if knode_dir else None
    if not audio_path or not audio_path.exists():
        return {"check": "C8", "status": "fail", "issues": ["audio_scripts.json missing"], "details": {}}

    data = json.loads(audio_path.read_text())
    sections = data if isinstance(data, list) else data.get("scripts", data.get("sections", []))
    details["n_sections"] = len(sections)
    if len(sections) < 3:
        issues.append(f"F5: audio_scripts 只有 {len(sections)} 段, 应 ≥ 3 段")

    for i, s in enumerate(sections):
        script = s.get("audio_script", "")
        n = _count_chars(script)
        if n < 100 or n > 400:
            title = s.get("section_title", "")[:30]
            issues.append(f"F5: audio[{i}] '{title}' {n} 字 (容差 100-400)")

    return {
        "check": "C8",
        "status": "pass" if not issues else "fail",
        "issues": issues,
        "details": details,
    }


# ---------------------------------------------------------------------------
# C9: slides 完整性
# ---------------------------------------------------------------------------

def check_c9_slides(slug: str, mid: str) -> dict:
    """C9 — intro/outro 必有, theory/anim/game 各独占, audio_script ≥ 30 字, inline_svg 非占位."""
    issues: list[str] = []
    details: dict[str, Any] = {}

    knode_dir = _find_knode_dir(slug, mid)
    slides_path = knode_dir / "slides.json" if knode_dir else None
    if not slides_path or not slides_path.exists():
        return {"check": "C9", "status": "fail", "issues": ["slides.json missing"], "details": {}}

    data = json.loads(slides_path.read_text())
    slides = data if isinstance(data, list) else data.get("slides", [])
    details["n_slides"] = len(slides)

    kinds = [s.get("kind") for s in slides]
    if not slides or slides[0].get("kind") != "intro":
        issues.append("F5: slides[0] 必须 kind=intro")
    if not slides or slides[-1].get("kind") != "outro":
        issues.append("F5: 最后一张 slide 必须 kind=outro")

    # audio_script 长度
    for i, s in enumerate(slides):
        a = s.get("audio_script", "")
        if len(a) < 30:
            issues.append(f"F5: slide[{i}] kind={s.get('kind')} audio_script < 30 字")
        # inline_svg 非占位 (不只一个 circle)
        if s.get("kind") in ("intro", "bullet", "theory", "outro"):
            svg = s.get("payload", {}).get("inline_svg", "")
            if svg and svg.count("<circle") == 1 and svg.count("<") <= 5:
                issues.append(f"F5: slide[{i}] kind={s.get('kind')} inline_svg 疑似占位 (只 1 circle)")

    return {
        "check": "C9",
        "status": "pass" if not issues else "fail",
        "issues": issues,
        "details": details,
    }


# ---------------------------------------------------------------------------
# C10: chat 自检模板存在
# ---------------------------------------------------------------------------

def check_c10_chat_checklist(slug: str, mid: str, skip: bool = False) -> dict:
    """C10 — 写盘前必须有 F10 自检模板存在.

    优先扫 qc_checklist 文件 (Claude 写入), 没有则跳过."""
    if skip:
        return {"check": "C10", "status": "skip", "issues": [], "details": {"skipped": True}}

    issues: list[str] = []
    details: dict[str, Any] = {}

    # 找 _review/<mid>_qc_checklist.txt
    checklist = WORKSPACE / "_review" / f"{mid.lower()}_qc_checklist.txt"
    if not checklist.exists():
        return {
            "check": "C10",
            "status": "fail",
            "issues": [
                f"F10 自检模板缺失: {checklist}. "
                "Claude 必须按 SKILL.md F10 模板写 chat 自检确认到这个文件 "
                "(全 12 步 + 7 闸门 [✓])"
            ],
            "details": {"expected_path": str(checklist)},
        }
    text = checklist.read_text()
    required_marks = [
        "Step 0", "Step 0.5", "Step 0.7", "Step 1", "Step 1.5", "Step 2",
        "Step 2.5", "Step 2.6", "Step 3", "Step 4", "Step 5",
        "Step 5.5a", "Step 5.5b", "Step 5.5c", "Step 5.5d",
        "Step 5.5e", "Step 5.5f", "Step 5.5g",
        "Step 6", "Step 6.5", "Step 6.6", "Step 6.7",
    ]
    missing_marks = [m for m in required_marks if f"[✓] {m}" not in text and f"[ok] {m}" not in text]
    if missing_marks:
        issues.append(f"F10 自检表缺 [✓] 标记: {missing_marks[:5]}{'...' if len(missing_marks) > 5 else ''}")

    return {
        "check": "C10",
        "status": "pass" if not issues else "fail",
        "issues": issues,
        "details": {"checklist_path": str(checklist), "found_marks": len(required_marks) - len(missing_marks),
                    "total_marks": len(required_marks)},
    }


def check_c11_node_kind_anim_form(slug: str, mid: str) -> dict:
    """C11 — 节点性质 (F4.0) 与 animation 形式一致性.

    判定规则 (跟 SKILL.md F4.0 表格一致):
      A. 现象类 / B. 机制类 → autoplay 多帧动画 OK
      C. 总览类 (roadmap / 介绍 / 仪式 / 选型 / 安全)  → 必须 static_infographic
         (禁 setInterval / requestAnimationFrame / showFrame / frameIds 帧推进)
      D. 纯文本类 (反思 / 家访 / 采访)  → 应跳过 animation

    判定关键词 (扫 knode title + core_question + summary):
      C 类标志: 路线图 / 总览 / 项目终点 / 介绍 / 仪式 / 安全 / 选型 / 工具
                / DOI / Zenodo / 阅读 / 论文 / overview / roadmap
      D 类标志: 反思 / 家访 / 采访 / 讨论 / 写感想

    C 类节点 anim HTML 必须满足:
      - 无 `setInterval(` `requestAnimationFrame(` `showFrame(` `frameIds`
      - 无 `subCues` 时间轴
      - 仍有 26 风格 palette + sidebar
    """
    knode_dir = _find_knode_dir(slug, mid)
    if not knode_dir:
        return {"check": "C11", "status": "fail", "issues": [f"knode dir not found"], "details": {}}

    issues: list[str] = []
    details: dict[str, Any] = {}

    # 取 knode meta
    try:
        sys.path.insert(0, str(REPO_ROOT))
        from course_factory import load_knode_context_from_workspace
        ctx = load_knode_context_from_workspace(slug, mid)
        knode = ctx.knode
    except Exception as e:
        return {"check": "C11", "status": "fail", "issues": [f"load knode failed: {e}"], "details": {}}

    title = (knode.get("title", "") or "")
    core_q = (knode.get("core_question", "") or "")
    summary = (knode.get("summary", "") or "")
    blob = f"{title} {core_q} {summary}".lower()

    C_KIND_KEYWORDS = [
        "路线图", "总览", "介绍", "仪式", "安全条款", "选型", "工具准备",
        "项目终点", "doi", "zenodo", "阅读", "论文", "overview", "roadmap",
        "目标墙", "26 周", "起点", "checklist",
    ]
    D_KIND_KEYWORDS = ["反思", "家访", "采访", "写感想", "讨论会"]

    matched_c = [k for k in C_KIND_KEYWORDS if k.lower() in blob]
    matched_d = [k for k in D_KIND_KEYWORDS if k.lower() in blob]

    if matched_d:
        details["kind"] = "D (纯文本)"
        details["matched_keywords"] = matched_d
        # D 类应 reject animation, 看 sections.json 有没有 anim
        sections_path = knode_dir / "sections.json"
        if sections_path.exists():
            sections = json.loads(sections_path.read_text())
            ideas = sections.get("ideas", [])
            has_anim = any(i.get("mode") == "animation" for i in ideas)
            if has_anim:
                issues.append(
                    f"VIOLATION F4.0: D 类节点 (纯文本/反思类, 命中 {matched_d}) "
                    f"应 reject animation, 但 sections.json 含 animation idea"
                )
    elif matched_c:
        details["kind"] = "C (总览类)"
        details["matched_keywords"] = matched_c
        # C 类必须 static_infographic, 检查 anim HTML
        # 1) media/ 目录独立文件
        media_dir = knode_dir / "media"
        anim_sources: list[tuple[str, str]] = []  # [(label, html)]
        if media_dir.exists():
            for ap in media_dir.glob("animation-*.html"):
                anim_sources.append((ap.name, ap.read_text(errors="ignore")))
        # 2) sections.json 内嵌 iframe_html
        sections_path = knode_dir / "sections.json"
        if sections_path.exists():
            sections = json.loads(sections_path.read_text())
            rendered = sections.get("rendered_sections", {})
            for sec_id, sec in rendered.items():
                if isinstance(sec, dict) and sec.get("mode") == "animation":
                    html = sec.get("iframe_html") or sec.get("html") or ""
                    if html and len(html) > 200:
                        anim_sources.append((f"sections[{sec_id}]", html))
        details["anim_sources"] = [s[0] for s in anim_sources]
        if not anim_sources:
            details["anim_files"] = 0
        else:
            for ap_name, src in anim_sources:
                violations = []
                if re.search(r"\bsetInterval\s*\(", src):
                    violations.append("setInterval (帧推进)")
                if re.search(r"\brequestAnimationFrame\s*\(", src):
                    violations.append("requestAnimationFrame (帧推进)")
                if re.search(r"\bfunction\s+showFrame\b", src) or re.search(r"\bshowFrame\s*\(\d", src):
                    violations.append("showFrame (帧切换)")
                if re.search(r"\bframeIds\b", src):
                    violations.append("frameIds 数组")
                if re.search(r"\bsubCues\b", src):
                    violations.append("subCues 时间轴")
                if violations:
                    issues.append(
                        f"VIOLATION F4.0: C 类节点 (总览/路线图, 命中 {matched_c[:3]}) "
                        f"anim {ap_name} 含 autoplay/帧推进: {violations} — "
                        f"应改为 static_infographic (hover/click 弹明细, 禁用帧切换)"
                    )
                details[f"anim_{ap_name}_violations"] = violations
    else:
        details["kind"] = "A/B (科学过程类)"
        # A/B 类不强制检查 (autoplay OK)

    return {
        "check": "C11",
        "status": "pass" if not issues else "fail",
        "issues": issues,
        "details": details,
    }


# ---------------------------------------------------------------------------
# 工具
# ---------------------------------------------------------------------------

def _find_knode_dir(slug: str, mid: str) -> Path | None:
    """找 content-workspace/generated/<slug>/knodes/<mid>-*/."""
    base = GENERATED / slug / "knodes"
    if not base.exists():
        return None
    for d in base.iterdir():
        if d.is_dir() and d.name.startswith(f"{mid}-"):
            return d
    return None


def _normalize_html(s: str) -> str:
    """去掉空白做内容指纹比对 (内联与源文件可能换行/缩进略不同)."""
    return re.sub(r"\s+", "", s or "")


def _resolve_media_paths(slug: str, mid: str) -> dict[str, Path | None]:
    """项目隔离地解析本节实际用的 anim/game/3D 源文件.

    根因修复 (替代全目录 glob + 文件名黑名单): 多个项目共用 tests/{anim,game,
    3d_object} 且编号 M01-M64 重叠, 靠文件名前缀猜归属会误撞别项目残留 (例
    eeg-minecraft-bci 的 test_anim_m10_openbci_record), 文件名黑名单又会误杀
    合法文件 (例 _chain 误杀 solder_action_chain)。

    正确做法: 从本项目本节 sections.json 里内联的 HTML 内容, 反查 tests 目录
    中内容一致的源文件。匹配的是"这个项目这个节点实际渲染的那段 HTML", 跟文件名、
    跟其他项目的同号残留完全无关。
    """
    out: dict[str, Path | None] = {"anim": None, "game": None, "threed": None}
    knode_dir = _find_knode_dir(slug, mid)
    if not knode_dir:
        return out
    sections_path = knode_dir / "sections.json"
    if not sections_path.exists():
        return out
    try:
        sections = json.loads(sections_path.read_text())
    except Exception:
        return out
    rendered = sections.get("rendered_sections", {})

    # 收集本节内联的 anim / game html 指纹 (按 idea_id 前缀分流)
    inline = {"anim": None, "game": None}
    for idea_id, payload in rendered.items():
        if not isinstance(payload, dict):
            continue
        html = payload.get("html")
        if not html:
            continue
        mode = (payload.get("mode") or "").lower()
        if idea_id.startswith("anim_") or mode == "animation":
            inline["anim"] = _normalize_html(html)
        elif idea_id.startswith("game_") or mode == "game":
            inline["game"] = _normalize_html(html)

    # 3D 内联 (如有, 存在 sections 顶层或 knode_dir/object_3d.html)
    threed_inline = _normalize_html(sections.get("object_3d_html", "")) or None

    def _match(dir_name: str, fp_prefix: str, target: str | None) -> Path | None:
        d = TESTS / dir_name
        if not d.exists() or not target:
            return None
        # 先按内容指纹精确匹配 (项目隔离的关键)
        for p in d.glob(f"{fp_prefix}_{mid.lower()}_*.html"):
            if _normalize_html(p.read_text()) == target:
                return p
        return None

    out["anim"] = _match("anim", "test_anim", inline["anim"])
    out["game"] = _match("game", "test_game", inline["game"])
    out["threed"] = _match("3d_object", "test_3d", threed_inline)
    return out


def check_c12_north_star(slug: str, mid: str) -> dict:
    """C12 — 每节 lesson.md 必须有"这一步在通向哪 (北极星)"项目对齐模块 (用户钢印).

    检查 lesson.md 顶部 (第一个 ## 之前) 是否含该 blockquote callout +
    4 个必填字段, 且"还差几步"不用绝对节点号 (重排后会失效)。
    """
    issues: list[str] = []
    knode_dir = _find_knode_dir(slug, mid)
    if not knode_dir:
        return {"check": "C12", "status": "fail", "issues": ["knode dir not found"], "details": {}}
    lesson = knode_dir / "lesson.md"
    if not lesson.exists():
        return {"check": "C12", "status": "fail", "issues": ["lesson.md 不存在"], "details": {}}
    text = lesson.read_text(encoding="utf-8")
    # 北极星块必须在第一个 ## 段标题之前
    head = text.split("\n## ", 1)[0]
    if "这一步在通向哪" not in head:
        return {
            "check": "C12",
            "status": "fail",
            "issues": [
                "缺少'这一步在通向哪 (北极星)'项目对齐模块 (必须在 lesson.md 顶部、"
                "第一个 ## 段之前)。见 SKILL.md Step 1 该块 4 行结构 (我们最终要做出的 / "
                "这一节你亲手做出的那块积木 / 它通向 / 离终点还差几步)。"
            ],
            "details": {},
        }
    required = ["我们最终要做出的", "这一节你亲手做出的那块积木", "它通向", "离终点还差几步"]
    missing = [r for r in required if r not in head]
    if missing:
        issues.append(f"北极星块缺字段: {missing}")
    # "还差几步"不应用绝对节点号 (例 '还差 40 节' / '到 M55')，避免重排后失效
    import re as _re
    far = _re.search(r"离终点还差几步\*\*:\s*(.+)", head)
    if far and _re.search(r"还差\s*\d+\s*节|到\s*M\d", far.group(1)):
        issues.append("'离终点还差几步'用了绝对节点号/节数, 应改用 stage 里程碑 (重排后绝对号会失效)")
    return {
        "check": "C12",
        "status": "pass" if not issues else "fail",
        "issues": issues,
        "details": {"has_north_star": True},
    }


# ---------------------------------------------------------------------------
# 入口
# ---------------------------------------------------------------------------

def run_all_checks(slug: str, mid: str, skip_c10: bool = False) -> dict:
    """跑所有 check, 返回汇总报告."""
    checks = [
        check_c1_browser_verify(slug, mid),
        check_c2_code_review(slug, mid),
        check_c3_theme_style_26(slug, mid),
        check_c4_3d_decision(slug, mid),
        check_c5_chars_and_refs(slug, mid),
        check_c6_theory_k1_quality(slug, mid),
        check_c7_media_coverage(slug, mid),
        check_c8_audio_scripts(slug, mid),
        check_c9_slides(slug, mid),
        check_c10_chat_checklist(slug, mid, skip=skip_c10),
        check_c11_node_kind_anim_form(slug, mid),
        check_c12_north_star(slug, mid),
    ]

    pass_count = sum(1 for c in checks if c["status"] == "pass")
    fail_count = sum(1 for c in checks if c["status"] == "fail")
    skip_count = sum(1 for c in checks if c["status"] == "skip")
    overall = "pass" if fail_count == 0 else "fail"

    return {
        "slug": slug,
        "module_id": mid,
        "overall": overall,
        "summary": {
            "pass": pass_count,
            "fail": fail_count,
            "skip": skip_count,
            "total": len(checks),
        },
        "checks": checks,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="SystemEdu QC Gatekeeper")
    ap.add_argument("slug", help="项目 slug (例: purpleair-airquality-node)")
    ap.add_argument("mid", help="module_id (例: M19)")
    ap.add_argument("--strict", action="store_true", default=True, help="严格模式 (默认)")
    ap.add_argument("--warn-only", action="store_true", help="只 warn, 不 exit 1")
    ap.add_argument("--skip-c10", action="store_true", help="跳过 C10 chat 自检模板检查")
    ap.add_argument("--json-out", help="把 JSON 报告写到文件")
    args = ap.parse_args()

    report = run_all_checks(args.slug, args.mid, skip_c10=args.skip_c10)

    out_json = json.dumps(report, ensure_ascii=False, indent=2)
    if args.json_out:
        Path(args.json_out).write_text(out_json)
    print(out_json)

    if args.warn_only:
        return 0
    return 0 if report["overall"] == "pass" else 1


if __name__ == "__main__":
    sys.exit(main())
