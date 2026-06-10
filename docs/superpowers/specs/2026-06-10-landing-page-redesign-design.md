# 首页 (landing page) 改造 设计文档

- Status: shipped (2026-06-10)
- 验收结果: 新首页上线 (本地 :4000 验证, 中英双语可切, build 通过, `/` 静态预渲染)。
  GitHub 式长滚动营销页 (一屏一节, 左右文图交替), 5 张手绘水彩插画 (webp 优化, 首屏
  传输 ~266KB), 专业感与儿童趣味平衡。
- 历次迭代: ① 瀑布流 (masonry) → ② 图片压缩 webp → ③ 改为 GitHub 式长滚动分节布局
  (用户需求澄清: 要的是 github.com 首页那种长滚动营销页, 不是瀑布流)。
- Date: 2026-06-10
- 关联: `packages/student-web/src/app/(home)/page.tsx` (整体重写)
- 范围: 仅访客首页 `/` (路由组 `(home)/page.tsx`), 不动 `/home` (登录后 dashboard)

## 1. 背景与目标

旧首页是英文为主、"Fork a real project / Ship it for real" 的开发者仓库叙事
(工程冷感, 跟"10 岁儿童也能做"的亲和力冲突)。本次改造目标:

1. **瀑布流功能介绍** — masonry 错落卡片, 探索感扑面而来
2. **突出天马行空的项目** — 火星探测车 / 复活灭绝动物声音 / 仿生机器鱼
3. **突出 AI agent** — 专门一条聚焦带讲"数学超纲了 agent 接住"
4. **突出 10 岁儿童也能做** — eyebrow + 文案反复强调起步年龄
5. **专业但有儿童元素, 不低龄化** — Industrial Atelier 暖纸色 UI 为骨,
   儿童感靠手绘水彩科普书插画 (不是卡通)

## 2. 决策 (已与用户确认)

1. **语言**: 中英双轨。**首页自带局部语言切换** (组件内 useState 存 zh/en,
   顶部一个 中/EN 切换点)。不动全局 i18n (现有 i18n 是全局变量、非 reactive、
   无切换 UI 的半成品, 动它会波及全站, 超出首页范围)。
2. **瀑布流内容**: 项目卡为主 + 能力卡穿插。
3. **瀑布流布局**: 真 masonry (CSS `column-count`, `break-inside: avoid`),
   错落穿插刻意打破 proj/cap 等高配对, 加图片比例差异 → 列高参差。
4. **项目数据**: 策展 (从 `~/Dev/systemeduidea/projects` 33 个即将生成的项目里挑),
   全标"即将上线"、点击不跳真页 (避免 404); 真实入口靠 Hero 的 [浏览全部项目] → `/library`。
5. **图片**: 5 张手绘水彩科普书插画风 (David Macaulay "The Way Things Work" 风格,
   钢笔线稿 + 暖水彩 + 米白底 + 虚线标注), 用户用外部大模型生成, 落 `public/landing/`。
6. **视觉风格**: 专业为骨 + 手绘点缀。整体 Industrial Atelier 暖纸色不变。

## 3. 页面骨架 (GitHub 式长滚动, 一屏一节)

```
TopNav (复用 StudentHeader)
① Hero          — 居中超大标题 + 副文 + 双 CTA (免费开始 / 浏览全部项目)
                  + 大 hero 插画 + mono 信任条; 右上角 中/EN 语言切换
② AI agent 节    — 左文 / 右图 (agent.webp), 招牌功能打头
③ 真硬件真数据 节 — 右文 / 左图 (mars-rover.webp), 浅色底块 (paper-2)
④ 知识树 节       — 左文 / 右图 (robot-fish.webp)
⑤ 项目展示 节     — 浅色底, 居中标题 + 3 项目卡一行 (火星车/灭绝声音/机器鱼)
⑥ How it works   — 4 步 (挑一个 → 跟着学(AI 陪) → 动手造 → 发布作品)
⑦ 大 CTA 节       — 珊瑚渐变块, 居中"准备好造点真东西了吗" + 按钮
⑧ Footer        — 品牌 + 3 列链接
```

每节宽屏 (max-width 1100)、上下大留白 (padding 72px)、左右文图交替, 滚动逐节展开 —
即 github.com 首页的节奏。功能节用 `<FeatureSection imgSide="left|right" tinted?>` 复用。

## 4. 策展项目 (3 个) + 图片

| slug | 领域 | 年龄 | 图片 | hook (zh) |
|------|------|------|------|-----------|
| `mars-analog-rover` | Aerospace | 10-12 | mars-rover.png | 用 NASA HiRISE 真实火星影像训练你的越野探测车 |
| `extinct-species-soundscape` | CS | 10-12 | extinct-sound.png | 用 AI 从骨骼与近亲重建灭绝动物的叫声 |
| `bioinspired-sofi-fish` | Robotics | 13-15 | robot-fish.png | 造一条会游的软体机器鱼做池塘生态调查 |

图片落位 `packages/student-web/public/landing/`:
`hero.png` (Hero 横图) / `mars-rover.png` / `extinct-sound.png` / `robot-fish.png` /
`agent.png` (聚焦带横图)。

## 5. 能力卡 (3 个, 穿插)

1. **AI agent 随时教** (coral) — 卡住/报错/数学超纲, agent 就地讲清那一块
2. **真硬件 · 真数据 · 真标准** (climate) — 真实传感器、NASA/EPA 级数据集、学界标准库
3. **像树一样长的知识** (robotics) — 知识树 DAG, 需要什么解锁什么, 非线性课程

## 6. 实现要点

- 全文案 zh/en 双份存 `COPY` 常量, `lang` state 切换, `t = COPY[lang]`。
- masonry 用 `<style jsx>` 响应式 column-count: 3 (桌面) / 2 (≤1000) / 1 (≤640)。
- 难度用 5 个 SVG 圆点表示 (遵守 CLAUDE.md 禁 emoji / ★ 等 Unicode 符号)。
- 图片用 `next/image` fill + objectFit cover, hero priority。
- 项目卡 `live` 字段控制是否可点进 `/library/<slug>` (当前全 false)。

## 7. 非目标

- 不改全局 i18n 体系 (本次只首页局部切换)。
- 不动 `/home` dashboard 与其他页面。
- 项目卡暂不接真实 library API (策展静态数据); 真实入口在 [浏览全部项目] 按钮。
