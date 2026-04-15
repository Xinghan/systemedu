# course_factory

SystemEdu 的富媒体课程内容生成组件。包含：

- `factory.py` — 核心 Python 库，提供 `load_context` / `make_course_content` / `save_knode` 等 API
- `runtime/` — animation 运行时（skeleton HTML + JS runtime）
- `validate/` — HTML/代码验证器与 Playwright 配置
- `data/` — 外部数据爬取（LabXchange 等）
- `tests/` — 历次生成的 animation / game / theory / knode 测试产物
- `fixtures/` — 一次性修复与生成脚本
- `images/` — 图片产物（挂载到 gateway 作为静态资源）

**Skill 手册**：`.claude/skills/course_factory/SKILL.md`（本目录下的 `SKILL.md` 是 symlink 指向它）。

**用法**：
```python
from course_factory import load_context, make_course_content, save_knode
```

Claude Code 会自动加载 `.claude/skills/course_factory/SKILL.md` 作为 skill。详细创作流程见手册。
