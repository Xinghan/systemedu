"""5.5a Code Review — fogsight 风格精简版 (v3 锁定后)。

只保留**真正会让 HTML 跑不起来**的硬约束, 风格 / 偏好 / "更好的写法" 全部由 LLM 自由发挥。

5 条核心规则:
1. 单文件自包含 (<!DOCTYPE...></html>)
2. body overflow:hidden + height:100vh (一屏不滚)
3. 双语 (有 langBtn / I18N / data-lang / data-zh / data-en 任一)
4. canvas 不能硬编码 < 600px 尺寸 (在大屏 iframe 中会很小)
5. window 同名变量禁顶层 var (history/location/name/status/event/length 等会破坏全局)

去掉的旧规则 (与 fogsight 自由风格冲突):
- 0px 圆角 (允许任意圆角)
- 禁 onclick 属性 (LLM 自选 onclick / addEventListener 都可)
- 禁 setInterval (允许 setInterval 用于数字定时更新)
- 禁 calc(100vh-Npx) (Tailwind utility 等都允许)
- lang-btn 必须在 sidebar (anim 不需要 sidebar)
- Math.min canvas 上限 (检测假阳性多)
- 字体限定 Space Grotesk/Inter (允许 Tailwind utility)
"""

from __future__ import annotations

import re

from .base import Gate, GateResult
from ..progress import STEP_GATE_A


class CodeReviewGate(Gate):
    name = STEP_GATE_A
    max_revise = 3

    async def run(self, *, html: str | None, idea, ctx, attempt: int = 1) -> GateResult:
        if not html:
            return GateResult("fail", ["empty html"], attempt=attempt)
        issues: list[str] = []

        # 1. 单文件自包含
        if "<!DOCTYPE" not in html or "</html>" not in html:
            issues.append("必须是单文件自包含 HTML (<!DOCTYPE html>...</html>)")

        # 2. body overflow:hidden + height (允许 Tailwind h-screen / overflow-hidden 等价)
        has_overflow = (
            re.search(r"body\s*\{[^}]*overflow\s*:\s*hidden", html)
            or re.search(r"html\s*,?\s*body[^{]*\{[^}]*overflow\s*:\s*hidden", html)
            or re.search(r"<body[^>]*class=\"[^\"]*overflow-hidden", html)
            or re.search(r"<html[^>]*class=\"[^\"]*overflow-hidden", html)
        )
        if not has_overflow:
            issues.append("body 必须 overflow:hidden 防滚 (用 CSS 或 Tailwind overflow-hidden 都行)")

        has_full_height = (
            re.search(r"body\s*\{[^}]*height\s*:\s*100vh", html)
            or re.search(r"html\s*,?\s*body[^{]*\{[^}]*height\s*:\s*100vh", html)
            or re.search(r"min-height\s*:\s*100vh", html)
            or re.search(r"height\s*:\s*100%[^;]*;[^}]*\}[\s\S]*?html", html[:5000])
            or "h-screen" in html  # Tailwind h-screen 任何位置都算
            or "min-h-screen" in html
            or re.search(r"\bclass\s*=\s*\"[^\"]*\bh-\[100vh\]", html)
        )
        if not has_full_height:
            issues.append("必须设 height:100vh / min-height:100vh / Tailwind h-screen / min-h-screen (一屏内布局)")

        # 3. 双语 (任一标志, 包括 fogsight "同时显示两段文字" 模式)
        has_lang_widget = any(s in html for s in [
            "langBtn", "I18N", "data-lang", "data-zh", "data-en",
            "AnimRuntime.t", "LANG ", "currentLang",
        ])
        # fogsight 模式: setSubtitle('中文', 'English') 同时显示, 不切换
        has_lang_pair = bool(re.search(r"setSubtitle\s*\(\s*['\"][^'\"]*[一-龥]", html))
        # 通用兜底: 中文 + 英文同时存在 ≥ 200 字, 算双语
        cn_chars = len(re.findall(r"[一-龥]", html))
        en_words = len(re.findall(r"\b[A-Za-z]{3,}\b", html))
        has_bilingual_text = cn_chars > 100 and en_words > 80
        if not (has_lang_widget or has_lang_pair or has_bilingual_text):
            issues.append("必须双语 (langBtn / I18N / data-zh+data-en / setSubtitle(zh,en) / 中英文文本同时存在 任一)")

        # 4. canvas 硬编码 < 600px 尺寸
        canvas_attr = re.search(r'<canvas[^>]*\bwidth\s*=\s*["\']?(\d+)', html)
        if canvas_attr:
            w = int(canvas_attr.group(1))
            if w < 600:
                issues.append(f'<canvas width="{w}"> 硬编码尺寸 (< 600px), 在大屏 iframe 中会很小, 应用 JS resize')

        # 5. window 同名顶层 var (会覆盖 window 属性导致 game/anim 跑挂)
        forbidden_names = [
            "history", "location", "name", "status", "origin",
            "parent", "top", "self", "length", "event",
            "closed", "opener", "frames", "outerWidth", "outerHeight",
        ]
        for n in forbidden_names:
            pat = re.compile(rf"^\s*(var|let|const)\s+{n}\s*=", re.MULTILINE)
            if pat.search(html):
                issues.append(f"禁止用 window 同名变量 `{n}` 做顶层声明 (会覆盖 window 属性)")

        # 6. 必须有左侧 sidebar (.sidebar / .game-sidebar / class 含 sidebar)
        has_sidebar = bool(re.search(
            r'class\s*=\s*["\'][^"\']*\b(?:sidebar|game-sidebar)\b',
            html,
        ))
        if not has_sidebar:
            issues.append(
                "必须有左侧栏 (class 含 'sidebar' 或 'game-sidebar'), "
                "anim/game 都需要在左侧栏放标题/说明/lang 切换按钮"
            )

        # 7. 必须有 lang 切换按钮 (#langBtn 或类似)
        has_lang_button = bool(re.search(
            r'(?:id|class)\s*=\s*["\'][^"\']*\b(?:langBtn|lang-btn|lang_btn)\b',
            html,
        )) or "<button" in html and ("EN" in html or "中文" in html)
        if not has_lang_button:
            issues.append(
                "必须有 lang 切换按钮 (id='langBtn' 或 class 含 'lang-btn', "
                "或任何按钮文字含 EN/中文), 放在 sidebar 内"
            )

        verdict = "pass" if not issues else "fail"
        return GateResult(verdict=verdict, issues=issues, attempt=attempt)
