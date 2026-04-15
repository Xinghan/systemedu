# 013-factory-extraction

**Status**: approved (ready for plan)
**Owner**: xinghan
**Created**: 2026-04-15

## 背景 / 问题

Course Factory 目前以**散落文件形式**共存于 `scripts/` 目录：

- `scripts/COURSE_FACTORY.md`（2200 行手册）
- `scripts/course_factory.py`（2000 行 Python 库）
- `scripts/animation_runtime.js` / `animation_skeleton.html`（animation 运行时）
- `scripts/html_validate.mjs` / `html_validate_test.mjs` / `playwright.config.mjs`（验证器）
- `scripts/verify/*.mjs` + `_extract_db_html.py`（复用验证脚本）
- `scripts/crawl_labxchange_pathways.py`（数据爬取）
- `scripts/course_images/`（图片产物）
- `scripts/test_anim_*.html` + `test_game_*.html` + `test_theory_*.html` + `test_knode*_*.html`（~170 个测试产物）
- `scripts/_fix_*.py` / `_gen_*.py`（一次性修复/生成脚本）

**问题**：
1. **心智负担重** —— scripts/ 里既有 deploy/restart 等运维脚本，也有 course-factory 体系，还有 v4.1 fixture；新人打开 scripts/ 一头雾水，不知道哪些是生产工具哪些是创作工具
2. **不是 Claude Code 原生 skill** —— `COURSE_FACTORY.md` 本质是 skill 手册（Claude Code 按手册执行），但没有以 `.claude/skills/<name>/SKILL.md` 的规范形式存放，无法被 Claude Code 自动发现和复用
3. **工具函数与运行时耦合** —— `course_factory.py` 同时包含 DB 工具、research 工具、labxchange 搜索、preflight、audio 生成等，但文件路径常量写死了 `scripts/` 前缀，不利于独立演进
4. **与 superpower 纪律不对齐** —— SystemEdu 主干应遵循 speckit，course-factory 作为一个相对独立的 workflow 应该作为独立 component 存在，而不是主干的一部分

## 目标（WHAT）

把 Course Factory 从 `scripts/` 抽取成一个**独立、自包含的 component**，放在项目根目录 **`course_factory/`**（underscore，Python 合法 package 名；同步用户指示 2026-04-15），同时把它以 Claude Code `SKILL.md` 格式注册到 `.claude/skills/course_factory/`，使它：

1. 成为 Claude Code 的一等 skill（`.claude/skills/course_factory/SKILL.md` 为权威版本，`course_factory/SKILL.md` 作为 **symlink** 指向它，零同步成本）
2. 所有相关资源（手册、Python 库、运行时、验证器、测试产物、一次性修复脚本、图片产物）集中在 `course_factory/` 顶层目录下，清晰可见
3. 对外暴露的 API 稳定 —— 旧路径 `scripts/course_factory.py` 保留**过渡期 shim**（`from course_factory.factory import *`）直到确认无调用方 1-2 周后再删
4. 主干 `scripts/` 回归"运维 + 一次性工具"定位，只含 `deploy.sh` `restart.sh` `server-ssh.sh` `linux_system_deps.sh` `import_kt_json.py` 这类真正的工程脚本

## 非目标（不做什么）

- **不重写 course_factory.py 的业务逻辑** —— 只做路径迁移和最小适配，行为不变
- **不改动 COURSE_FACTORY.md 的内容结构** —— 只更新其中的路径引用（`scripts/xxx` → 新路径）
- **不拆分 course_factory.py 为多个子模块** —— 虽然它有 2000 行可以拆，但那是独立工程，不在本次范围
- **不动 `animation_game_design/` `knowledge_base_doc/` `stitch_systemedu_dashboard/`** —— 它们是用户管理的素材目录，保持在根目录
- **不废除任何现有 API** —— `load_context` `make_course_content` `save_knode` 等签名保持不变

## 用户故事 / 场景

### S1: Claude Code 创作一节课
**当前**：用户 `/clear` 后让 Claude Code 读 `scripts/COURSE_FACTORY.md`，再 import `scripts.course_factory`
**目标**：Claude Code 自动加载 `.claude/skills/course_factory/SKILL.md` 作为 skill，import 从 `course_factory` package 走

### S2: 新人找"deploy.sh 在哪"
**当前**：`ls scripts/` 返回 223 个文件，deploy 混在 200+ 测试产物里，难找
**目标**：`ls scripts/` 只剩 ~5 个运维脚本，一眼可见

### S3: 维护 factory 自身
**当前**：想给 factory 加 test，但 `scripts/` 已有 `tests/test_course_factory_v41.py` 又在项目 `tests/` 下，来回跳
**目标**：`course_factory/tests/` 下集中，或明确 factory 测试归属

### S4: 开新项目复用 factory
**当前**：factory 深度耦合在 systemedu 仓库，想用到别的教育项目得 copy scripts/
**目标**：factory 目录结构像独立 package，未来可单独 pip 包化（本次不做，但不堵死路径）

## 验收标准

### 结构
- [ ] `course_factory/` 目录存在（underscore，可作 Python package），包含 SKILL.md（symlink）、__init__.py、factory.py、runtime/、validate/、data/、tests/、fixtures/、images/
- [ ] `.claude/skills/course_factory/SKILL.md` 存在且为 Claude Code 有效 skill 格式（YAML frontmatter + markdown body），是权威版本
- [ ] `course_factory/SKILL.md` 是 symlink 指向 `../.claude/skills/course_factory/SKILL.md`（`readlink course_factory/SKILL.md` 返回正确目标）
- [ ] `scripts/` 内**不再有** `COURSE_FACTORY.md` `animation_runtime.js` `animation_skeleton.html` `html_validate*.mjs` `playwright.config.mjs` `verify/` `crawl_labxchange_pathways.py` `course_images/` `test_anim_*` `test_game_*` `test_theory_*` `test_knode*_*` `_fix_*.py` `_gen_*.py`
- [ ] `scripts/course_factory.py` 保留为过渡期 shim（`from course_factory.factory import *`），注释标注 deprecated + 删除日期目标
- [ ] `scripts/` 内仍保留 `deploy.sh` `restart.sh` `server-ssh.sh` `linux_system_deps.sh` `import_kt_json.py`

### 功能不回归
- [ ] `python -m pytest tests/test_course_factory_v41.py -v` 全部通过
- [ ] Claude Code 按迁移后 SKILL.md 可以完整走一个 knode 流程（load_context → make_course_content → save_knode）
- [ ] Gateway API `/api/projects/<name>/lessons/<id>` 仍能读到已生成的课程内容
- [ ] `course_images` 静态文件挂载路径在 gateway 中仍可访问（或路径已更新且前端不 404）

### 引用更新
- [ ] 全仓库 grep `scripts/course_factory` `scripts/COURSE_FACTORY` `scripts/animation_` `scripts/html_validate` `scripts/verify/` `scripts/crawl_` `scripts/course_images` `scripts/test_anim_` `scripts/test_game_` 都**无遗漏**地更新
- [ ] MEMORY.md 内 `scripts/course_factory.py` / `scripts/COURSE_FACTORY.md` 路径更新
- [ ] README.md / docs/prd.md / CLAUDE.md 路径更新

### 回滚
- [ ] 迁移在 git 中分步 commit（至少：创建新目录 / 移动文件 / 更新引用 / 清理旧路径），任一步骤失败可 `git revert` 到前一个稳定状态

## 风险与备选

**主要风险**：路径替换遗漏 —— 某个代码分支或动态 import 使用字符串拼接路径，grep 抓不到，运行时才 500

**缓解**：
- 完成引用更新后运行全量 pytest + 跑一次完整 course-factory 流程作为 smoke
- 保留旧路径 shim（`scripts/course_factory.py` 文件 `from course_factory.factory import *`）直到运行 1-2 周无问题再删

**备选方案（未采用）**：
1. **原地改名不抽取** —— 在 scripts/ 加 `course_factory/` 子目录，其它全挪进去。优点：影响面小；缺点：SKILL.md 仍不在 .claude/skills/ 下，Claude Code skill 规范不满足
2. **拆 course_factory.py 为多模块** —— 见"非目标"，另起 spec 做
