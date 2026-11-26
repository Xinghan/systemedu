# 队员档案：3D 动画风素材阶段

2026-11-26。用户选择「3D 动画风立绘＋轻微转动」。本批为未接入的美术素材，不是已经完成的角色档案。

- `packages/student-web/public/mission/space/expedition-v2/crew/engineer-3d.png`
- `packages/student-web/public/mission/space/expedition-v2/crew/observer-3d.png`

使用内置 `image_gen.imagegen` 编辑模式，`transparent_background: true`。以同目录原始 `engineer.png` / `observer.png` 为编辑目标；观测员另引用工程师的新图统一渲染风格。原图保留。

提示词意图：保留人物身份、发型、服装颜色、星形徽章与所持器材，将二维线稿转为有柔和皮肤光照、立体头发、织物和金属质感的 3D 动画角色；膝上构图、单人、透明背景，无文字、边框和环境。

工程师原始输出：`/Users/xinghan/.codex/generated_images/01a211c0-fe67-7282-9cd8-4e07a979b716/exec-3dad5cb0-892c-48fe-bcc3-435e7b118745.png`。
观测员原始输出：`/Users/xinghan/.codex/generated_images/01a211c0-fe67-7282-9cd8-4e07a979b716/exec-ca90e184-a22b-45b4-a13b-903ca468a358.png`。

已视觉检查：角色、器材和配色连续；均有 alpha（sips 验证）。工程师 1197×1315，观测员 1199×1312。

随后用户指出恒星观测课程对零基础学生不可跟随，并明确目标为初中生。当前优先做教学路径审计。尚未生成领航员 3D 版本；未修改学生自定义头像；尚未实现档案入口和拖动倾斜，不宣称已安装或验收。
