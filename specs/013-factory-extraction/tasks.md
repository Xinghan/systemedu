# 013-factory-extraction — Tasks

> 每个 task 独立 commit，任一失败可 `git revert`。按顺序执行；标 **(安全点)** 的任务完成后必须 `pytest tests/test_course_factory_v41.py` 全绿才能进下一个。

## Phase 1: 搭骨架（无破坏性）

### T1. 创建 `course_factory/` 目录骨架
- 创建 `course_factory/{runtime,validate/verify,data,tests/{anim,game,theory,knode},fixtures,images}/`
- 创建 `course_factory/__init__.py`（空文件，待 T3 填 re-export）
- 创建 `course_factory/README.md`（短说明 + 指向 `.claude/skills/course_factory/SKILL.md`）
- 不移动任何文件
- **验收**：`ls course_factory/` 看到所有子目录；`pytest` 行为不变
- **Commit**: `chore(course-factory): create component skeleton`

### T2. 创建 `.claude/skills/course_factory/` 和 symlink
- 创建 `.claude/skills/course_factory/` 目录
- 复制 `scripts/COURSE_FACTORY.md` 内容到 `.claude/skills/course_factory/SKILL.md`，在顶部加 YAML frontmatter：
  ```yaml
  ---
  name: course_factory
  description: Generate rich-media course content (animation, game, theory, exercises) for SystemEdu knodes following the factory workflow
  ---
  ```
- 建 symlink: `ln -s ../.claude/skills/course_factory/SKILL.md course_factory/SKILL.md`
- **验收**：
  - `cat course_factory/SKILL.md` 能读出内容
  - `readlink course_factory/SKILL.md` 返回 `../.claude/skills/course_factory/SKILL.md`
  - `diff course_factory/SKILL.md .claude/skills/course_factory/SKILL.md` 空输出
  - **验证 Claude Code 能发现该 skill**（手动确认，必要时回滚用 cp + CI diff）
- **Commit**: `feat(course-factory): register as .claude/skill with symlink`

## Phase 2: 迁移文件（git mv）

### T3. 迁移 factory.py **(安全点)**
- `git mv scripts/course_factory.py course_factory/factory.py`
- `course_factory/__init__.py` 写：
  ```python
  """Course factory: rich-media course content generator.

  Public API re-exported from factory module for convenience:
      from course_factory import make_course_content, save_knode, load_context, ...
  """
  from .factory import *  # noqa: F401, F403
  ```
- 验证 `factory.py` 内的 `ROOT = Path(__file__).resolve().parent.parent` 仍指向项目根（从 `scripts/` 移到 `course_factory/` 都是根下一级，表达式不变）
- 更新 `factory.py` 内的 docstring 示例命令：`python scripts/course_factory.py` → `python -m course_factory`
- 更新 `factory.py` 内注释/错误提示中对 `scripts/course_images`、`scripts/crawl_labxchange_pathways.py` 的硬编码路径
- **验收**：`python -c "from course_factory import make_course_content; print(make_course_content.__module__)"` 打印 `course_factory.factory`
- **验收**：`pytest tests/test_course_factory_v41.py -v` 全绿
- **Commit**: `refactor(course-factory): move factory.py into course_factory package`

### T4. 迁移 runtime 资源
- `git mv scripts/animation_runtime.js course_factory/runtime/animation_runtime.js`
- `git mv scripts/animation_skeleton.html course_factory/runtime/animation_skeleton.html`
- **验收**：`ls course_factory/runtime/` 两个文件都在
- **Commit**: `refactor(course-factory): move animation runtime assets`

### T5. 迁移 validate 子系统
- `git mv scripts/html_validate.mjs course_factory/validate/html_validate.mjs`
- `git mv scripts/html_validate_test.mjs course_factory/validate/html_validate_test.mjs`
- `git mv scripts/playwright.config.mjs course_factory/validate/playwright.config.mjs`
- `git mv scripts/verify course_factory/validate/verify`
- 更新 `validate/html_validate_test.mjs` 内的 glob：`scripts/test_*.html` → `course_factory/tests/**/*.html`
- 更新 `validate/playwright.config.mjs` 内的 testDir（如有）
- **验收**：`node course_factory/validate/html_validate.mjs --help`（或任意调用）不报路径错
- **Commit**: `refactor(course-factory): move validation subsystem`

### T6. 迁移 data 脚本 + course_images
- `git mv scripts/crawl_labxchange_pathways.py course_factory/data/crawl_labxchange_pathways.py`
- `git mv scripts/course_images course_factory/images`
- **验收**：目录已移动，`ls course_factory/data/` `ls course_factory/images/` 非空
- **Commit**: `refactor(course-factory): move data scripts and images`

### T7. 迁移测试产物 HTML（~170 个文件）**(安全点)**
- `git mv scripts/test_anim_*.html course_factory/tests/anim/` （用 shell glob 或逐个）
- `git mv scripts/test_game_*.html course_factory/tests/game/`
- `git mv scripts/test_theory_*.html course_factory/tests/theory/`
- `git mv scripts/test_knode*_*.html course_factory/tests/knode/`
- **验收**：`ls course_factory/tests/anim/ | wc -l` ≈ 75，`tests/game/ ` ≈ 90，`theory/` 4，`knode/` 8
- **验收**：`scripts/` 不再有 `test_*.html`
- **验收**：`pytest tests/test_course_factory_v41.py -v` 全绿
- **Commit**: `refactor(course-factory): relocate ~170 test HTML artifacts`

### T8. 迁移 fixtures（一次性脚本）
- `git mv scripts/_fix_*.py course_factory/fixtures/`
- `git mv scripts/_gen_*.py course_factory/fixtures/`
- 更新 `fixtures/_fix_mars_anims.py` 内对 `scripts/test_anim_*.html` 的引用为 `course_factory/tests/anim/test_anim_*.html`
- **验收**：`scripts/` 不再有 `_fix_*.py` `_gen_*.py`
- **Commit**: `refactor(course-factory): move one-shot fixture scripts`

## Phase 3: 更新引用 **(安全点)**

### T9. 更新 SKILL.md 内部路径（`.claude/skills/course_factory/SKILL.md`）
16 处路径引用全部更新（详见 plan.md § B）：
- `scripts/verify/` → `course_factory/validate/verify/`
- `scripts/animation_skeleton.html` → `course_factory/runtime/animation_skeleton.html`
- `scripts/test_anim_*.html` → `course_factory/tests/anim/*.html`
- `scripts/test_game_*.html` → `course_factory/tests/game/*.html`
- `scripts/test_theory_*` → `course_factory/tests/theory/*`
- `scripts/html_validate.mjs` → `course_factory/validate/html_validate.mjs`
- `scripts/course_factory.py` → `course_factory.factory` (module) 或 `course_factory/factory.py` (file)

因为是 symlink，只需改一次。
- **验收**：`grep -n 'scripts/' .claude/skills/course_factory/SKILL.md` 只剩语义性引用（如 "this is NOT scripts/"），无真实路径
- **Commit**: `docs(course-factory): update path references in SKILL.md`

### T10. 更新 verify/*.mjs 头部注释
- `course_factory/validate/verify/{animation,game,learn_page,db_regression}.mjs` + `_extract_db_html.py`
- 把 `scripts/verify/xxx.mjs` → `course_factory/validate/verify/xxx.mjs`
- **验收**：grep 无 `scripts/verify/` 残留
- **Commit**: `docs(course-factory): update verify/ self-references`

### T11. 更新 gateway static mount
- `src/systemedu/gateway/server.py:3399` 附近：`scripts/course_images` → `course_factory/images`
- **验收**：启动 gateway，访问现有 course 的静态图片 URL 200
- **验收**：`pytest tests/ -v`（gateway 测试全绿）
- **Commit**: `fix(gateway): repoint course_images mount to course_factory/images`

### T12. 更新项目测试文件 docstring
- `tests/test_course_factory_v41.py:1` docstring 改 `scripts/course_factory.py` → `course_factory.factory`
- `tests/test_db_anim_game_regression.py` 内 2 处 `scripts/verify/` 路径改
- **验收**：`pytest tests/ -v` 全绿
- **Commit**: `test: update course-factory test docstrings and paths`

### T13. 更新项目文档
- `README.md:21` `scripts/COURSE_FACTORY.md` → `.claude/skills/course_factory/SKILL.md`
- `docs/prd.md:265` 同上
- `CLAUDE.md` 项目结构树加 `course_factory/`；如有"课程生成流程"段落，指向 `.claude/skills/course_factory/SKILL.md`
- **Commit**: `docs: update course-factory references in README, prd, CLAUDE`

## Phase 4: Shim + 清理

### T14. 写 shim `scripts/course_factory.py`
内容：
```python
"""DEPRECATED shim — import from `course_factory` package instead.

This module re-exports the factory so pre-extraction code paths keep working.
Planned removal: 2026-05-01 (2-week grace period after extraction on 2026-04-15).
"""
import warnings

warnings.warn(
    "scripts/course_factory.py is deprecated; import from course_factory instead",
    DeprecationWarning,
    stacklevel=2,
)

from course_factory import *  # noqa: F401, F403
```
- **验收**：`python -c "from scripts.course_factory import make_course_content"` 能 import 且打印 DeprecationWarning
- **Commit**: `feat(scripts): add deprecation shim for course_factory`

### T15. 更新 memory（`~/.claude/projects/-Users-xinghan-Dev-systemedu/memory/`）
- `MEMORY.md` 顶部 Course Factory 工作流段落：`scripts/course_factory.py` → `course_factory.factory`，`scripts/COURSE_FACTORY.md` → `.claude/skills/course_factory/SKILL.md`
- `project_scripts_debug_keep.md` 内 `scripts/test_anim_*` 等改成 `course_factory/tests/anim/` 等
- 其余 feedback_*.md 内 `scripts/verify/` `scripts/course_factory.py` 引用一并更新
- **验收**：`grep -r 'scripts/course_factory\|scripts/COURSE_FACTORY\|scripts/verify/\|scripts/test_anim\|scripts/test_game' ~/.claude/projects/-Users-xinghan-Dev-systemedu/memory/` 空输出
- **不 commit**（memory 不在仓库）

## Phase 5: 全量验证

### T16. 全量 smoke
- `pytest tests/ -v` 全绿
- `node course_factory/validate/html_validate.mjs course_factory/tests/anim/test_anim_coord_frames.html --mode animation` exit 0
- 启动 gateway + web，访问一个已有 knode 的 learn page，确认 animation + game + 图片正常加载
- **不 commit**（仅验证）

### T17. 最终 grep 审计
- `grep -r 'scripts/course_factory\|scripts/COURSE_FACTORY\|scripts/animation_runtime\|scripts/animation_skeleton\|scripts/html_validate\|scripts/playwright.config\|scripts/verify/\|scripts/crawl_labxchange\|scripts/course_images\|scripts/test_anim\|scripts/test_game\|scripts/test_theory\|scripts/test_knode\|scripts/_fix_\|scripts/_gen_' . --include='*.py' --include='*.md' --include='*.mjs' --include='*.ts' --include='*.tsx'` 返回 **0 结果**（除了 shim 文件本身和 specs/013-factory-extraction/*）
- **不 commit**（仅验证）

## Phase 6: 过渡期结束（2026-05-01 之后）

### T18 [延期]. 删除 shim
- 删除 `scripts/course_factory.py`
- 条件：运行 `git log --since=2026-04-15 --grep='course_factory.py'` 或观察应用日志，确认无 DeprecationWarning 触发 2 周
- **Commit**: `chore: remove deprecated scripts/course_factory.py shim`

---

## 执行建议

- 每个 task 完成后**立即 commit**，不批量累积
- **(安全点)** 的任务后必须验收绿，否则 `git revert` 当前 commit 并排查
- 如果某个 task 的影响面出乎意料（例如 gateway 起不来），停下来不要往下走
- 全流程预计 commit 数：~14 个（T18 在 2 周后单独）
