# scripts/

复用小工具 (从 5 试点沉淀)。这些是**起点模板**, 每个项目按需改。

- `check_js.mjs <html>` — vm 编译校验 HTML 内每个 `<script>` 块的语法 (不运行, 无需 DOM)。
  内联大块 three.js / 引擎前后各跑一次, 快速抓语法错。
  用: `node check_js.mjs .../<slug>_3D.html`

- `inline_template.mjs <html> <three.js> [engine.js] [textures.js]` — 通用注入器:
  把 three r149 UMD + 可选引擎 + 可选纹理注入带 marker 的 HTML。
  base64 里的 `$` 用函数式 replace 规避。用前改顶部 `EXPORTS` 为要暴露给 e2e 的符号。
  three.js UMD 全文首次从任一已验收 `course_factory/tests/project_game/*_3D.html` 抽出存 `three_reuse.js`。

引擎 node 单测骨架、Playwright e2e 骨架见 `../references/verification.md` (照抄改断言)。
