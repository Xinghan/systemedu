"""5.5a Code Review — 静态正则检测 SKILL §1404-1428 的 19 条硬约束 + §1751-1769 自检清单。

无 LLM,纯正则,fast。
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

        # F.17.1 单文件自包含
        if "<!DOCTYPE" not in html or "</html>" not in html:
            issues.append("F.17.1: 必须是单文件自包含 HTML (<!DOCTYPE html>...</html>)")

        # F.17.2 body overflow
        if not re.search(r"body\s*\{[^}]*overflow\s*:\s*hidden", html):
            issues.append("F.17.2: body 必须设 overflow:hidden")
        if not re.search(r"body\s*\{[^}]*height\s*:\s*100vh", html):
            # 也许在 html,body 一起设
            if not re.search(r"html\s*,?\s*body[^{]*\{[^}]*height\s*:\s*100vh", html):
                issues.append("F.17.2: body/html 必须设 height:100vh")

        # F.17.7 0px 圆角 (检查至少有 border-radius:0 出现, 反向: 出现非 0 圆角警告)
        positive_radius = re.findall(r"border-radius\s*:\s*([1-9]\d*)\s*px", html)
        if positive_radius:
            issues.append(f"F.17.7: 检测到非 0 圆角 border-radius={positive_radius[:3]}px,SKILL 要求 0px")

        # F.17.11 禁止 onclick="..."
        onclick_attrs = re.findall(r'\bonclick\s*=\s*["\'][^"\']+["\']', html)
        if onclick_attrs:
            issues.append(f"F.17.11: 禁止 onclick 属性 (找到 {len(onclick_attrs)} 处),改用 addEventListener")

        # F.17.12 禁止 calc(100vh - Npx)
        if re.search(r"calc\s*\(\s*100vh\s*-", html):
            issues.append("F.17.12: 禁止 calc(100vh - Npx),改用 flex 布局")

        # F.17.13 禁止 canvas 硬编码尺寸上限
        canvas_attr = re.search(r'<canvas[^>]*width\s*=\s*["\']?(\d+)', html)
        if canvas_attr:
            w = int(canvas_attr.group(1))
            if w < 600:
                issues.append(f"F.17.13: <canvas width=\"{w}\"> 硬编码尺寸 (太小),应用 JS resize")

        size_caps = re.findall(r"Math\.min\s*\(\s*[^,)]+,\s*(\d+)\s*\)", html)
        for cap in size_caps:
            cap_v = int(cap)
            if 80 <= cap_v < 600:
                # 简单判断: 数值在尺寸合理范围内
                idx = html.find(f", {cap}")
                if idx > 0:
                    context = html[max(0, idx - 80):idx + 20].lower()
                    if any(kw in context for kw in ["sz", "size", "width", "height", "canvas", "availw", "availh"]):
                        issues.append(f"F.17.13: Math.min(..., {cap_v}) 硬编码 canvas 尺寸上限")
                        break

        # F.17.15 禁止 setInterval
        if re.search(r"\bsetInterval\s*\(", html):
            issues.append("F.17.15: 禁止 setInterval,改用 requestAnimationFrame")

        # F.18.5 lang-btn 禁 position:fixed/absolute
        # 找 lang-btn 选择器附近的 CSS
        lang_btn_css = re.search(r"(\.lang-btn|\.sidebar-lang|#langBtn)\s*\{[^}]*\}", html)
        if lang_btn_css:
            css_block = lang_btn_css.group(0)
            if re.search(r"position\s*:\s*(fixed|absolute)", css_block):
                issues.append("F.18.5: lang-btn 禁止 position:fixed/absolute,必须在 sidebar 内")

        # F.17.19 禁止 window 同名变量做顶层 var
        # 仅检测明确的顶层 var/let/const X = (非函数调用)
        forbidden_names = ["history", "location", "name", "status", "origin",
                            "parent", "top", "self", "length", "event",
                            "closed", "opener", "frames", "outerWidth", "outerHeight"]
        for name in forbidden_names:
            # 只匹配脚本块内的顶层声明,避免误命中 obj.name 这类
            pat = re.compile(rf"^\s*(var|let|const)\s+{name}\s*=", re.MULTILINE)
            if pat.search(html):
                issues.append(f"F.17.19: 禁止用 window 同名变量 `{name}` 做顶层声明 (会覆盖 window 属性)")

        # F.17.16 i18n 双语 — 必须有 langBtn / I18N / LANG (任一即可)
        has_lang = ("langBtn" in html or "I18N" in html or
                    "AnimRuntime.t" in html or re.search(r"\bLANG\s*=\s*['\"]cn", html))
        if not has_lang:
            issues.append("F.17.16: 必须 i18n 双语 (langBtn / I18N / AnimRuntime.t / LANG='cn')")

        # F.17.5 字体 (skeleton 已设, 但若 LLM 改了就 warn)
        if "Space Grotesk" not in html and "Inter" not in html and "Noto Sans" not in html:
            issues.append("F.17.5: 字体应为 Space Grotesk + Inter/Noto Sans SC")

        verdict = "pass" if not issues else "fail"
        return GateResult(verdict=verdict, issues=issues, attempt=attempt)
