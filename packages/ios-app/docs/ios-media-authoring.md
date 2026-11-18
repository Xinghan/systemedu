# iOS 动画与游戏独立生成

用户截图中的脑波动画保留了桌面双栏、固定侧栏和双语长段落，在竖屏里挤压了核心画面。这类内容需要重新设计手机交互，而不是改入口名称、缩小网页或要求横屏。本次建立生成技能和独立资源接入方式，尚未批量重做课程资源。

## 使用入口

- [ios-course-animation](../../../../systemeduidea/.agents/skills/ios-course-animation/SKILL.md)：按概念设计手机动画，包含播放、逐步推演、参数控制和过程解释。
- [ios-course-game](../../../../systemeduidea/.agents/skills/ios-course-game/SKILL.md)：按知识目标设计触控游戏，要求可检验的规则、成功与失败过程、反馈及重试。
- [共用约定](../../../../systemeduidea/course_factory/references/ios-mobile-interactions.md)：竖屏布局、离线运行、版本、状态和手机验收。

规范源保存在 `systemeduidea/.agents/skills/`，通过软链接安装到本机 `~/.codex/skills/`，并在 `course_factory/SKILL.md` 中增加分流入口。可以明确调用 `$ios-course-animation` 或 `$ios-course-game`；若当前会话的技能列表没有即时刷新，直接读取对应文件即可，不必重新安装。

一次生成以指定课节和资源为单位。读取原课文与科学事实，沿用 `idea_id`；产物独立保存到 `<knode_dir>/mobile/ios/<idea_id>/<revision>/`。网页版、原课文入口和历史学习记录继续保留。

## 资源选择

`packages/learning-runtime/scripts/ios_media.py` 校验每个课节的 `mobile/ios/manifest.json`。普通打包只选择 `verified` 变体，并核对资源 ID、类型、版本化记录键、依赖摘要、验收结果及证据文件；缺少变体或仍为草稿时保留旧入口。声明已验收但文件缺失、内容变化或证据不完整时构建失败。正常构建只拷贝选中的手机版依赖，不打入草稿文件与作者评审材料。

原有资源 ID 和课程版本不因呈现变化而重编。已选资源带有 `presentation_platform`、`presentation_revision` 和 `state_key`，仍通过原课堂和记录桥接打开；不新增课堂标签页。

`dist/content/ios-media-coverage.json` 按课节、资源列出 `legacy`、`draft` 或 `verified`。`legacy` 表示没有按新规范登记验收，不表示该资源一定无法运行。当前完整课程中 1,187 个动画／游戏条目都尚未登记独立手机版。

## 草稿验收

使用单独测试目录，先拷入当前构建的运行时及内置模型，再运行：

```sh
python3 packages/learning-runtime/scripts/export-content.py \
  --preview-ios-drafts --out /tmp/systemedu-ios-media-preview
```

草稿模式仍检查文件及摘要，但不要求伪造验收结果。报告中的 `preview` 为 `true`，被选草稿的状态为 `preview`。命令拒绝直接写入正式 `dist` 或 App 的 `Resources`。从该目录组装本地模拟器测试包，完成真实操作和状态恢复后，再在源目录写入证据、设置 `verified`，最后用正常 `prepare-resources.py` 重新打包。不能交付草稿预览包，也不能把浏览器验收当作模拟器验收。

只通过格式校验或自动测试不能证明动画有解释力、游戏有可玩的机制，仍须逐资源检查科学内容、触控和完整屏幕截图。

## 本次验证

两个技能通过 skill-creator 格式检查，所有引用可读取，宿主安装链接和 UI 元数据有效。七项资源选择测试覆盖旧入口保留、已验收资源选择、草稿预览、缺文件、摘要变化、错误 ID/类型、记录键冲突、不完整验收和越界路径。运行时完整测试及 TypeScript 检查通过。

重新构建后，58 个项目的目录与全部 843 个课节 JSON 与修改前的 App 资源逐字节一致。新增覆盖报告不会把既有资源误报为已完成手机适配。本次没有新增课程动画或游戏，因此没有声称完成新媒体的模拟器验收。
