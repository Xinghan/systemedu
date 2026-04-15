# 013-factory-extraction — Plan

## 目标目录结构

```
systemedu/
├── course_factory/                       # 新 component，项目根
│   ├── SKILL.md                          # 手册副本（内容 == .claude/skills/course_factory/SKILL.md）
│   ├── README.md                         # 简要说明 + 指向权威 SKILL
│   ├── factory.py                        # <- scripts/course_factory.py（文件名改短）
│   ├── __init__.py                       # re-export factory.py 全部 public API
│   ├── runtime/
│   │   ├── animation_runtime.js          # <- scripts/animation_runtime.js
│   │   └── animation_skeleton.html       # <- scripts/animation_skeleton.html
│   ├── validate/
│   │   ├── html_validate.mjs             # <- scripts/html_validate.mjs
│   │   ├── html_validate_test.mjs        # <- scripts/html_validate_test.mjs
│   │   ├── playwright.config.mjs         # <- scripts/playwright.config.mjs
│   │   └── verify/                       # <- scripts/verify/ 整个目录
│   │       ├── animation.mjs
│   │       ├── game.mjs
│   │       ├── learn_page.mjs
│   │       ├── db_regression.mjs
│   │       └── _extract_db_html.py
│   ├── data/
│   │   └── crawl_labxchange_pathways.py  # <- scripts/crawl_labxchange_pathways.py
│   │                                     # （输出仍写到 knowledge_base_doc/，保持不动）
│   ├── tests/                            # 产物测试 HTML
│   │   ├── anim/                         # <- scripts/test_anim_*.html
│   │   ├── game/                         # <- scripts/test_game_*.html
│   │   ├── theory/                       # <- scripts/test_theory_*.html
│   │   └── knode/                        # <- scripts/test_knode*_*.html
│   ├── fixtures/                         # 一次性脚本
│   │   ├── _fix_mars_anims.py
│   │   ├── _fix_mars_games.py
│   │   ├── _fix_rocket_games.py
│   │   ├── _gen_atom_lego.py
│   │   ├── _gen_beta_sheet.py
│   │   └── _gen_protein_structure.py
│   └── images/                           # <- scripts/course_images/
│
├── .claude/skills/course_factory/
│   └── SKILL.md                          # <- scripts/COURSE_FACTORY.md（权威版本，YAML frontmatter 包装）
│
├── scripts/                              # 精简后：运维 + 一次性工具
│   ├── deploy.sh
│   ├── restart.sh
│   ├── server-ssh.sh
│   ├── linux_system_deps.sh
│   ├── import_kt_json.py
│   └── course_factory.py                 # 过渡期 shim（`from course_factory.factory import *`）
```

## 路径映射表（精确 git mv）

| From | To |
|------|-----|
| `scripts/COURSE_FACTORY.md` | `.claude/skills/course_factory/SKILL.md`（需加 YAML frontmatter）|
|  | `course_factory/SKILL.md`（副本）|
| `scripts/course_factory.py` | `course_factory/factory.py` |
| `scripts/animation_runtime.js` | `course_factory/runtime/animation_runtime.js` |
| `scripts/animation_skeleton.html` | `course_factory/runtime/animation_skeleton.html` |
| `scripts/html_validate.mjs` | `course_factory/validate/html_validate.mjs` |
| `scripts/html_validate_test.mjs` | `course_factory/validate/html_validate_test.mjs` |
| `scripts/playwright.config.mjs` | `course_factory/validate/playwright.config.mjs` |
| `scripts/verify/` (整目录) | `course_factory/validate/verify/` |
| `scripts/crawl_labxchange_pathways.py` | `course_factory/data/crawl_labxchange_pathways.py` |
| `scripts/course_images/` | `course_factory/images/` |
| `scripts/test_anim_*.html` | `course_factory/tests/anim/` |
| `scripts/test_game_*.html` | `course_factory/tests/game/` |
| `scripts/test_theory_*.html` | `course_factory/tests/theory/` |
| `scripts/test_knode*_*.html` | `course_factory/tests/knode/` |
| `scripts/_fix_*.py` | `course_factory/fixtures/` |
| `scripts/_gen_*.py` | `course_factory/fixtures/` |

`scripts/course_factory.py` 是一个**新写**的 shim 文件（不是 git mv 的目标）。

## 引用更新（59 处，16 个文件）

按受影响文件分类：

### A. factory.py 内部路径常量（7 处）
`scripts/course_factory.py` 内多处硬编码 `scripts/course_factory.py` `scripts/course_images` `scripts/crawl_labxchange_pathways.py`。迁移到 `course_factory/factory.py` 后：
- `_LABXCHANGE_INDEX_PATH = ROOT / "knowledge_base_doc" / "labxchange_pathways.json"` — `ROOT` 需从 `Path(__file__).resolve().parent.parent`（scripts 上一级）改成 `Path(__file__).resolve().parent.parent`（course-factory 上一级）—— **变化相同，无需改代码**，但需要验证
- docstring 中 `python scripts/course_factory.py "..."` → `python -m course_factory "..."` 或 `python course_factory/factory.py "..."`
- 图片路径注释 `scripts/course_images/` → `course_factory/images/`
- 错误提示 `"运行 python scripts/crawl_labxchange_pathways.py"` → `"运行 python course_factory/data/crawl_labxchange_pathways.py"`

### B. SKILL.md (原 COURSE_FACTORY.md) 内部引用（16 处）
- `scripts/verify/animation.mjs` → `course_factory/validate/verify/animation.mjs`
- `scripts/verify/game.mjs` → `course_factory/validate/verify/game.mjs`
- `scripts/verify/learn_page.mjs` → `course_factory/validate/verify/learn_page.mjs`
- `scripts/animation_skeleton.html` → `course_factory/runtime/animation_skeleton.html`
- `scripts/test_anim_*.html` → `course_factory/tests/anim/*.html`
- `scripts/test_game_*.html` → `course_factory/tests/game/*.html`
- `scripts/test_theory_friction.html` → `course_factory/tests/theory/test_theory_friction.html`
- `scripts/test_anim_runtime_demo.html` → `course_factory/tests/anim/test_anim_runtime_demo.html`
- `scripts/html_validate.mjs` → `course_factory/validate/html_validate.mjs`
- `scripts/course_factory.py` → `course_factory.factory` (module) 或 `course_factory/factory.py`（文件路径）

额外加 YAML frontmatter：
```yaml
---
name: course-factory
description: Generate rich-media course content (animation, game, theory, exercises) for SystemEdu knodes following the factory workflow
---
```

### C. verify/*.mjs 内 usage 文案（9 处）
每个 `scripts/verify/xxx.mjs` 的头部注释和 error message 有自引用。只改字符串提示，不影响功能。

### D. tests/ 相关（3 处）
- `tests/test_course_factory_v41.py:1` docstring `"Tests for scripts/course_factory.py"` → `"Tests for course_factory.factory"`
- `tests/test_db_anim_game_regression.py` 2 处运行命令字符串

### E. 下游代码（1 处）
- `src/systemedu/gateway/server.py:3399` — `course_images` 静态文件挂载。需要把 `scripts/course_images` 路径常量改成 `course_factory/images`

### F. 文档（3 处）
- `README.md:21` `scripts/COURSE_FACTORY.md` → `.claude/skills/course_factory/SKILL.md`
- `docs/prd.md:265` 同上
- `CLAUDE.md` 项目结构树 + Development Loop 段落

### G. Memory（~5 处）
`~/.claude/projects/-Users-xinghan-Dev-systemedu/memory/MEMORY.md` 及下面的 feedback_*.md 引用 `scripts/course_factory.py` `scripts/COURSE_FACTORY.md`。

### H. Shim 文件（新写）
`scripts/course_factory.py`：
```python
"""DEPRECATED shim — prefer `from course_factory.factory import *`.

This module re-exports the factory so pre-extraction code paths keep working.
Planned removal: 2026-05-01 (2-week grace period after extraction on 2026-04-15).
"""
import warnings
warnings.warn(
    "scripts/course_factory.py is deprecated; import from course_factory.factory instead",
    DeprecationWarning,
    stacklevel=2,
)
from course_factory.factory import *  # noqa: F401,F403
```

## import 路径策略

**已决策（2026-04-15）**：用 underscore 目录 `course_factory/`，Python 标准 package。

- 目录：`course_factory/`（Python 合法 package 名，同时也作用户可见的 component 目录）
- `course_factory/__init__.py`: `from .factory import *`（暴露公共 API）
- `course_factory/factory.py`: 原 `scripts/course_factory.py` 全部代码
- 调用方 import: `from course_factory import make_course_content, save_knode, ...`
- `.claude/skills/course_factory/SKILL.md`: Claude Code skill 目录也跟着 underscore，保持全局一致

Skill frontmatter `name: course_factory`（与目录同名）。

## 风险与回滚

| 风险 | 缓解 |
|------|------|
| `course_factory/factory.py` 内 `ROOT` 常量跨目录迁移后指向错误 | 迁移后立刻跑 `pytest tests/test_course_factory_v41.py`；必要时显式改成 `ROOT = Path(__file__).resolve().parent.parent` 并验证 |
| Gateway mount 路径写死 `scripts/course_images`，迁移后前端图片 404 | Task C 专门处理这一改动 + smoke 测一个已有 knode 的图片加载 |
| SKILL.md 两份内容漂移 | **已决策：用 symlink**。`course_factory/SKILL.md -> ../.claude/skills/course_factory/SKILL.md`（git 支持 symlink，零同步成本）。Task 中需验证 Claude Code 读 symlink 正常 |
| 外部调用方（未在 grep 范围）依赖旧路径 | shim 打 DeprecationWarning；搜集 1-2 周运行日志 |
| `test_anim_*` 数量太大（~170 文件），playwright discovery 路径写死 | `html_validate_test.mjs` 内 glob 从 `scripts/test_*.html` 改成 `course_factory/tests/**/*.html` |

## 回滚

每个 Task 单独 commit（见 tasks.md）。任一 task 失败：
```bash
git revert <commit-sha>
```
因为只是文件移动 + 字符串替换，revert 无逻辑冲突。

## 验证策略

每个 task 完成后：
1. `pytest tests/test_course_factory_v41.py -v` 必须全绿
2. `pytest tests/ -v` 全量（最后 task 才强制）
3. 跑一次 `node course_factory/validate/html_validate.mjs course_factory/tests/anim/test_anim_coord_frames.html --mode animation` smoke
4. 启动 gateway，访问 `/static/course_images/<已有 knode>/...` 确认图片 200

## 开放问题

（全部已在 2026-04-15 决策完毕，见上文 "import 路径策略" 与 "风险与回滚" 表格）
